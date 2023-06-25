import * as socketIo from "socket.io";
import { container } from "tsyringe";
import { EventUpdate, User, Event, ClientApiCommand } from "../../../src/shared/entity";
import { ChatMetaModule } from "../modules/chatMetaModule/ChatMetaModule";
import { PinsModule } from "../modules/pinsModule/PinsModule";
import { EventsModule } from "../modules/eventsModule/EventsModule";
import { SavedEvent } from "../modules/eventsModule/eventStore";
import { UserModule } from "../modules/userModule/UserModule";
import { SavedUser } from "../modules/userModule/userStore";
import { SW } from "../utils/stopwatch";
import { checkTgAuth } from "./tg/getTgAuth";
import { checkChatToken } from "./Auth";

export class ClientAPI {
    private io: socketIo.Server;

    private splitModule = container.resolve(EventsModule)
    private userModule = container.resolve(UserModule)
    private chatMetaModule = container.resolve(ChatMetaModule)
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
            const upd: User = user
            this.io.to('chatUsersClient_' + chatId).emit('user', upd)
        })

        this.io.on('connection', (socket) => {
            try {
                const sw = new SW("connection");
                if (!socket.handshake.query.userState) {
                    return;
                }
                sw.lap();
                const { initData, initDataUnsafe } = socket.handshake.query
                const tgData = JSON.parse(decodeURIComponent(initDataUnsafe as string)) as { auth_date: number, hash: string, chat?: { id: number }, start_param?: string, chat_instance?: string, user: { id: number, first_name: string, last_name?: string, username?: string } }
                const { auth_date, hash, chat_instance } = tgData
                const auth = checkTgAuth(decodeURIComponent(initData as string), hash, auth_date);
                if (!auth) {
                    return
                }
                sw.lap("tgAuth");
                const [chat_descriptor, token] = (tgData.start_param as string).split('T') ?? [];
                const [chatId, threadId] = chat_descriptor?.split('_').map(Number) ?? []
                if (chatId === undefined) {
                    return
                }

                const tokenCheckPromise = new Promise<boolean>(async (resolve, reject) => {
                    try {
                        try {
                            checkChatToken(decodeURIComponent(token), chatId);
                            resolve(true);
                        } catch (e) {
                            const chatMeta = await this.chatMetaModule.getChatMeta(chatId)
                            resolve((chatMeta?.token ?? undefined) === token)
                        }
                    } catch (e) {
                        reject(e)
                    }
                }).catch(() => false).then(auth => {
                    if (!auth) {
                        socket.disconnect()
                    }
                    return auth
                })

                const checkAuth = async () => {
                    let auth = await tokenCheckPromise;
                    if (!auth) {
                        throw new Error("unauthrized")
                    }
                }

                socket.on("command", async (
                    command: ClientApiCommand,
                    ack: (res: { patch: { type: 'create' | 'update' | 'delete', event: Event }, error?: never } | { error: string, patch?: never }) => void) => {
                    try {
                        await checkAuth()
                        // TODO: sanitise op
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
                (async () => {
                    try {
                        await checkAuth()

                        socket.join(`chatClient_${tgData.start_param}`);
                        socket.join(`chatUsersClient_${chatId}`);

                        this.userModule.updateUser(chatId, threadId, { id: tgData.user.id, name: tgData.user.first_name, lastname: tgData.user.last_name, username: tgData.user.username, disabled: false });

                        const users = savedUserToApi(await this.userModule.getUsersCached(chatId), chatId, threadId);
                        const { events, eventsPromise } = await this.splitModule.getEventsCached(chatId, threadId);
                        // emit cached
                        socket.emit("state", { events: savedOpsToApi(events), users });

                        { // emit updated
                            const events = savedOpsToApi(await eventsPromise);
                            socket.emit("state", { events, users });
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

export const savedOpToApi = (saved: SavedEvent): Event => {
    const { _id, ...event } = saved
    return { ...event, id: _id.toHexString() }
}

export const savedOpsToApi = (saved: SavedEvent[]): Event[] => {
    return saved.map(savedOpToApi)
}

export const savedUserToApi = (saved: SavedUser[], chatId: number, threadId?: number): User[] => {
    return saved.map(s => {
        const { _id, chatIds, disabledChatIds, threadIds, ...u } = s
        return { ...u, disabled: !!disabledChatIds?.includes(chatId) || (!!threadId && !threadIds?.includes(threadId)) }
    })
}
