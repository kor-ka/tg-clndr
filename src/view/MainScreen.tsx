import React, { lazy, useRef } from "react";
import { Event } from "../shared/entity"
import { SessionModel } from "../model/SessionModel"
import { useVMvalue } from "../utils/vm/useVM"
import { VM } from "../utils/vm/VM";
import { expand, getItem, isAndroid, reqestWriteAccess, setItem, showAlert, showConfirm, WebApp, __DEV__ } from "./utils/webapp";
import { useSSRReadyNavigate } from "./utils/navigation/useSSRReadyNavigate";
import { MainButtonController } from "./uikit/tg/MainButtonController";
import { Card, ListItem, UsersPics, CardLight, Link, BackgroundContext, Page } from "./uikit/kit";
import { ModelContext } from "./ModelContext";
import { WithModel } from "./utils/withModelHOC";
import { SettignsIcon } from "./uikit/SettingsIcon";
import { SplitAvailableContext, TimezoneContext, HomeLocSetup } from "./App";
import { useSearchParams } from 'react-router-dom';
import { EventsVM } from "../model/EventsModule";
import { BackButtonController } from "./uikit/tg/BackButtonController";
import { BackgroundColorController } from "./uikit/tg/BackgroundColorController";
import { SelectedDateContext, calHeight, calTitleHeight } from "./monthcal/shared";
import { HeaderColorController } from "./uikit/tg/HeaderColorController";

const MonthCalendar = lazy(() => import('./monthcal/MonthCal'))

const getMonthStart = (time: number) => {
    const date = new Date(time)
    return new Date(date.getFullYear(), date.getMonth()).getTime();
}

export const MainScreen = WithModel(React.memo(({ model }: { model: SessionModel }) => {
    const nav = useSSRReadyNavigate();

    const forceBodyScrollForEvents = true //React.useMemo(() => isAndroid() || (typeof window !== 'undefined' && window.innerHeight < 650), []);

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
            // if body scroll used for events in cal mode - jump back to top on return
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
        <HeaderColorController color={'secondary_bg_color'} />
        <BackButtonController canGoBack={mode === 'month'} goBack={closeCal} />

        <SelectedDateContext.Provider value={{ selectDate, startDate, selectedDate, closeCal }}>
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, overflow: 'hidden' }}>

                <React.Suspense fallback={null}>
                    <MonthCalendar show={mode === 'month'} scrollInto={scrollInto} />
                </React.Suspense>
                {/* overlay */}
                <div
                    className={animation}
                    style={{
                        position: 'absolute', top: 0, width: '100%',
                        height: calHeight,
                        willChange: 'transform',
                        background: mode === 'month' ? 'var(--tg-theme-bg-color)' : 'var(--tg-theme-secondary-bg-color)',
                    }} />
            </div>

            {mode === 'upcoming' &&
                <div
                    className={animation}
                    style={{
                        position: 'fixed', top: 0, left: 16,
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
                        position: 'fixed', top: 0, right: 16,
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
                    background: 'var(--tg-theme-bg-color)',
                    minHeight: mode === 'upcoming' ? '100vh' : undefined,

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
                            background: 'var(--tg-theme-bg-color)',
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
        {typeof window !== 'undefined' && mode === 'upcoming' && <ToSplit />}

        <RequestNotifications model={model} />

    </div >
}))

export const MainScreenView = React.memo(({ eventsVM }: { eventsVM: EventsVM }) => {

    return <>

        <div style={{
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: '96px',
        }}>
            <EventsView key={'upcoming'} mode={'upcoming'} eventsVM={eventsVM} />
        </div>
        {/* render only in ssr since there is no willChange: transform which breaks position: fixed */}
        {typeof window === 'undefined' &&
            <>
                <div style={{
                    position: 'fixed', top: 0, left: 16,
                    zIndex: 4,
                    height: calTitleHeight,
                    display: 'flex',
                    justifyContent: 'start',
                    alignItems: 'center'
                }}>
                    <button className="gost">Month</button>
                </div>
                <div style={{
                    position: 'fixed', top: 0, right: 16,
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

const EventItem = React.memo(({ eventVM, displayDate }: { eventVM: VM<Event>, displayDate?: number }) => {
    const event = useVMvalue(eventVM)

    const { id, date, endDate, deleted, title, description, attendees, geo, imageURL } = event;

    const nav = useSSRReadyNavigate()
    const onClick = React.useCallback(() => {
        nav(`/tg/editEvent?editEvent=${id}`)
    }, [id])

    const timeZone = React.useContext(TimezoneContext);
    const timeDisplay = React.useMemo(() => {
        const startDate = new Date(date + getOffset(timeZone));
        const endDateObj = new Date(endDate + getOffset(timeZone));

        // Normalize dates to day boundaries (ignore time)
        const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
        const endDay = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate()).getTime();

        // If displayDate is provided (month view), use it; otherwise use event start date (upcoming view)
        const currentDisplayDate = displayDate ? new Date(displayDate + getOffset(timeZone)) : startDate;
        const currentDay = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), currentDisplayDate.getDate()).getTime();

        const startsOnDisplayDay = startDay === currentDay;
        const endsOnDisplayDay = endDay === currentDay;
        const isMultiDay = startDay !== endDay;

        if (!isMultiDay) {
            // Event starts and ends on the same day: show both start and end times
            const startTime = new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });
            const endTime = new Date(endDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });
            return [startTime, endTime];
        }

        if (startsOnDisplayDay && !endsOnDisplayDay) {
            // Event starts today and continues to another day: show only start time
            const startTime = new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });
            return [startTime];
        }

        if (!startsOnDisplayDay && endsOnDisplayDay) {
            // Event started earlier and ends today: show "Ends HH:MM"
            const endTime = new Date(endDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });
            return ['Ends', endTime];
        }

        // Event is ongoing (started earlier and continues after this day): show "all-day"
        return ['all-day'];
    }, [date, endDate, timeZone, displayDate]);

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
            right={<div style={{ fontSize: '1.2em', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                {timeDisplay.map((time, i) => <span key={i}>{time}</span>)}
            </div>}
        />
    </>
})


let amimateDateOnce = true


let _datesObserver: IntersectionObserver | undefined
const getDatesObserver = () => {
    if (!_datesObserver) {
        _datesObserver = new IntersectionObserver((ev) => {
            ev.forEach(e => {
                const isTop = e.intersectionRatio < 1 && ((e.target as HTMLDivElement).offsetTop - document.documentElement.scrollTop < 100);
                (e.target as HTMLDivElement).style.fontSize = isTop ? '1em' : '0.7em';
            })
        }, { root: null, rootMargin: '0px', threshold: [1] });
    }
    return _datesObserver
}

const DateView = React.memo(({ text: date, time, isFirst, isHeader }: { text: string, time: number, isFirst?: boolean, isHeader?: boolean }) => {
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

    const ref = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const target = ref.current
        if (isHeader && !isFirst && target) {
            getDatesObserver().observe(target)
        }
        return () => {
            if (target) {
                getDatesObserver().unobserve(target)
            }
        }
    }, [isHeader])

    return <div ref={ref} style={{
        position: 'sticky',
        top: -16,
        zIndex: 3,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignSelf: 'center',
        padding: `32px 16px 16px 16px`,
        margin: `0 16px`,
        marginTop: -16,
        backgroundColor: isFirst ? 'var(--tg-theme-secondary-bg-color)' : undefined,
        transition: 'font-size 100ms ease-out',
        fontSize: isHeader && isFirst ? '1em' : '0.7em',
        pointerEvents: 'none'
    }}>
        <Card
            onClick={onClick}
            key={'date'}
            style={{
                alignSelf: 'center',
                margin: 0,
                padding: 0,
                borderRadius: 12,
                transition: "max-height ease-in 300ms",
                maxHeight,
                overflow: 'hidden',
                pointerEvents: 'all'
            }}>
            <ListItem style={{ height: 16, padding: 4 }} titile={date} titleStyle={{ padding: 0, fontWeight: 500 }} leftStyle={{ padding: '0 4px' }} />
        </Card>
    </div>
});

const _offsets = new Map<string, number>()
const getOffset = (timeZone?: string) => {
    if (!timeZone) {
        return 0
    }
    let offset = _offsets.get(timeZone)
    if (offset === undefined) {
        const date = new Date()
        const currentTZDate = new Date(date.toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
        const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
        offset = (tzDate.getTime() - currentTZDate.getTime());
        _offsets.set(timeZone, offset)
    }
    return offset
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const currentYear = new Date().getFullYear()
const EventsView = React.memo((({ eventsVM, mode }: { eventsVM: VM<Map<string, VM<Event>>>, mode: 'upcoming' | 'month' }) => {
    const showDates = mode === 'upcoming';
    const timeZone = React.useContext(TimezoneContext);
    const eventsMap = useVMvalue(eventsVM);
    const { selectedDate } = React.useContext(SelectedDateContext);
    const events = React.useMemo(() => {
        const events: { vm: VM<Event>, date: string, time: number, displayDate: number }[] = [];
        for (let vm of eventsMap.values()) {
            const date = new Date(vm.val.date + getOffset(timeZone))
            const dateYear = date.getFullYear()
            const dateStr = `${date.getDate()} ${months[date.getMonth()]}${currentYear !== dateYear ? `, ${dateYear}` : ''}`;
            // In month mode, use selectedDate as display date; in upcoming mode, use event start date
            const displayDate = mode === 'month' && selectedDate ? selectedDate : vm.val.date;
            events.push({ vm, date: dateStr, time: vm.val.date, displayDate })
        }
        return events
    }, [eventsMap, mode, selectedDate]);

    const { selectDate, startDate } = React.useContext(SelectedDateContext);
    const onClick = React.useCallback(() => {
        selectDate(startDate, { openCal: true });
    }, [selectDate, startDate]);

    if (eventsMap.size === 0) {
        return <CardLight onClick={onClick}>
            <DateView
                text={`🗓️ no ${mode === 'upcoming' ? 'upcoming events' : 'events at this date'}`}
                isFirst={mode === 'upcoming'}
                time={startDate}
                isHeader={false}
            />
        </CardLight>
    }

    let prevDate: string | undefined = undefined;
    return <>

        <Page >{events.map(({ vm, date, time, displayDate }, i) => {
            const show = timeZone && (date !== prevDate);
            prevDate = date;
            return <React.Fragment key={vm.val.id}>

                {(showDates && show && date) ?
                    <DateView text={date} time={time} isFirst={i === 0} isHeader={mode === 'upcoming'} /> :
                    i !== 0 ?
                        <div style={{ width: '100%', borderBottom: '1px solid rgba(127, 127, 127, .1)' }} /> :
                        null}

                <div style={{ paddingTop: i === 0 ? 16 : 0 }}>
                    <EventItem key={vm.val.id} eventVM={vm} displayDate={displayDate} />
                </div>
            </React.Fragment>
        })}</Page>

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