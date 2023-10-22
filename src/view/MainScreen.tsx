import React, { useRef } from "react";
import { Event } from "../shared/entity"
import { SessionModel } from "../model/SessionModel"
import { useVMvalue } from "../utils/vm/useVM"
import { VM } from "../utils/vm/VM";
import { expand, getItem, isAndroid, reqestWriteAccess, setItem, showAlert, showConfirm, WebApp, __DEV__ } from "./utils/webapp";
import { useSSRReadyNavigate } from "./utils/navigation/useSSRReadyNavigate";
import { MainButtonController } from "./uikit/tg/MainButtonController";
import { Card, ListItem, UsersPics, CardLight, Link } from "./uikit/kit";
import { ModelContext } from "./ModelContext";
import { WithModel } from "./utils/withModelHOC";
import { SettignsIcon } from "./uikit/SettingsIcon";
import { SplitAvailableContext, TimezoneContext, HomeLocSetup } from "./App";
import { SelectedDateContext, MonthCalendar, calHeight } from "./monthcal/MonthCal";
import { useSearchParams } from 'react-router-dom';
import { EventsVM } from "../model/EventsModule";
import { BackButtonController } from "./uikit/tg/BackButtonController";

const getMonthStart = (time: number) => {
    const date = new Date(time)
    return new Date(date.getFullYear(), date.getMonth()).getTime();
}

export const MainScreen = WithModel(React.memo(({ model }: { model: SessionModel }) => {
    const forceBodyScrollForEvents = React.useMemo(() => isAndroid(), []);

    const [searchParams, setSearchParams] = useSearchParams()

    const savedSelectedDate = React.useMemo(() => {
        const param = searchParams.get('selectedDate')
        return param ? Number(param) : undefined
    }, [])

    const startDate = React.useMemo(() => {
        const now = new Date()
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    }, [])
    const [selectedDate, setSelectedDate] = React.useState<number | undefined>(savedSelectedDate)
    const [scrollInto, setScrollInto] = React.useState<{ date: number } | undefined>(undefined)

    const selectDate = React.useCallback((date: number, options?: { openCal?: boolean, forceScroll?: boolean }) => {
        if (selectedDate || options?.openCal) {
            setSelectedDate(date)
            if (options?.forceScroll) {
                setScrollInto({ date: getMonthStart(date) })
            }
        }
    }, [selectedDate])

    const [eventsVM, setEventsVM] = React.useState<VM<Map<string, VM<Event>>>>()

    const closeCal = React.useCallback(() => {
        setSelectedDate(undefined)
    }, [])

    React.useEffect(() => {
        if (selectedDate) {
            setEventsVM(model.eventsModule.getDateModel(selectedDate).events)
            setSearchParams(s => {
                s.set('selectedDate', selectedDate.toString())
                return s
            })
        }
    }, [selectedDate])

    const mode = selectedDate ? 'month' : 'upcoming';
    React.useEffect(() => {
        if (selectedDate) {
            expand()
            // scroll to seleced date on open month cal 
            const scrollIntoDate = new Date()
            setScrollInto({ date: getMonthStart(selectedDate) })
        } else {
            // on android body scroll used for events in cal mode - jump back on return
            if (forceBodyScrollForEvents) {
                window.scrollTo(0, 0);
            }

            setSearchParams(s => {
                s.delete('selectedDate')
                return s
            })
        }
        if (!forceBodyScrollForEvents) {
            // prevent close app on cal scroll
            document.body.style.height = mode === 'month' ? '100vh' : ''
            document.body.style.overflow = mode === 'month' ? 'hidden' : ''
        }

    }, [mode, forceBodyScrollForEvents])


    return <div style={{ display: 'flex', flexDirection: 'column', ...mode === 'month' && !forceBodyScrollForEvents ? { height: '100vh', minHeight: '100%' } : {} }}>
        <HomeLocSetup />
        <BackButtonController canGoBack={mode === 'month'} goBack={closeCal} />

        <SelectedDateContext.Provider value={{ selectDate, startDate, selectedDate }}>
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, overflow: 'hidden' }}>
                <MonthCalendar show={mode === 'month'} scrollInto={scrollInto} />
                {/* overlay */}
                <div style={{
                    position: 'absolute', top: 0, width: '100%',
                    height: calHeight,
                    willChange: 'transform',
                    transform: mode === 'month' ? `translateY(${calHeight}px)` : undefined,
                    transition: `transform ease-in-out 250ms`,
                    background: 'var(--tg-theme-bg-color)',
                }} />
            </div>
            <div style={{
                display: 'flex',
                zIndex: 1,
                flexDirection: 'column',
                willChange: 'transform',
                transform: mode === 'month' ? `translateY(${calHeight}px)` : undefined,
                transition: `transform ease-in-out 250ms`,
                background: 'var(--tg-theme-bg-color)',
                height: (mode === 'month' && !forceBodyScrollForEvents) ? `calc(var(--tg-viewport-stable-height) - ${calHeight}px)` : undefined,
            }}>
                {mode === 'month' ?
                    eventsVM &&
                    <>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            height: (mode === 'month' && !forceBodyScrollForEvents) ? `calc(var(--tg-viewport-stable-height) - ${calHeight}px)` : undefined,
                            minHeight: (mode === 'month' && !forceBodyScrollForEvents) ? `calc(var(--tg-viewport-stable-height) - ${calHeight}px)` : undefined,

                            overflowY: !forceBodyScrollForEvents ? 'scroll' : undefined,
                            paddingTop: '8px',
                            background: 'var(--tg-theme-bg-color)',
                            paddingBottom: 96,
                        }}>
                            <EventsView key={mode} mode={'month'} eventsVM={eventsVM} />
                        </div>
                    </> :
                    <MainScreenView eventsVM={model.eventsModule.futureEvents} />}


            </div>
        </SelectedDateContext.Provider>

        <MainScreenAddEventButton />

        <RequestNotifications model={model} />

    </div >
}))

export const MainScreenView = React.memo(({ eventsVM }: { eventsVM: EventsVM }) => {
    const nav = useSSRReadyNavigate();
    const toSettings = React.useCallback(() => nav("/tg/settings"), [nav])

    return <>
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            paddingTop: '8px',
            paddingBottom: '96px'
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
        {/* <ToSplit /> */}
    </>
})

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
    const [searchParams] = useSearchParams();
    const onClick = React.useCallback(() => {
        const canEdit = model.chatSettings.val.allowPublicEdit || model.context.val.isAdmin
        if (canEdit) {
            nav({ pathname: "/tg/addEvent", search: `?${searchParams.toString()}` })
        } else {
            showAlert("Only admins can add events in this groups")
        }
    }, [nav, searchParams])
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
const DateView = React.memo(({ date, time, isToday }: { date: string, time: number, isToday?: boolean }) => {
    const model = React.useContext(ModelContext);
    const shouldAnimate = React.useMemo(() => model && !model.ssrTimeSone() && amimateDateOnce, []);
    const [maxHeight, setMaxHeight] = React.useState(shouldAnimate ? 0 : 50);

    const { selectDate } = React.useContext(SelectedDateContext);

    const onClick = React.useCallback(() => {
        const d = new Date(time)
        selectDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), { openCal: true })
    }, [selectDate, date]);

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
            { alignSelf: 'start', margin: 0, padding: 0, fontSize: '1.2em', borderRadius: 12, transition: "max-height ease-in 300ms", maxHeight, overflow: 'hidden' } :
            { alignSelf: 'center', margin: 0, padding: 0, fontSize: '0.7em', borderRadius: 12, transition: "max-height ease-in 300ms", maxHeight, overflow: 'hidden' };

    }, [isToday, maxHeight])
    return <div onClick={onClick} style={{ display: 'flex', alignSelf: isToday ? 'start' : 'center', padding: isToday ? 8 : 16, margin: isToday ? -8 : -16, position: 'sticky', zIndex: 3, top: 16 }}>
        <Card key={'date'} style={style}>
            <ListItem titile={isToday ? "Today" : date} titleStyle={{ padding: 0, fontWeight: 500 }} leftStyle={{ padding: '0 4px' }} />
        </Card>
    </div>
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
        const today: { vm: VM<Event>, date: string, time: number }[] = [];
        const log: { vm: VM<Event>, date: string, time: number }[] = [];
        for (let vm of eventsMap.values()) {
            const date = new Date(vm.val.date)
            const dateYear = date.toLocaleString('en', { year: 'numeric', timeZone })
            const dateStr = date.toLocaleString('en', { month: 'short', day: 'numeric', year: dateYear !== todayYear ? 'numeric' : undefined, timeZone });
            (((dateStr === todayStr) && groupToday) ? today : log).push({ vm, date: dateStr, time: date.getTime() })
        }
        return { today, log }
    }, [eventsMap, groupToday]);

    const { selectDate, startDate } = React.useContext(SelectedDateContext);
    const onClick = React.useCallback(() => {
        selectDate(startDate, { openCal: true });
    }, [selectDate, startDate]);

    if (today.length == 0 && log.length === 0) {
        return <Card onClick={mode === 'upcoming' ? onClick : undefined}><ListItem titile={`🗓️ no ${mode === 'upcoming' ? 'upcoming events' : 'events at this date'}`} /></Card>
    }

    let prevDate: string | undefined = undefined;
    return <>
        {!!today.length && <Card key="today">{today.map(({ vm, date, time }, i) => {
            return <React.Fragment key={vm.val.id}>

                {(showDates && timeZone && i === 0) ?
                    <DateView date={date} isToday={true} time={time} /> :
                    i !== 0 ?
                        <div style={{ width: '100%', borderBottom: '1px solid rgba(127, 127, 127, .1)' }} /> :
                        null}

                <EventItem key={vm.val.id} eventVM={vm} />
                {i !== today.length - 1 && <div style={{ width: '100%', borderBottom: '1px solid rgba(127, 127, 127, .1)' }} />}

            </React.Fragment>
        })}</Card>}
        {!!log.length && <CardLight key="log" style={{ paddingTop: today.length === 0 ? 8 : 0 }}>{log.map(({ vm, date, time }, i) => {
            const show = timeZone && (date !== prevDate);
            prevDate = date;
            return <React.Fragment key={vm.val.id}>

                {(showDates && show && date) ?
                    <DateView date={date} time={time} /> :
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