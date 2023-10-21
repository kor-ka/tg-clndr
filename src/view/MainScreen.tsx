import React, { useRef } from "react";
import { Event } from "../shared/entity"
import { SessionModel } from "../model/SessionModel"
import { useVMvalue } from "../utils/vm/useVM"
import { VM } from "../utils/vm/VM";
import { expand, getItem, reqestWriteAccess, setItem, showAlert, showConfirm, WebApp, __DEV__ } from "./utils/webapp";
import { useSSRReadyNavigate } from "./utils/navigation/useSSRReadyNavigate";
import { MainButtonController } from "./uikit/tg/MainButtonController";
import { Card, ListItem, UsersPics, CardLight, Link } from "./uikit/kit";
import { ModelContext } from "./ModelContext";
import { WithModel } from "./utils/withModelHOC";
import { SettignsIcon } from "./uikit/SettingsIcon";
import { SplitAvailableContext, TimezoneContext, HomeLocSetup } from "./App";
import { dayViewHeight, calTitleHeight, SelectedDateContext, MonthCalendar } from "./monthcal/MonthCal";
import { useSearchParams } from 'react-router-dom';
import { EventsVM } from "../model/EventsModule";

export const MainScreen = WithModel(React.memo(({ model }: { model: SessionModel }) => {

    const [searchParams, setSearchParams] = useSearchParams()

    const savedSelectedDate = React.useMemo(() => {
        const param = searchParams.get('selectedDate')
        return param ? Number(param) : undefined
    }, [])

    const { BBComponent, state: mode } = useMainScreenBackButtonController(savedSelectedDate ? 'month' : undefined)


    const startDate = React.useMemo(() => {
        const now = new Date()
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    }, [])
    const [selectedDate, setSelectedDate] = React.useState<number>(savedSelectedDate ?? startDate)

    const [eventsVM, setEventsVM] = React.useState<VM<Map<string, VM<Event>>>>()


    React.useEffect(() => {
        if (mode === 'month' && selectedDate) {
            setEventsVM(model.eventsModule.getDateModel(selectedDate).events)
            setSearchParams(s => {
                s.set('selectedDate', selectedDate.toString())
                return s
            })
        }
    }, [mode, selectedDate])

    const [scrollInto, setScrollInto] = React.useState<number | undefined>(undefined)
    const savedSelectedDateRef = useRef(savedSelectedDate);
    React.useEffect(() => {
        if (mode === 'month') {
            expand()
            // jump back to saved event initialy
            setSelectedDate(savedSelectedDateRef.current ?? startDate)
            // scroll to seleced date on open month cal 
            const scrollIntoDate = new Date(savedSelectedDateRef.current ?? startDate)
            setScrollInto(new Date(scrollIntoDate.getFullYear(), scrollIntoDate.getMonth()).getTime())
            savedSelectedDateRef.current = undefined
        } else {
            setSearchParams(s => {
                s.delete('selectedDate')
                return s
            })
        }
    }, [mode])

    const calHeight = 6 * dayViewHeight + calTitleHeight

    return <div style={{ display: 'flex', flexDirection: 'column' }}>
        <HomeLocSetup />
        {BBComponent}

        <SelectedDateContext.Provider value={{ selectDate: setSelectedDate, date: selectedDate }}>
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0 }}>
                <MonthCalendar show={mode === 'month'} scrollInto={scrollInto} />
            </div>
        </SelectedDateContext.Provider>
        <div style={{
            display: 'flex',
            zIndex: 1,
            minHeight: calHeight,
            background: 'var(--tg-theme-bg-color)',
            flexDirection: 'column',
            willChange: 'transform',
            transform: mode === 'month' ? `translateY(${calHeight}px)` : undefined,
            transition: `transform ease-in-out 250ms`,
            paddingBottom: 96
        }}>
            {mode === 'month' ?
                eventsVM && <EventsView key={mode} mode={'month'} eventsVM={eventsVM} /> :
                <MainScreenView eventsVM={model.eventsModule.futureEvents} />}


        </div>

        <MainScreenAddEventButton />

        <ToSplit />

        <RequestNotifications model={model} />

    </div >
}))

export const MainScreenView = React.memo(({ eventsVM }: { eventsVM: EventsVM }) => {
    const nav = useSSRReadyNavigate();
    const toSettings = React.useCallback(() => nav("/tg/settings"), [nav])

    return <div style={{
        display: 'flex',
        flexDirection: 'column',
        paddingTop: '8px',
    }}>
        <EventsView key={'upcoming'} mode={'upcoming'} eventsVM={eventsVM} />
        <Card onClick={toSettings}>
            <ListItem
                titleView={
                    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                        <div style={{ width: 46, height: 46, borderRadius: 46, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--tg-theme-button-color)' }}>
                            <SettignsIcon />
                        </div>
                        <span style={{ margin: 8 }}>Settings</span>
                    </div>
                } />
        </Card>
    </div>
})

const useMainScreenBackButtonController = (initialState?: "upcoming" | "month") => {
    const bb = React.useMemo(() => WebApp?.BackButton, [])

    const [state, setState] = React.useState<"upcoming" | "month">(initialState ?? 'upcoming')

    const onClick = React.useCallback(() => {
        setState(s => s === 'month' ? 'upcoming' : 'month')
    }, [])


    React.useEffect(() => {
        bb.show()
    }, [])

    React.useEffect(() => {
        bb.onClick(onClick)
        return () => {
            bb.offClick(onClick)
        }
    }, [bb])

    const BBComponent = __DEV__ ? <button style={{ position: 'fixed', zIndex: 2, top: 0, left: 0 }} onClick={onClick}>{`< ${state}`}</button> : null
    return { BBComponent, state }
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
    return <Card onClick={onClick} style={{ position: 'fixed', zIndex: 3, padding: 16, top: 'calc(var(--tg-viewport-stable-height) - 77px)', right: 0, borderRadius: '32px 0 0 32px', marginRight: 0, transition: 'transform ease-out 150ms, top ease 150ms' }}>⚡️</Card>
});

const MainScreenAddEventButton = WithModel(({ model }: { model: SessionModel }) => {
    const nav = useSSRReadyNavigate();
    const onClick = React.useCallback(() => {
        const canEdit = model.chatSettings.val.allowPublicEdit || model.context.val.isAdmin
        if (canEdit) {
            nav("/tg/addEvent")
        } else {
            showAlert("Only admins can add events in this groups")
        }
    }, [nav])
    return <MainButtonController onClick={onClick} text={"ADD EVENT"} />
})

const EventItem = React.memo(({ eventVM }: { eventVM: VM<Event> }) => {
    const event = useVMvalue(eventVM)

    const { id, date, deleted, title, description, attendees, geo } = event;

    const nav = useSSRReadyNavigate()
    const onClick = React.useCallback(() => {
        nav(`/tg/editEvent?editEvent=${id}`)
    }, [id])

    const timeZone = React.useContext(TimezoneContext);
    const time = React.useMemo(() => new Date(date).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hourCycle: 'h24', timeZone }), [date]);

    return <ListItem
        style={{
            minHeight: 48,
            textDecoration: deleted ? 'line-through' : undefined
        }}
        onClick={onClick}
        titile={title}
        subtitle={description}
        subTitleStyle={{ filter: 'grayscale(1)' }}
        subtitleView={(geo || !!attendees.yes.length) && <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {geo && <div style={{ filter: 'grayscale(1)', fontSize: '0.8em', color: "var(--tg-theme-hint-color)", whiteSpace: 'pre-wrap', textOverflow: 'ellipsis', overflow: 'hidden' }}><Link href={`https://maps.google.com/?q=${geo.location[0]},${geo.location[1]}`}>📍{geo.address}</Link></div>}
            {!!attendees.yes.length && <UsersPics uids={attendees.yes} />}
        </div>}
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

const EventsView = React.memo((({ eventsVM, mode }: { eventsVM: VM<Map<string, VM<Event>>>, mode: 'upcoming' | 'month' }) => {
    const showDates = mode === 'upcoming';
    const groupToday = mode === 'upcoming';
    const timeZone = React.useContext(TimezoneContext);
    const eventsMap = useVMvalue(eventsVM);
    const [todayStr, todayYear] = React.useMemo(() => {
        const todayDate = new Date()
        const todayStr = todayDate.toLocaleString('en', { month: 'short', day: 'numeric', timeZone })
        const todayYear = todayDate.toLocaleString('en', { year: 'numeric', timeZone })
        return [todayStr, todayYear]
    }, [timeZone]);
    const { today, log } = React.useMemo(() => {
        const today: { vm: VM<Event>, date: string }[] = [];
        const log: { vm: VM<Event>, date: string }[] = [];
        for (let vm of eventsMap.values()) {
            const date = new Date(vm.val.date)
            const dateYear = date.toLocaleString('en', { year: 'numeric', timeZone })
            const dateStr = date.toLocaleString('en', { month: 'short', day: 'numeric', year: dateYear !== todayYear ? 'numeric' : undefined, timeZone });
            (((dateStr === todayStr) && groupToday) ? today : log).push({ vm, date: dateStr })
        }
        return { today, log }
    }, [eventsMap, groupToday]);
    let prevDate: string | undefined = undefined;
    if (today.length == 0 && log.length === 0) {
        return <Card><ListItem titile={`🗓️ no ${mode === 'upcoming' ? 'upcoming event' : 'events at this date'}`} /></Card>
    }
    return <>
        {!!today.length && <Card key="today">{today.map(({ vm, date }, i) => {
            return <React.Fragment key={vm.val.id}>

                {(showDates && timeZone && i === 0) ?
                    <DateView date={date} isToday={true} /> :
                    i !== 0 ?
                        <div style={{ width: '100%', borderBottom: '1px solid rgba(127, 127, 127, .1)' }} /> :
                        null}

                <EventItem key={vm.val.id} eventVM={vm} />
                {i !== today.length - 1 && <div style={{ width: '100%', borderBottom: '1px solid rgba(127, 127, 127, .1)' }} />}

            </React.Fragment>
        })}</Card>}
        {!!log.length && <CardLight key="log" style={{ paddingTop: today.length === 0 ? 8 : 0 }}>{log.map(({ vm, date }, i) => {
            const show = timeZone && (date !== prevDate);
            prevDate = date;
            return <React.Fragment key={vm.val.id}>

                {(showDates && show && date) ?
                    <DateView date={date} /> :
                    i !== 0 ?
                        <div style={{ width: '100%', borderBottom: '1px solid rgba(127, 127, 127, .1)' }} /> :
                        null}

                <EventItem key={vm.val.id} eventVM={vm} />
            </React.Fragment>
        })}</CardLight>}

        {(today.length + log.length) === 200 && <Card><ListItem subtitle={`Maybe there are more events, who knows 🤷‍♂️\nDeveloper was too lasy to implement pagination.`} /></Card>}
    </>
}))

const RequestNotifications = React.memo(({ model }: { model: SessionModel }) => {
    React.useEffect(() => {
        (async () => {
            await new Promise<void>(resolve => {
                model.eventsModule.futureEvents.subscribe(e => {
                    if (e.size > 0) {
                        resolve()
                    }
                })
            })
            if (!model.userSettings.val.enableNotifications) {
                const notificationsRequested = await getItem('notifications_enable_requested')
                if (!notificationsRequested) {
                    showConfirm("This bot can notify you about upcoming events you attend by sending you a message. Enable notifications?", async confirmed => {
                        if (confirmed) {
                            const granted = await reqestWriteAccess()
                            if (granted) {
                                await model.updateUserSettings({ enableNotifications: true, notifyBefore: '1h' })
                            }
                        }
                        await setItem('notifications_enable_requested', 'true')
                    })
                }
            }
        })();
    }, []);
    return null
})