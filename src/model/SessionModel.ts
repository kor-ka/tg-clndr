import { io, Socket } from "socket.io-client";
import { VM } from "../utils/vm/VM";
import Cookies from "js-cookie";
import { ChatContext, ChatSettings, ClientApiEventCommand, Event, EventUpdate, User, UserSettings, Notification } from "../shared/entity";
import { Deffered } from "../utils/deffered";
import { UsersModule } from "./UsersModule";
import { EventsModule } from "./EventsModule";

type TgWebAppInitData = { chat?: { id: number }, user: { id: number }, start_param?: string } & unknown;
const SPLIT_DOMAIN = 'https://tg-split.herokuapp.com';

export class SessionModel {
    readonly tgWebApp: TgWebAppInitData;
    readonly eventsModule: EventsModule
    readonly users: UsersModule;
    readonly chatId: number | undefined

    readonly chatSettings = new VM<ChatSettings>({ allowPublicEdit: false, enableEventMessages: false })
    readonly userSettings = new VM<UserSettings>({ notifyBefore: null })

    readonly context = new VM<ChatContext>({ isAdmin: false, isPrivate: false })

    readonly ready = new Deffered<void>()

    private localOprationId = Date.now();

    private socket: Socket;

    private emit = (ev: string, ...args: any[]) => {
        console.log(ev, args);
        this.socket.emit(ev, ...args);
    };

    constructor(params: { initDataUnsafe: TgWebAppInitData, initData: string }) {
        this.eventsModule = new EventsModule(this);

        this.chatId = params.initDataUnsafe.chat?.id;

        Cookies.set("user_id", params.initDataUnsafe.user.id.toString(), { path: "/", sameSite: 'None', secure: true, expires: 365 });
        Cookies.set("time_zone", Intl.DateTimeFormat().resolvedOptions().timeZone, { path: "/", sameSite: 'None', secure: true, expires: 365 });

        this.users = new UsersModule(params.initDataUnsafe.user.id);

        this.tgWebApp = params.initDataUnsafe
        const endpoint =
            window.location.hostname.indexOf("localhost") >= 0
                ? "http://localhost:5001"
                : "https://tg-clndr-4023e1d4419a.herokuapp.com/";

        this.socket = io(endpoint, {
            transports: ["websocket"],
            query: {
                initData: params.initData,
                initDataUnsafe: encodeURIComponent(JSON.stringify(params.initDataUnsafe))
            },
        });

        this.socket.onAny((...e) => {
            console.log(e);
        });

        this.socket.on("state", ({ events, users, chatSettings, userSettings, context, key }: { events: Event[], users: User[], chatSettings: ChatSettings, userSettings: UserSettings, context: ChatContext, key?: string }) => {
            console.log("on_State", { events, users })
            this.userSettings.next(userSettings)
            this.chatSettings.next(chatSettings)
            this.context.next(context)
            // happens on reconnect and cache update
            // since some event may be deleted in between, rewrite whole event
            // TODO: detect deletions?
            this.eventsModule.futureEvents.next(new Map())
            events.map(this.addEvent)
            users.forEach(this.users.updateUser)
            this.ready.resolve()
            if (key) {
                Cookies.set("key", key, { path: "/", sameSite: 'None', secure: true, expires: 365 });
            }
        });

        this.socket.on("user", (user: User) => {
            this.users.updateUser(user)
        });

        this.socket.on("update", (update: EventUpdate) => {
            this.addEvent(update.event)
        });

    }


    private addEvent = (event: Event) => {
        this.eventsModule.updateEventVM(event)
    }

    nextId = () => this.localOprationId++
    commitCommand = (operation: ClientApiEventCommand): Promise<Event> => {
        const d = new Deffered<Event>()
        this.emit("command", operation, (res: { patch: { event: Event, type: 'create' | 'update' | 'delete' }, error: never } | { error: string, patch: never }) => {
            console.log("on_op_ack", res)
            const { patch, error } = res
            if (patch) {
                this.addEvent(patch.event)
                d.resolve(patch.event)
            } else {
                d.reject(new Error(error))
            }
        });
        return d.promise
    };

    updateStatus = (eventId: string, status: 'yes' | 'no' | 'maybe'): Promise<Event> => {
        const d = new Deffered<Event>()
        this.emit("status", { eventId, status }, (res: { updated: Event, error: never } | { error: string, updated: never }) => {
            console.log("on_status_ack", res)
            const { updated, error } = res
            if (updated) {
                this.addEvent(updated)
                d.resolve(updated)
            } else {
                d.reject(new Error(error))
            }
        });
        return d.promise
    };

    updateChatSettings = (update: Partial<ChatSettings>) => {
        const d = new Deffered<ChatSettings>()
        this.emit("update_chat_settings", update, (res: { updated: ChatSettings, error: never } | { error: string, updated: never }) => {
            const { updated, error } = res
            if (updated) {
                this.chatSettings.next(updated)
                d.resolve(updated)
            } else {
                d.reject(new Error(error))
            }
        });
        return d.promise
    }

    updateUserSettings = (update: Partial<UserSettings>) => {
        const d = new Deffered<UserSettings>()
        this.emit("update_user_settings", update, (res: { updated: UserSettings, error: never } | { error: string, updated: never }) => {
            const { updated, error } = res
            if (updated) {
                this.userSettings.next(updated)
                d.resolve(updated)
            } else {
                d.reject(new Error(error))
            }
        });
        return d.promise
    }

    updateNotification = (eventId: string, notification: Notification) => {
        const d = new Deffered<Notification>()
        this.emit("notification_update", { eventId, notification }, (res: { error?: string }) => {
            const { error } = res
            if (!error) {
                const vm = this.eventsModule.getEventVM(eventId)
                if (vm) {
                    vm.next({ ...vm.val, notification })
                }
                d.resolve(notification)
            } else {
                d.reject(new Error(error))
            }
        });
        return d.promise
    }

    getEventsRange = (from: number, to: number) => {
        const d = new Deffered<Event[]>()
        this.emit('get_events_range', { from, to }, ({ events, error }: { events: Event[], error: never } | { error: string, events: never }) => {
            if (!error) {
                events.forEach(this.addEvent)
                d.resolve(events)
            } else {
                d.reject(new Error(error))
            }
        })
        return d.promise
    }

    ssrTimeSone = () => {
        return Cookies.get('ssr_time_zone')
    }

    ssrUserId = () => {
        return Cookies.get('ssr_user_id')
    }

    splitAvailableSync = () => {
        return Cookies.get(`split_available_${this.chatId}`) === 'true'
    }

    splitAvailable = async () => {
        let splitAvailable = this.splitAvailableSync()
        if (!splitAvailable) {

            splitAvailable = (await (await fetch(`${SPLIT_DOMAIN}/enabledInChat/${this.chatId}`)).text()) === 'true';
            if (splitAvailable) {
                Cookies.set(`split_available_${this.chatId}`, 'true', { path: "/", sameSite: 'None', secure: true, expires: 7 })
            }
        }
        return splitAvailable;
    }
}