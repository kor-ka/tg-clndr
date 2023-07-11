import React, { useCallback } from "react";
import { Event } from "../shared/entity"
import { SessionModel } from "../model/SessionModel"
import { UsersModule } from "../model/UsersModule";
import { useVMvalue } from "../utils/vm/useVM"
import {
    createBrowserRouter,
    Location,
    RouterProvider,
    useLocation as loc,
    useNavigate as nav, useResolvedPath, useSearchParams
} from "react-router-dom";
import { AddTransferScreen } from "./AddTransferScreen";
import { VM } from "../utils/vm/VM";
import Linkify from "linkify-react";

export let __DEV__ = false
export let WebApp: any = undefined
if (typeof window !== "undefined") {
    __DEV__ = window.location.hostname.indexOf("localhost") >= 0 || window.location.search.endsWith("_dev_=true")
    WebApp = (window as any).Telegram.WebApp
}
export const showAlert = (message: string) => {
    if (__DEV__) {
        window.alert(message)
    } else {
        WebApp?.showAlert(message)
    }
}

export const showConfirm = (message: string, callback: (confirmed: boolean) => void) => {
    if (__DEV__) {
        callback(window.confirm(message))
    } else {
        WebApp?.showConfirm(message, callback)

    }
}


export const ModelContext = React.createContext<SessionModel | undefined>(undefined);
export const UserContext = React.createContext<number | undefined>(undefined);
export const UsersProvider = React.createContext<UsersModule>(new UsersModule());
export const SplitAvailable = React.createContext(false);
export const Timezone = React.createContext<string | undefined>(undefined);
export const HomeLoc = React.createContext<{ loc: Location | undefined }>({ loc: undefined });


export const useNav = () => {
    if (typeof window !== "undefined") {
        return nav()
    } else {
        return () => { }
    }
}

export const useLoc = (): Location => {
    if (typeof window !== "undefined") {
        return loc()
    } else {
        return { state: {}, key: 'default', pathname: '', search: '', hash: '' }
    }
}

const getPath = () => {
    if (typeof window !== "undefined") {
        return window.location.pathname
    }
    return ''
}

export const renderApp = (model: SessionModel) => {
    const router = createBrowserRouter([
        {
            path: "/tg",
            element: <MainScreen />,
        },
        {
            path: "/tg/addEvent",
            element: <AddTransferScreen />,
        },
        {
            path: "/tg/editEvent",
            element: <AddTransferScreen />,
        },
    ]);

    return <Timezone.Provider value={Intl.DateTimeFormat().resolvedOptions().timeZone}>
        <SplitAvailable.Provider value={model.splitAvailableSync()}>
            <ModelContext.Provider value={model}>
                <UserContext.Provider value={model.tgWebApp.user.id}>
                    <UsersProvider.Provider value={model.users}>
                        <HomeLoc.Provider value={{ loc: undefined }}>
                            <RouterProvider router={router} />
                        </HomeLoc.Provider>
                    </UsersProvider.Provider>
                </UserContext.Provider>
            </ModelContext.Provider>
        </SplitAvailable.Provider>
    </Timezone.Provider>
}

export const MainScreen = () => {
    const homeLoc = React.useContext(HomeLoc);
    const loc = useLoc();
    homeLoc.loc = loc;

    const model = React.useContext(ModelContext)
    return model ? <MainScreenWithModel model={model} /> : null
}

const MainScreenWithModel = ({ model }: { model: SessionModel }) => {
    return <MainScreenView eventsVM={model.eventsModule.events} />
}

const ToSplit = React.memo(() => {
    const model = React.useContext(ModelContext);
    const splitAvailableSync = React.useContext(SplitAvailable)
    const [splitAvailable, setSplitAvailable] = React.useState(splitAvailableSync);
    React.useEffect(() => {
        if (!splitAvailable) {
            model?.splitAvailable()
                .then(setSplitAvailable)
                .catch(e => console.error(e));
        }
    }, []);
    const onClick = React.useCallback(() => {
        WebApp?.openTelegramLink(`https://t.me/splitsimplebot/split?startapp=${WebApp?.initDataUnsafe.start_param}&startApp=${WebApp?.initDataUnsafe.start_param}`);
    }, []);
    return <Card onClick={onClick} style={{ position: 'fixed', padding: 16, top: 'calc(var(--tg-viewport-stable-height) - 77px)', right: 0, borderRadius: '32px 0 0 32px', marginRight: 0, transition: 'transform ease-out 150ms, top ease 150ms', transform: `translateX(${splitAvailable ? 0 : 64}px)` }}>⚡️</Card>
});

export const MainScreenView = ({ eventsVM }: { eventsVM: VM<Map<string, VM<Event>>> }) => {
    const nav = useNav()
    return <div style={{ display: 'flex', flexDirection: 'column', padding: "8px 0px", paddingBottom: 96 }}>
        <BackButtopnController />
        <EventsView eventsVM={eventsVM} />
        <MainButtopnController onClick={() => nav("/tg/addEvent")} text={"ADD EVENT"} />
        <ToSplit />
    </div>
}

export const Card = ({ children, style, onClick }: { children: any, style?: any, onClick?: React.MouseEventHandler<HTMLDivElement> }) => {
    return <div onClick={onClick} className={onClick ? "card" : undefined} style={{ display: 'flex', flexDirection: 'column', margin: '8px 16px', padding: 4, backgroundColor: "var(--tg-theme-secondary-bg-color)", borderRadius: 16, ...style }}>{children}</div>
}

export const Button = ({ children, style, onClick, disabled }: { children: any, style?: any, onClick?: React.MouseEventHandler<HTMLButtonElement>, disabled?: boolean }) => {
    return <button disabled={disabled} onClick={onClick} style={{ margin: '8px 16px', padding: 0, backgroundColor: "var(--tg-theme-secondary-bg-color)", borderRadius: 8, ...style }}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: 4, opacity: disabled ? 0.8 : undefined }}>{children}</div>
    </button>
}


export const CardLight = ({ children, style }: { children: any, style?: any }) => {
    return <div style={{ display: 'flex', flexDirection: 'column', margin: '0px 20px', ...style }}>{children}</div>
}

const Link = ({ attributes, content }: { attributes: any, content: any }) => {
    const { href, ...props } = attributes;
    const onClick = React.useCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        e.preventDefault();
        e.stopPropagation();
        WebApp?.openLink(href)
    }, [href])
    return <a onClick={onClick} href={href} {...props}>{content}</a>;
};

export const ListItem = React.memo(({ titile: title, subtitle, right, style, titleStyle, subTitleStyle, rightStyle, leftStyle, onClick, onSubtitleClick }: { titile?: string, subtitle?: string, right?: React.ReactNode, style?: any, titleStyle?: any, subTitleStyle?: any, rightStyle?: any, leftStyle?: any, onClick?: React.MouseEventHandler<HTMLDivElement>, onSubtitleClick?: React.MouseEventHandler<HTMLDivElement> }) => {
    return <div className={onClick ? "list_item" : undefined} onClick={onClick} style={{ display: 'flex', flexDirection: "row", justifyContent: 'space-between', padding: 4, alignItems: 'center', ...style }}>
        <div style={{ display: 'flex', padding: '2px 0px', flexDirection: "column", flexGrow: 1, flexShrink: 1, minWidth: 0, ...leftStyle }}>
            {!!title && <div style={{ padding: '2px 4px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', ...titleStyle }}>{title}</div>}
            {!!subtitle && <Linkify options={{ render: Link }}>
                <div onClick={onSubtitleClick} style={{ padding: '2px 4px', fontSize: '0.8em', color: "var(--tg-theme-hint-color)", whiteSpace: 'pre-wrap', textOverflow: 'ellipsis', overflow: 'hidden', ...subTitleStyle }}>{subtitle}</div>
            </Linkify>}
        </div>
        {!!right && <div style={{ display: 'flex', padding: '4px 16px', flexShrink: 0, alignItems: 'center', ...rightStyle }}>{right}</div>}
    </div>
}
)

const EventItem = React.memo(({ eventVM }: { eventVM: VM<Event> }) => {
    const event = useVMvalue(eventVM)
    const usersModule = React.useContext(UsersProvider)
    const user = useVMvalue(usersModule.getUser(event.uid))

    const nav = useNav()
    const onClick = React.useCallback(() => {
        nav(`/tg/editEvent?editEvent=${event.id}`)
    }, [])

    const timeZone = React.useContext(Timezone);
    const time = React.useMemo(() => new Date(event.date).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hourCycle: 'h24', timeZone }), [event.date]);

    const description = React.useMemo(() => [event.description, user.fullName].filter(Boolean).join('\n'), [event.description, user.name])
    return <ListItem
        onClick={onClick} style={event.deleted ? { textDecoration: 'line-through' } : undefined}
        titile={event.title}
        subtitle={description}
        right={<span style={{ fontSize: '1.2em' }}> {time} </span>}
    />
})


let amimateDateOnce = true
const DateView = React.memo(({ date, isToday }: { date: string, isToday?: boolean }) => {
    const model = React.useContext(ModelContext);
    const shouldAnimate = React.useMemo(() => model && !model.ssrTimeSone() && amimateDateOnce, []);
    const [maxHeight, setMaxHeight] = React.useState(shouldAnimate ? 0 : 50);
    React.useEffect(() => {
        if (shouldAnimate) {
            amimateDateOnce = false;
            setTimeout(() => {
                setMaxHeight(50);
            }, 10);
        }
    }, [shouldAnimate]);
    const style = React.useMemo(() => {
        return isToday ?
            { alignSelf: 'start', margin: 0, padding: 0, fontSize: '1.2em', borderRadius: 12, position: 'sticky', top: 16, transition: "max-height ease-in 300ms", maxHeight, overflow: 'hidden' } :
            { alignSelf: 'center', margin: 0, padding: 0, fontSize: '0.7em', borderRadius: 12, position: 'sticky', top: 16, transition: "max-height ease-in 300ms", maxHeight, overflow: 'hidden' };

    }, [isToday, maxHeight])
    return <Card key={'date'} style={style}>
        <ListItem titile={isToday ? "Today" : date} titleStyle={{ padding: 0, fontWeight: 500 }} leftStyle={{ padding: '0 4px' }} />
    </Card>
});

const EventsView = React.memo((({ eventsVM }: { eventsVM: VM<Map<string, VM<Event>>> }) => {
    const timeZone = React.useContext(Timezone);
    const eventsMap = useVMvalue(eventsVM);
    const todayStr = React.useMemo(() => new Date().toLocaleString('en', { month: 'short', day: 'numeric', timeZone }), [timeZone]);
    const { today, log } = React.useMemo(() => {
        const today: { vm: VM<Event>, date: string }[] = [];
        const log: { vm: VM<Event>, date: string }[] = [];
        for (let vm of eventsMap.values()) {
            const date = new Date(vm.val.date).toLocaleString('en', { month: 'short', day: 'numeric', timeZone });
            (date === todayStr ? today : log).push({ vm, date })
        }
        return { today, log }
    }, [eventsMap]);
    let prevDate: string | undefined = undefined;
    if (today.length == 0 && log.length === 0) {
        return <Card><ListItem titile={'🗓️ no upcoming events'} /></Card>
    }
    return <>
        {!!today.length && <Card key="today">{today.map(({ vm, date }, i) => {
            return <React.Fragment key={vm.val.id}>
                {timeZone && i === 0 && <DateView date={date} isToday={true} />}
                {<EventItem key={vm.val.id} eventVM={vm} />}
            </React.Fragment>
        })}</Card>}
        {!!log.length && <CardLight key="log" style={{ paddingTop: today.length === 0 ? 8 : 0 }}>{log.map(({ vm, date }) => {
            const show = timeZone && (date !== prevDate);
            prevDate = date;
            return <React.Fragment key={vm.val.id}>
                {show && date && <DateView date={date} />}
                {<EventItem key={vm.val.id} eventVM={vm} />}
            </React.Fragment>
        })}</CardLight>}

        {(today.length + log.length) === 200 && <Card><ListItem subtitle={`Maybe there are more events, who knows 🤷‍♂️\nDeveloper was too lasy to implement pagination.`} /></Card>}
    </>
}))

export const BackButtopnController = React.memo(() => {
    const nav = useNav()
    const bb = React.useMemo(() => WebApp?.BackButton, [])
    const goBack = useCallback(() => nav(-1), [])

    const canGoBack = getPath() !== '/tg/'

    React.useEffect(() => {
        if (canGoBack) {
            bb.show()
        } else {
            bb.hide()
        }
    }, [canGoBack])

    React.useEffect(() => {
        console.log(bb)
        bb.onClick(goBack)
        return () => {
            bb.offClick(goBack)
        }
    }, [bb])

    return (canGoBack && __DEV__) ? <button style={{ position: 'absolute', top: 0, left: 0 }} onClick={goBack}>{"< back"}</button> : null
})

export const MainButtopnController = React.memo(({ onClick, text, color, textColor, isActive, isVisible, progress }: { onClick: () => void, text?: string, color?: string, textColor?: string, isActive?: boolean, isVisible?: boolean, progress?: boolean }) => {
    const mb = React.useMemo(() => WebApp?.MainButton, [])

    React.useEffect(() => {
        mb.onClick(onClick)
        return () => {
            mb.offClick(onClick)
        }
    }, [onClick])


    React.useEffect(() => {
        if (progress !== mb.isProgressVisible) {
            if (progress) {
                mb.showProgress()
            } else {
                mb.hideProgress()
            }
        }

    }, [progress])

    React.useEffect(() => {
        mb.setParams({ text, color, text_color: textColor, is_active: isActive ?? true, is_visible: isVisible ?? true })
    }, [text, color, textColor, isActive, isVisible])

    return (__DEV__ && isVisible !== false) ? <button style={{ position: 'absolute', top: 0, right: 0 }} disabled={isActive === false} onClick={onClick} >{text}{progress ? "⌛️" : ""}</button> : null
})
