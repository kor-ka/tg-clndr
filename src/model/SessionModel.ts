import { io, Socket } from "socket.io-client";
import { VM } from "../utils/vm/VM";
import Cookies from "js-cookie";
import { ClientApiCommand, Event, EventUpdate, User } from "../shared/entity";
import { Deffered } from "../utils/deffered";
import { UsersModule } from "./UsersModule";
import { EventsModule } from "./EventsModule";

type TgWebAppInitData = { chat?: { id: number }, user: { id: number }, start_param?: string } & unknown;
const SPLIT_DOMAIN = 'https://tg-split.herokuapp.com';

export class SessionModel {
    readonly tgWebApp: TgWebAppInitData;
    readonly eventsModule = new EventsModule();
    readonly users: UsersModule;
    readonly chatId: number

    loaded = false;

    private localOprationId = Date.now();

    private socket: Socket;

    private emit = (ev: string, ...args: any[]) => {
        console.log(ev, args);
        this.socket.emit(ev, ...args);
    };

    constructor(params: { initDataUnsafe: TgWebAppInitData, initData: string }) {
        const [chat_descriptor, token] = (params.initDataUnsafe.start_param ?? '').split('T') ?? [];
        const [chatId, threadId] = chat_descriptor.split('_').map(Number) ?? [];
        this.chatId = chatId

        Cookies.set("user_id", params.initDataUnsafe.user.id.toString(), { path: "/", sameSite: 'None', secure: true, expires: 7 })
        Cookies.set("time_zone", Intl.DateTimeFormat().resolvedOptions().timeZone, { path: "/", sameSite: 'None', secure: true, expires: 7 })

        this.users = new UsersModule(params.initDataUnsafe.user.id)

        this.tgWebApp = params.initDataUnsafe
        const endpoint =
            window.location.hostname.indexOf("localhost") >= 0
                ? "http://localhost:5001"
                : "https://tg-clndr-4023e1d4419a.herokuapp.com/";

        this.socket = io(endpoint, {
            transports: ["websocket"],
            query: {
                userState: true,
                initData: params.initData,
                initDataUnsafe: encodeURIComponent(JSON.stringify(params.initDataUnsafe))
            },
        });

        this.socket.onAny((...e) => {
            console.log(e);
        });


        this.socket.on("state", ({ events, users }: { events: Event[], users: User[] }) => {
            console.log("on_State", { events, users })
            this.loaded = true;
            if (events) {
                // happens on reconnect and cache update
                // since some event may be deleted in between, rewrite whole event
                // TODO: detect deletions?
                this.eventsModule.events.next(new Map(events.map(e => [e.id, new VM(e)])))
            }
            if (users) {
                users.forEach(this.users.updateUser)
            }

        });

        this.socket.on("user", (user: User) => {
            this.users.updateUser(user)
        });

        this.socket.on("update", (update: EventUpdate) => {
            if ((update.type === 'create') || this.eventsModule.events.val.has(update.event.id)) {
                this.addOperation(update.event)
            }
        });

    }


    private addOperation = (event: Event) => {
        this.eventsModule.updateEventVM(event)
    }

    nextId = () => this.localOprationId++
    commitCommand = (operation: ClientApiCommand): Promise<Event> => {
        const d = new Deffered<Event>()
        this.emit("command", operation, (res: { patch: { event: Event, type: 'create' | 'update' | 'delete' }, error: never } | { error: string, patch: never }) => {
            console.log("on_op_ack", res)
            const { patch, error } = res
            if (patch) {
                if ((patch.type === 'create') || this.eventsModule.events.val.has(patch.event.id)) {
                    this.addOperation(patch.event)
                }
                d.resolve(patch.event)
            } else {
                d.reject(new Error(error))
            }
        });
        return d.promise
    };

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
            const [chat_descriptor, token] = (this.tgWebApp.start_param as string).split('T') ?? [];
            const [chatId, threadId] = chat_descriptor.split('_').map(Number) ?? [];

            splitAvailable = (await (await fetch(`${SPLIT_DOMAIN}/enabledInChat/${chatId}`)).text()) === 'true';
            if (splitAvailable) {
                Cookies.set(`split_available_${this.chatId}`, 'true', { path: "/", sameSite: 'None', secure: true, expires: 7 })
            }
        }
        return splitAvailable;
    }
}