import * as socketIo from "socket.io";
import { container } from "tsyringe";
import { EventUpdate, User, Event, ClientApiCommand, ChatSettings } from "../../../src/shared/entity";
import { ChatMetaModule } from "../modules/chatMetaModule/ChatMetaModule";
import { EventsModule } from "../modules/eventsModule/EventsModule";
import { SavedEvent } from "../modules/eventsModule/eventStore";
import { UserModule } from "../modules/userModule/UserModule";
import { SavedUser } from "../modules/userModule/userStore";
import { checkTgAuth } from "./tg/getTgAuth";
import { checkChatToken } from "./Auth";
import { TelegramBot } from "./tg/tg";
import { ChatMeta } from "../modules/chatMetaModule/chatMetaStore";
import { SW } from "../utils/stopwatch";

export class ClientAPI {
    private io: socketIo.Server;

    private splitModule = container.resolve(EventsModule)
    private userModule = container.resolve(UserModule)
    private chatMetaModule = container.resolve(ChatMetaModule)
    private bot = container.resolve(TelegramBot)
    constructor(private socket: socketIo.Server) {
        this.io = socket
    }

    readonly init = () => {
        this.splitModule.upateSubject.subscribe(state => {
            const { chatId, threadId, event, type } = state
            const upd: EventUpdate = { event: savedOpToApi(event), type }
            this.io.to('chatClient_' + [chatId, threadId].filter(Boolean).join('_')).emit('update', upd)
        })

        this.userModule.userUpdated.subscribe(({ user, chatId }) => {
            const upd: User = savedUserToApi(user, chatId)
            this.io.to('chatUsersClient_' + chatId).emit('user', upd)
        })

        this.io.on('connection', (socket) => {
            const sw = new SW("init connection")
            sw.lap()

            try {
                const { initData, initDataUnsafe } = socket.handshake.query
                const tgData = JSON.parse(decodeURIComponent(initDataUnsafe as string)) as { auth_date: number, hash: string, chat?: { id: number }, start_param?: string, chat_instance?: string, user: { id: number, first_name: string, last_name?: string, username?: string } }
                const { auth_date, hash } = tgData
                const auth = checkTgAuth(decodeURIComponent(initData as string), hash, auth_date);
                if (!auth) {
                    return
                }
                const [chat_descriptor, token] = (tgData.start_param as string).split('T') ?? [];
                const [chatId, threadId] = chat_descriptor?.split('_').map(Number) ?? []

                if (chatId === undefined) {
                    socket.disconnect()
                    return
                }

                sw.lap('tg auth')

                try {
                    checkChatToken(token, chatId);
                } catch (e) {
                    socket.disconnect()
                    return
                }

                sw.lap('check chat token')

                socket.on("command", async (
                    command: ClientApiCommand,
                    ack: (res: { patch: { type: 'create' | 'update' | 'delete', event: Event }, error?: never } | { error: string, patch?: never }) => void) => {
                    try {
                        // TODO: sanitise op
                        const { settings } = (await this.chatMetaModule.getChatMeta(chatId))!
                        if (!settings.allowPublicEdit) {
                            const isAdmin = ['administrator', 'creator'].includes((await this.bot.bot.getChatMember(chatId, tgData.user.id)).status)
                            if (!isAdmin) {
                                throw new Error("Restricted")
                            }
                        }

                        const { type } = command;
                        if (type === 'create' || type === 'update') {
                            const event = await this.splitModule.commitOperation(chatId, threadId, tgData.user.id, command);
                            ack({ patch: { event: savedOpToApi(event), type } });
                        } else if (type === 'delete') {
                            const event = await this.splitModule.deleteEvent(command.id)
                            ack({ patch: { event: savedOpToApi(event), type } });
                        }

                    } catch (e) {
                        console.error(e)
                        let message = 'unknown error'
                        if (e instanceof Error) {
                            message = e.message
                        }
                        ack({ error: message })
                    }
                });
                socket.on("status", async (
                    { eventId, status }: {
                        eventId: string,
                        status: 'yes' | 'no' | 'maybe',
                    },
                    ack: (res: { updated: Event, error?: never } | { error: string, updated?: never }) => void) => {
                    try {
                        const event = await this.splitModule.updateAtendeeStatus(chatId, threadId, eventId, tgData.user.id, status);
                        ack({ updated: savedOpToApi(event) });
                    } catch (e) {
                        console.error(e)
                        let message = 'unknown error'
                        if (e instanceof Error) {
                            message = e.message
                        }
                        ack({ error: message })
                    }
                });
                socket.on("update_settings", async (
                    settings: Partial<ChatSettings>,
                    ack: (res: { updated: ChatSettings, error?: never } | { error: string, updated?: never }) => void) => {
                    try {
                        const member = await this.bot.bot.getChatMember(chatId, tgData.user.id)
                        if (!(member.status === 'administrator' || member.status === 'creator')) {
                            throw new Error("Not an admin")
                        }
                        const updated = await this.chatMetaModule.updateChatSetings(chatId, settings)
                        ack({ updated: updated?.settings ?? {} });
                    } catch (e) {
                        console.error(e)
                        let message = 'unknown error'
                        if (e instanceof Error) {
                            message = e.message
                        }
                        ack({ error: message })
                    }
                });

                sw.lap('subsciptions')


                socket.join(`chatClient_${[chatId, threadId].filter(Boolean).join('_')}`);
                socket.join(`chatUsersClient_${chatId}`);

                sw.lap('join');


                (async () => {
                    sw.lap('async start');

                    try {
                        this.userModule.updateUser(chatId, threadId, { id: tgData.user.id, name: tgData.user.first_name, lastname: tgData.user.last_name, username: tgData.user.username, disabled: false }).catch(e => console.error(e));
                        sw.lap('update user');

                        const [
                            usersSaved,
                            { events, eventsPromise },
                            meta,
                            member
                        ] = await Promise.all([
                            mesure(() => this.userModule.getUsersCached(chatId), 'getUsersCached'),
                            mesure(() => this.splitModule.getEventsCached(chatId, threadId), 'getEventsCached'),
                            mesure(() => this.chatMetaModule.getChatMeta(chatId), 'getChatMeta'),
                            mesure(() => this.bot.bot.getChatMember(chatId, tgData.user.id), 'getChatMember')
                        ])
                        sw.lap('promises');

                        const users = savedUsersToApi(usersSaved, chatId, threadId)
                        const settings = meta?.settings ?? {};
                        const context = { isAdmin: member.status === 'administrator' || member.status === 'creator' };

                        sw.lap('convert');

                        // emit cached
                        socket.emit("state", { events: savedOpsToApi(events), users, settings, context });
                        sw.lap('emit');
                        sw.report()

                        { // emit updated
                            const events = savedOpsToApi(await eventsPromise);
                            socket.emit("state", { events, users, settings, context });
                        }

                    } catch (e) {
                        console.error(e);
                    }
                })()
            } catch (e) {
                console.error(e);
            }

        })
    }
}

const mesure = <T>(factory: () => Promise<T>, tag: string) => {
    const time = Date.now()
    const promise = factory()
    promise.then(() => {
        console.log(tag, Date.now() - time)
    })
    return promise
}

export const savedOpToApi = (saved: SavedEvent): Event => {
    const { _id, ...event } = saved
    return { ...event, id: _id.toHexString() }
}

export const savedOpsToApi = (saved: SavedEvent[]): Event[] => {
    return saved.map(savedOpToApi)
}

export const savedUserToApi = (saved: SavedUser, chatId: number, threadId?: number): User => {
    const { _id, chatIds, disabledChatIds, threadFullIds, ...u } = saved
    return { ...u, disabled: !!disabledChatIds?.includes(chatId) || ((threadId !== undefined) && !threadFullIds?.includes(`${chatId}_${threadId}`)) }
}

export const savedUsersToApi = (saved: SavedUser[], chatId: number, threadId: number | undefined): User[] => {
    return saved.map(s => savedUserToApi(s, chatId, threadId))
}
