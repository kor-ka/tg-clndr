import * as socketIo from "socket.io";
import { container } from "tsyringe";
import { EventUpdate, User, Event, ClientApiEventCommand, ChatSettings, UserSettings, Notification } from "../../../src/shared/entity";
import { ChatMetaModule } from "../modules/chatMetaModule/ChatMetaModule";
import { EventsModule } from "../modules/eventsModule/EventsModule";
import { SavedEvent } from "../modules/eventsModule/eventStore";
import { UserModule } from "../modules/userModule/UserModule";
import { SavedUser, USER } from "../modules/userModule/userStore";
import { checkTgAuth } from "./tg/getTgAuth";
import { checkChatToken } from "./Auth";
import { TelegramBot } from "./tg/tg";
import { SW } from "../utils/stopwatch";
import { NotificationsModule } from "../modules/notificationsModule/NotificationsModule";
import { ObjectId } from "mongodb";
import { NOTIFICATIONS } from "../modules/notificationsModule/notificationsStore";
import { StatsModule } from "../modules/statsModule/StatsModule";
import { getKey } from "./tg/getKey";
import { mesure } from "../utils/mesure";

const processError = (e: any, ack: (message: { error: string }) => void) => {
    console.error(e)
    let message = 'unknown error'
    if (e instanceof Error) {
        message = e.message
    }
    ack({ error: message })
}

const getIsAdmin = async (bot: TelegramBot, chatId: number, userId: number) => {
    return (userId === chatId) || ['administrator', 'creator'].includes((await bot.bot.getChatMember(chatId, userId)).status)
}
export class ClientAPI {
    private io: socketIo.Server;

    private eventsModule = container.resolve(EventsModule)
    private userModule = container.resolve(UserModule)
    private notificationsModule = container.resolve(NotificationsModule)
    private chatMetaModule = container.resolve(ChatMetaModule)
    private bot = container.resolve(TelegramBot)
    private stats = container.resolve(StatsModule)
    constructor(server: socketIo.Server) {
        this.io = server
    }

    private updateUser = (chatId: number, user: User) => {
        this.io.to('chatUsersClient_' + chatId).emit('user', user)
    }

    readonly init = () => {
        this.eventsModule.upateSubject.subscribe(state => {
            const { chatId, threadId, event, type } = state
            const upd: EventUpdate = { event: savedEventToApiLight(event), type }
            this.io.to('chatClient_' + [chatId, threadId].filter(Boolean).join('_')).emit('update', upd)
        })

        this.userModule.userUpdated.subscribe(({ user, chatId }) => {
            const upd: User = savedUserToApi(user, chatId)
            this.updateUser(chatId, upd)
        })

        this.io.on('connection', (socket) => {
            const sw = new SW("init connection")
            sw.lap()

            const resolvedUsers = new Set<number>()

            try {
                const { initData, initDataUnsafe } = socket.handshake.query
                const tgData = JSON.parse(decodeURIComponent(initDataUnsafe as string)) as { auth_date: number, hash: string, chat?: { id: number }, start_param?: string, chat_instance?: string, user: { id: number, first_name: string, last_name?: string, username?: string } }
                const { auth_date, hash } = tgData
                const auth = checkTgAuth(decodeURIComponent(initData as string), hash, auth_date);
                if (!auth) {
                    socket.disconnect();
                    return;
                }
                const [chat_descriptor, token] = (tgData.start_param as string)?.split('T') ?? [];
                let [chatId, threadId] = chat_descriptor?.split('_').map(Number) ?? []

                if (tgData.start_param) {
                    try {
                        checkChatToken(token, chatId);
                    } catch (e) {
                        socket.disconnect();
                        return;
                    }
                } else {
                    chatId = tgData.user.id
                }

                if (chatId === undefined) {
                    socket.disconnect();
                    return;
                }

                sw.lap('tg auth');

                const sessionId = new ObjectId();
                this.stats.onSessionStart(sessionId, tgData.user.id, chatId).catch(e => console.error('stat: failed to track session start:', e));
                socket.on('disconnect', () => {
                    this.stats.onSessionEnd(sessionId).catch(e => console.error('stat: failed to track session end:', e));
                })

                sw.lap('check chat token');

                socket.on("command", async (
                    command: ClientApiEventCommand,
                    ack: (res: { patch: { type: 'create' | 'update' | 'delete', event: Event }, error?: never } | { error: string, patch?: never }) => void) => {
                    try {
                        // TODO: sanitise op

                        if (chatId >= 0) {
                            // do not check settings for PMs
                        } else {
                            const { settings } = (await this.chatMetaModule.getChatMeta(chatId))!
                            if (!settings.allowPublicEdit) {
                                if (!(await getIsAdmin(this.bot, chatId, tgData.user.id))) {
                                    throw new Error("Restricted");
                                }
                            }
                        }

                        const { type } = command;
                        if (type === 'create' || type === 'update') {
                            const savedEvent = await this.eventsModule.commitOperation(chatId, threadId, tgData.user.id, command);
                            const [event, users] = await resolveEvent(savedEvent, tgData.user.id, resolvedUsers)
                            users.forEach(u => this.updateUser(chatId, u))
                            ack({ patch: { event: event, type } });
                        } else if (type === 'delete') {
                            const event = await this.eventsModule.deleteEvent(command.id)
                            ack({ patch: { event: savedEventToApiLight(event), type } });
                        }

                    } catch (e) {
                        processError(e, ack);
                    }
                });
                socket.on("status", async (
                    { eventId, status }: {
                        eventId: string,
                        status: 'yes' | 'no' | 'maybe',
                    },
                    ack: (res: { updated: Event, error?: never } | { error: string, updated?: never }) => void) => {
                    try {
                        const savedEvent = await this.eventsModule.updateAtendeeStatus(chatId, threadId, eventId, tgData.user.id, status);
                        const [event, users] = await resolveEvent(savedEvent, tgData.user.id, resolvedUsers)
                        users.forEach(u => this.updateUser(chatId, u))
                        ack({ updated: event });
                    } catch (e) {
                        processError(e, ack);
                    }
                });
                socket.on("update_chat_settings", async (
                    settings: Partial<ChatSettings>,
                    ack: (res: { updated: ChatSettings, error?: never } | { error: string, updated?: never }) => void) => {
                    try {
                        if (!(await getIsAdmin(this.bot, chatId, tgData.user.id))) {
                            throw new Error("Restricted")
                        }
                        const updated = await this.chatMetaModule.updateChatSetings(chatId, settings)
                        ack({ updated: updated?.settings ?? {} });
                    } catch (e) {
                        processError(e, ack);
                    }
                });

                socket.on("update_user_settings", async (
                    settings: Partial<UserSettings>,
                    ack: (res: { updated: UserSettings, error?: never } | { error: string, updated?: never }) => void) => {
                    try {
                        const updated = await this.userModule.updateUserSettings(tgData.user.id, settings)
                        ack({ updated: updated.settings });
                    } catch (e) {
                        processError(e, ack);
                    }
                });

                socket.on("notification_update", async (
                    { eventId, notification }: { eventId: string, notification: Notification },
                    ack: (res: { error?: string }) => void) => {
                    try {
                        await this.notificationsModule.updateNotification(new ObjectId(eventId), tgData.user.id, notification)
                        ack({});
                    } catch (e) {
                        processError(e, ack);
                    }
                });

                socket.on("get_events_range", async ({ from, to }: { from: number, to: number }, ack: (res: { events: Event[], error?: never } | { error: string, events?: never }) => void) => {
                    try {
                        const [events, users] = await savedEventsToApiFull(await this.eventsModule.getEventsDateRange(from, to, chatId, threadId), tgData.user.id, resolvedUsers);
                        users.forEach(u => this.updateUser(chatId, u))
                        ack({ events });
                    } catch (e) {
                        processError(e, ack);
                    }
                })

                socket.on("get_event", async ({ id }: { id: string }, ack: (res: { event: Event, error?: never } | { error: string, event?: never }) => void) => {
                    try {
                        const [event, users] = await resolveEvent(await this.eventsModule.getEvent(id), tgData.user.id, resolvedUsers);
                        users.forEach(u => this.updateUser(chatId, u))
                        ack({ event });
                    } catch (e) {
                        processError(e, ack);
                    }
                })

                sw.lap('subsciptions')


                socket.join(`chatClient_${[chatId, threadId].filter(Boolean).join('_')}`);
                socket.join(`chatUsersClient_${chatId}`);

                sw.lap('join');


                (async () => {
                    sw.lap('async start');

                    try {

                        const [
                            user,
                            { users: usersSaved },
                            { events, eventsPromise },
                            meta,
                            isAdmin
                        ] = await Promise.all([
                            mesure(() => this.userModule.updateUser(chatId, threadId, {
                                id: tgData.user.id,
                                name: tgData.user.first_name,
                                lastname: tgData.user.last_name,
                                username: tgData.user.username,
                                disabled: false
                            }), 'updateUser'),
                            mesure(() => this.userModule.getUsersCached(chatId), 'getUsersCached'),
                            mesure(() => this.eventsModule.getEventsCached(chatId, threadId), 'getEventsCached'),
                            mesure(() => chatId >= 0 ? this.chatMetaModule.updateChat(chatId, tgData.user.username ?? '') : this.chatMetaModule.getChatMeta(chatId), 'getChatMeta'),
                            mesure(() => getIsAdmin(this.bot, chatId, tgData.user.id), 'isAdmin')
                        ])
                        sw.lap('promises');

                        if (!meta) {
                            throw new Error(`Chat not fround: ${chatId}`)
                        }

                        const users = savedUsersToApi(usersSaved, chatId, threadId)
                        const chatSettings = meta.settings;
                        const userSettings = user.settings
                        const context = { isAdmin, isPrivate: chatId === tgData.user.id };

                        sw.lap('convert');

                        // emit cached
                        socket.emit("state", { events: savedEventsToApiLight(events), users, chatSettings, userSettings, context, key: getKey(chatId, threadId) });
                        sw.lap('emit');
                        sw.report()

                        { // emit updated
                            const [events, users] = await savedEventsToApiFull(await eventsPromise, tgData.user.id, resolvedUsers);
                            socket.emit("state", { events, users: [...users.values()], chatSettings, userSettings, context });
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

export const savedEventToApiLight = (saved: SavedEvent): Event => {
    const { _id, ...event } = saved
    return { ...event, id: _id.toHexString() }
}

export const savedEventsToApiLight = (saved: SavedEvent[]): Event[] => {
    return saved.map(savedEventToApiLight)
}

const saturateWithUser = async (resolvedUsers: Set<number>, saved: SavedEvent): Promise<User[]> => {
    const users = [...saved.attendees.yes, ...saved.attendees.maybe, ...saved.attendees.no]
        .filter(userId => !resolvedUsers.has(userId))
        .map(userId => USER().findOne({ id: userId }).catch(e => console.error(e)))
        .map(async resolveUser => {
            const user = await resolveUser
            if (user) {
                resolvedUsers.add(user.id)
                const apiUser: User = savedUserToApi(user, saved.chatId)
                return apiUser
            }
        })
    return (await Promise.all(users)).filter(Boolean) as User[]
}

export const resolveEvent = async (saved: SavedEvent, userId: number, resolvedUsers: Set<number>): Promise<[Event, User[]]> => {
    const event = savedEventToApiLight(saved)
    const [notification, users] = await Promise.all([
        NOTIFICATIONS().findOne({ eventId: saved._id, userId }).catch(e => console.error(e)),
        saturateWithUser(resolvedUsers, saved)
    ])
    event.notification = notification ?? undefined
    return [event, users]
}

export const savedEventsToApiFull = (saved: SavedEvent[], userId: number, resolvedUsers: Set<number>): Promise<[Event[], Map<number, User>]> => {
    return Promise.all(saved.map((e) => resolveEvent(e, userId, resolvedUsers)))
        .then(pairs => pairs.reduce((res, entry) => {
            const [resEvents, resUsers] = res
            const [event, users] = entry
            resEvents.push(event)
            users.forEach(user => resUsers.set(user.id, user))
            return res
        }, [[], new Map()] as [Event[], Map<number, User>]))
}


export const savedUserToApi = (saved: SavedUser, chatId: number, threadId?: number): User => {
    const { _id, chatIds, disabledChatIds, threadFullIds, settings, ...u } = saved
    return { ...u, disabled: !!disabledChatIds?.includes(chatId) || ((threadId !== undefined) && !threadFullIds?.includes(`${chatId}_${threadId}`)) }
}

export const savedUsersToApi = (saved: SavedUser[], chatId: number, threadId: number | undefined): User[] => {
    return saved.map(s => savedUserToApi(s, chatId, threadId))
}
