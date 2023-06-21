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
        <ModelContext.Provider value={model}>
            <UserContext.Provider value={model.tgWebApp.user.id}>
                <UsersProvider.Provider value={model.users}>
                    <HomeLoc.Provider value={{ loc: undefined }}>
                        <RouterProvider router={router} />
                    </HomeLoc.Provider>
                </UsersProvider.Provider>
            </UserContext.Provider>
        </ModelContext.Provider>
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

export const MainScreenView = ({ eventsVM }: { eventsVM: VM<Map<string, VM<Event>>> }) => {
    const nav = useNav()
    return <div style={{ display: 'flex', flexDirection: 'column', padding: "8px 0px" }}>
        <BackButtopnController />
        <EventsView eventsVM={eventsVM} />
        <MainButtopnController onClick={() => nav("/tg/addEvent")} text={"ADD EVENT"} />
    </div>
}

export const Card = ({ children, style, onClick }: { children: any, style?: any, onClick?: React.MouseEventHandler<HTMLDivElement> }) => {
    return <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', margin: '8px 16px', padding: 4, backgroundColor: "var(--tg-theme-secondary-bg-color)", borderRadius: 16, ...style }}>{children}</div>
}

export const Button = ({ children, style, onClick, disabled }: { children: any, style?: any, onClick?: React.MouseEventHandler<HTMLButtonElement>, disabled?: boolean }) => {
    return <button disabled={disabled} onClick={onClick} style={{ margin: '8px 16px', padding: 0, backgroundColor: "var(--tg-theme-secondary-bg-color)", borderRadius: 8, ...style }}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: 4, opacity: disabled ? 0.8 : undefined }}>{children}</div>
    </button>
}


export const CardLight = ({ children, style }: { children: any, style?: any }) => {
    return <div style={{ display: 'flex', flexDirection: 'column', margin: '0px 20px', ...style }}>{children}</div>
}

export const ListItem = React.memo(({ titile: title, subtitle, right, style, titleStyle, subTitleStyle, rightStyle, leftStyle, onClick, onSubtitleClick }: { titile?: string, subtitle?: string, right?: React.ReactNode, style?: any, titleStyle?: any, subTitleStyle?: any, rightStyle?: any, leftStyle?: any, onClick?: React.MouseEventHandler<HTMLDivElement>, onSubtitleClick?: React.MouseEventHandler<HTMLDivElement> }) => {
    return <div onClick={onClick} style={{ display: 'flex', flexDirection: "row", justifyContent: 'space-between', padding: 4, alignItems: 'center', ...style }}>
        <div style={{ display: 'flex', padding: '2px 0px', flexDirection: "column", flexGrow: 1, flexShrink: 1, minWidth: 0, ...leftStyle }}>
            {!!title && <div style={{ padding: '2px 4px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', ...titleStyle }}>{title}</div>}
            {!!subtitle && <div onClick={onSubtitleClick} style={{ padding: '2px 4px', fontSize: '0.8em', color: "var(--tg-theme-hint-color)", ...subTitleStyle }}>{subtitle}</div>}
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

    return <div onClick={onClick} style={event.deleted ? { textDecoration: 'line-through' } : undefined}>
        <ListItem
            titile={event.description}
            subtitle={user.fullName}
            right={<span style={{ fontSize: '1.2em' }}> {time} </span>}
        />
    </div>
})


let amimateDateOnce = true
const DateView = React.memo(({ date }: { date: string }) => {
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
    return <Card key={'date'} style={{ alignSelf: 'center', margin: 0, padding: 0, fontSize: '0.7em', borderRadius: 12, position: 'sticky', top: 16, transition: "max-height ease-in 300ms", maxHeight, overflow: 'hidden' }}>
        <ListItem titile={date} titleStyle={{ padding: 0, fontWeight: 500 }} leftStyle={{ padding: '0 4px' }} />
    </Card>
});

const EventsView = React.memo((({ eventsVM }: { eventsVM: VM<Map<string, VM<Event>>> }) => {
    const timeZone = React.useContext(Timezone);
    const eventsMap = useVMvalue(eventsVM);
    const log = React.useMemo(() => [...eventsMap.values()], [eventsMap]);
    let prevDate: string | undefined = undefined;
    if(log.length === 0){
        return <Card><ListItem titile=“🗓️ no upcoming events”/></Card>
    }
    return <>
        <CardLight key="log">{log.map((ev, i, array) => {
            const date = timeZone && new Date(array[i].val.date).toLocaleString('en', { month: 'short', day: 'numeric', timeZone });
            const show = date !== prevDate
            prevDate = date
            return <React.Fragment key={ev.val.id}>
                {show && date && <DateView date={date} />}
                {<EventItem key={ev.val.id} eventVM={ev as VM<Event>} />}
            </React.Fragment>
        })}</CardLight>
        {log.length === 200 && <Card><ListItem subtitle={`Maybe there are more events, who knows 🤷‍♂️\nDeveloper was too lasy to implement pagination.`} /></Card>}
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
