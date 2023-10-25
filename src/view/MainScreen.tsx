import React, { useRef } from "react";
import { Event } from "../shared/entity"
import { SessionModel } from "../model/SessionModel"
import { useVMvalue } from "../utils/vm/useVM"
import { VM } from "../utils/vm/VM";
import { expand, getItem, isAndroid, reqestWriteAccess, setItem, showAlert, showConfirm, WebApp, __DEV__ } from "./utils/webapp";
import { useSSRReadyNavigate } from "./utils/navigation/useSSRReadyNavigate";
import { MainButtonController } from "./uikit/tg/MainButtonController";
import { Card, ListItem, UsersPics, CardLight, Link, BackgroundContext } from "./uikit/kit";
import { ModelContext } from "./ModelContext";
import { WithModel } from "./utils/withModelHOC";
import { SettignsIcon } from "./uikit/SettingsIcon";
import { SplitAvailableContext, TimezoneContext, HomeLocSetup } from "./App";
import { SelectedDateContext, MonthCalendar, calHeight, calTitleHeight } from "./monthcal/MonthCal";
import { useSearchParams } from 'react-router-dom';
import { EventsVM } from "../model/EventsModule";
import { BackButtonController } from "./uikit/tg/BackButtonController";

const getMonthStart = (time: number) => {
    const date = new Date(time)
    return new Date(date.getFullYear(), date.getMonth()).getTime();
}

export const MainScreen = WithModel(React.memo(({ model }: { model: SessionModel }) => {
    const nav = useSSRReadyNavigate();

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

    const openCal = React.useCallback(() => {
        setSelectedDate(startDate)
    }, [startDate])

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

    const toSettings = React.useCallback(() => nav("/tg/settings"), [nav])


    const firstRender = React.useRef(true);
    const animation = React.useMemo(() => [mode === 'month' ? 'events_slide_down' : 'events_slide_up', firstRender.current && 'instant'].filter(Boolean).join(' '), [mode]);
    firstRender.current = false;

    console.log('animation', animation);

    return <div style={{ display: 'flex', flexDirection: 'column', ...mode === 'month' && !forceBodyScrollForEvents ? { height: '100vh', minHeight: '100%' } : {} }}>
        <HomeLocSetup />
        <BackButtonController canGoBack={mode === 'month'} goBack={closeCal} />

        <SelectedDateContext.Provider value={{ selectDate, startDate, selectedDate, closeCal }}>
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, overflow: 'hidden' }}>
                <MonthCalendar show={mode === 'month'} scrollInto={scrollInto} />
                {/* overlay */}
                <div
                    className={animation}
                    style={{
                        position: 'absolute', top: 0, width: '100%',
                        height: calHeight,
                        willChange: 'transform',
                        background: mode === 'month' ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-bg-color)',
                    }} />
            </div>

            {mode === 'upcoming' &&
                <div
                    className={animation}
                    style={{
                        position: 'fixed', top: 0, left: 20,
                        zIndex: 4,
                        height: calTitleHeight,
                        display: 'flex',
                        justifyContent: 'start',
                        alignItems: 'center'
                    }}>
                    <button className="gost" onClick={openCal}>Month</button>
                </div>}
            {mode === 'upcoming' &&
                <div
                    className={animation}
                    onClick={toSettings}
                    style={{
                        position: 'fixed', top: 0, right: 20,
                        zIndex: 4,
                        height: calTitleHeight,
                        display: 'flex',
                        justifyContent: 'start',
                        alignItems: 'center',
                        padding: ' 0 16px',
                        margin: '0 -16px'
                    }}>
                    <SettignsIcon />

                </div>}
            <div
                className={animation}

                style={{
                    display: 'flex',
                    zIndex: 1,
                    flexDirection: 'column',
                    willChange: 'transform',
                    background: 'var(--tg-theme-secondary-bg-color)',
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
                            background: 'var(--tg-theme-secondary-bg-color)',
                        }}>
                            <EventsView key={mode} mode={'month'} eventsVM={eventsVM} />
                            <div style={{ display: 'flex', flexShrink: 0, height: 96 }} />
                        </div>
                    </> :
                    <MainScreenView eventsVM={model.eventsModule.futureEvents} />
                }
            </div>
        </SelectedDateContext.Provider>

        <MainScreenAddEventButton />

        {/* render only in browser since here is no willChange: transform which breaks position: fixed */}
        {typeof window !== 'undefined' && <ToSplit />}

        <RequestNotifications model={model} />

    </div >
}))

export const MainScreenView = React.memo(({ eventsVM }: { eventsVM: EventsVM }) => {

    return <>

        <div style={{
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: '96px'
        }}>
            <EventsView key={'upcoming'} mode={'upcoming'} eventsVM={eventsVM} />
        </div>
        {/* render only in ssr since there is no willChange: transform which breaks position: fixed */}
        {typeof window === 'undefined' &&
            <>
                <div style={{
                    position: 'fixed', top: 0, left: 20,
                    zIndex: 4,
                    height: calTitleHeight,
                    display: 'flex',
                    justifyContent: 'start',
                    alignItems: 'center'
                }}>
                    <button className="gost">Month</button>
                </div>
                <div style={{
                    position: 'fixed', top: 0, right: 20,
                    zIndex: 4,
                    height: calTitleHeight,
                    display: 'flex',
                    justifyContent: 'start',
                    alignItems: 'center'
                }}>
                    <SettignsIcon />

                </div>
                <ToSplit />
            </>
        }

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
            console.log('MainScreenAddEventButton: navigate -> addEvent');
            // random bullshit go
            (async () => {
                await null
                nav({ pathname: "/tg/addEvent", search: `?${searchParams.toString()}` })

            })();
        } else {
            showAlert("Only admins can add events in this groups")
        }
    }, [nav, searchParams])
    return <MainButtonController onClick={onClick} text={"ADD EVENT"} />
})

const EventItem = React.memo(({ eventVM }: { eventVM: VM<Event> }) => {
    const event = useVMvalue(eventVM)

    const { id, date, deleted, title, description, attendees, geo, imageURL } = event;

    const nav = useSSRReadyNavigate()
    const onClick = React.useCallback(() => {
        nav(`/tg/editEvent?editEvent=${id}`)
    }, [id])

    const timeZone = React.useContext(TimezoneContext);
    const time = React.useMemo(() => new Date(date).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hourCycle: 'h24', timeZone }), [date]);

    const bg = React.useContext(BackgroundContext)
    return <>
        <ListItem
            style={{
                minHeight: 48,
                textDecoration: deleted ? 'line-through' : undefined,
                borderRadius: 16,
                position: 'relative',
            }}
            onClick={onClick}
            titile={title}
            subtitle={description}
            subTitleStyle={{ filter: 'grayscale(1)' }}
            before={
                !!imageURL && <>
                    <img
                        src={imageURL}
                        style={{
                            position: 'absolute',
                            objectFit: 'cover',
                            opacity: 0.1,
                            width: 'calc(100%)', height: 'calc(100%)', top: 0, bottom: 0, left: 0, right: 0,

                        }} />
                    <div style={{
                        position: 'absolute',
                        width: 'calc(100%)', height: 'calc(100%)', top: 0, bottom: 0, left: 0, right: 0,
                        boxShadow: `inset 0 0  16px 16px ${bg}`,
                    }} />
                </>
            }
            subtitleView={
                (geo || !!attendees.yes.length) &&
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {geo && <div style={{ filter: 'grayscale(1)', fontSize: '0.8em', color: "var(--tg-theme-hint-color)", whiteSpace: 'pre-wrap', textOverflow: 'ellipsis', overflow: 'hidden' }}><Link href={`https://maps.google.com/?q=${geo.location[0]},${geo.location[1]}`}>📍{geo.address}</Link></div>}
                    {!!attendees.yes.length && <UsersPics uids={attendees.yes} />}

                </div>
            }
            right={<span style={{ fontSize: '1.2em' }}> {time} </span>}
        />
    </>
})


let amimateDateOnce = true
const DateView = React.memo(({ date, time, isFirst }: { date: string, time: number, isFirst?: boolean }) => {
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

    return <div onClick={onClick} style={{
        position: 'sticky',
        top: 0,
        zIndex: 3,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignSelf: 'center',
        padding: `16px 20px`,
        margin: `0 20px`,
        backgroundColor: isFirst ? 'var(--tg-theme-bg-color)' : undefined,
    }}>
        <Card key={'date'} style={{
            alignSelf: 'center', margin: 0, padding: 0, fontSize: '0.7em', borderRadius: 12, transition: "max-height ease-in 300ms", maxHeight, overflow: 'hidden'
        }}>
            <ListItem style={{ height: 16 }} titile={date} titleStyle={{ padding: 0, fontWeight: 500 }} leftStyle={{ padding: '0 4px' }} />
        </Card>
    </div>
});

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
const currentYear = new Date().getFullYear()
const EventsView = React.memo((({ eventsVM, mode }: { eventsVM: VM<Map<string, VM<Event>>>, mode: 'upcoming' | 'month' }) => {
    const showDates = mode === 'upcoming';
    const timeZone = React.useContext(TimezoneContext);
    const eventsMap = useVMvalue(eventsVM);
    const events = React.useMemo(() => {
        const events: { vm: VM<Event>, date: string, time: number }[] = [];
        for (let vm of eventsMap.values()) {
            const date = new Date(vm.val.date)
            const dateYear = date.getFullYear()
            const dateStr = `${date.getDate()} ${months[date.getMonth()]}${currentYear !== dateYear ? `, ${dateYear}` : ''}`;
            events.push({ vm, date: dateStr, time: date.getTime() })
        }
        return events
    }, [eventsMap]);

    const { selectDate, startDate } = React.useContext(SelectedDateContext);
    const onClick = React.useCallback(() => {
        selectDate(startDate, { openCal: true });
    }, [selectDate, startDate]);

    // if (true) {
    if (eventsMap.size === 0) {
        return <CardLight><DateView date={`🗓️ no ${mode === 'upcoming' ? 'upcoming events' : 'events at this date'}`} isFirst={mode === 'upcoming'} time={startDate} /></CardLight>
    }

    let prevDate: string | undefined = undefined;
    return <>

        <CardLight  >{events.map(({ vm, date, time }, i) => {
            const show = timeZone && (date !== prevDate);
            prevDate = date;
            return <React.Fragment key={vm.val.id}>

                {(showDates && show && date) ?
                    <DateView date={date} time={time} isFirst={i === 0} /> :
                    i !== 0 ?
                        <div style={{ width: '100%', borderBottom: '1px solid rgba(127, 127, 127, .1)' }} /> :
                        null}

                <div style={{ paddingTop: i === 0 ? 16 : 0 }}>
                    <EventItem key={vm.val.id} eventVM={vm} />
                </div>
            </React.Fragment>
        })}</CardLight>

        {(events.length) === 200 && <Card><ListItem subtitle={`Maybe there are more events, who knows 🤷‍♂️\nDeveloper was too lasy to implement pagination.`} /></Card>}
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