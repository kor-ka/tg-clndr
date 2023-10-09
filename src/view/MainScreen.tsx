import React from "react";
import { Event } from "../shared/entity"
import { SessionModel } from "../model/SessionModel"
import { UsersModule } from "../model/UsersModule";
import { useVMvalue } from "../utils/vm/useVM"
import {
    createBrowserRouter,
    RouterProvider,
} from "react-router-dom";
import { EventScreen } from "./EventScreen";
import { VM } from "../utils/vm/VM";
import { WebApp, __DEV__ } from "./utils/webapp";
import { useSSRReadyLocation } from "./utils/navigation/useSSRReadyLocation";
import { homeLoc, HomeLoc } from "./utils/navigation/useGoHome";
import { useSSRReadyNavigate } from "./utils/navigation/useSSRReadyNavigate";
import { BackButtonController } from "./uikit/tg/BackButtonController";
import { MainButtonController } from "./uikit/tg/MainButtonController";
import { Card, ListItem, UsersPics, CardLight } from "./uikit/kit";
import { SettingsComponent } from "./SettingsComponent";

export const ModelContext = React.createContext<SessionModel | undefined>(undefined);
export const UserContext = React.createContext<number | undefined>(undefined);
export const UsersProviderContext = React.createContext<UsersModule>(new UsersModule());
export const SplitAvailableContext = React.createContext(false);
export const TimezoneContext = React.createContext<string | undefined>(undefined);

export const renderApp = (model: SessionModel) => {
    const router = createBrowserRouter([
        {
            path: "/tg",
            element: <MainScreen />,
        },
        {
            path: "/tg/addEvent",
            element: <EventScreen />,
        },
        {
            path: "/tg/editEvent",
            element: <EventScreen />,
        },
    ]);

    return <TimezoneContext.Provider value={Intl.DateTimeFormat().resolvedOptions().timeZone}>
        <SplitAvailableContext.Provider value={model.splitAvailableSync()}>
            <ModelContext.Provider value={model}>
                <UserContext.Provider value={model.tgWebApp.user.id}>
                    <UsersProviderContext.Provider value={model.users}>
                        <HomeLoc.Provider value={homeLoc}>
                            <RouterProvider router={router} />
                        </HomeLoc.Provider>
                    </UsersProviderContext.Provider>
                </UserContext.Provider>
            </ModelContext.Provider>
        </SplitAvailableContext.Provider>
    </TimezoneContext.Provider>
}

export const MainScreen = () => {
    const homeLoc = React.useContext(HomeLoc);
    const loc = useSSRReadyLocation();
    homeLoc.location = loc;

    const model = React.useContext(ModelContext)
    return model ? <MainScreenWithModel model={model} /> : null
}

const MainScreenWithModel = ({ model }: { model: SessionModel }) => {
    return <MainScreenView eventsVM={model.eventsModule.events} />
}

const ToSplit = React.memo(() => {
    const model = React.useContext(ModelContext);
    const splitAvailableSync = React.useContext(SplitAvailableContext)
    const [splitAvailable, setSplitAvailable] = React.useState(splitAvailableSync);
    React.useEffect(() => {
        if (!splitAvailable) {
            model?.splitAvailable()
                .then(setSplitAvailable)
                .catch(e => console.error(e));
        }
    }, []);
    const onClick = React.useCallback(() => {
        if (splitAvailable) {
            WebApp?.openTelegramLink(`https://t.me/splitsimplebot/split?startapp=${WebApp?.initDataUnsafe.start_param}&startApp=${WebApp?.initDataUnsafe.start_param}`);
        } else {
            WebApp?.openTelegramLink(`https://t.me/splitsimplebot`);
        }
    }, [splitAvailable]);
    return <Card onClick={onClick} style={{ position: 'fixed', padding: 16, top: 'calc(var(--tg-viewport-stable-height) - 77px)', right: 0, borderRadius: '32px 0 0 32px', marginRight: 0, transition: 'transform ease-out 150ms, top ease 150ms' }}>⚡️</Card>
});

export const MainScreenView = ({ eventsVM }: { eventsVM: VM<Map<string, VM<Event>>> }) => {
    const nav = useSSRReadyNavigate()
    return <div style={{ display: 'flex', flexDirection: 'column', padding: "8px 0px", paddingBottom: 96 }}>
        <BackButtonController />
        <EventsView eventsVM={eventsVM} />
        {/* TODO: move to separate screen once settings button available for tApps */}
        <SettingsComponent />
        <MainButtonController onClick={() => nav("/tg/addEvent")} text={"ADD EVENT"} />
        <ToSplit />
    </div>
}


const EventItem = React.memo(({ eventVM }: { eventVM: VM<Event> }) => {
    const event = useVMvalue(eventVM)
    const usersModule = React.useContext(UsersProviderContext)
    const user = useVMvalue(usersModule.getUser(event.uid))

    const nav = useSSRReadyNavigate()
    const onClick = React.useCallback(() => {
        nav(`/tg/editEvent?editEvent=${event.id}`)
    }, [])

    const timeZone = React.useContext(TimezoneContext);
    const time = React.useMemo(() => new Date(event.date).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hourCycle: 'h24', timeZone }), [event.date]);

    return <ListItem
        onClick={onClick} style={event.deleted ? { textDecoration: 'line-through' } : undefined}
        titile={event.title}
        subtitle={event.description}
        subtitleView={<UsersPics uids={event.attendees.yes} />}
        subTitleStyle={{ filter: 'grayscale(1)' }}
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
    const timeZone = React.useContext(TimezoneContext);
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