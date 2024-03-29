import React from "react";
import { SessionModel } from "../../model/SessionModel";
import { useVMvalue } from "../../utils/vm/useVM";
import { isAndroid } from "../utils/webapp";
import { WithModel } from "../utils/withModelHOC";
import { SelectedDateContext, dayViewHeight, calTitleHeight, calHeight } from "./shared";

enum WEEK_START {
    SYNDAY = 0,
    MONDAY = 1
}

const selectedCircleSize = dayViewHeight - 22;

const Day = WithModel(React.memo(({ date, otherMonth, model }: { date: Date, otherMonth: boolean, model: SessionModel }) => {
    const { selectedDate: selectedDate, selectDate } = React.useContext(SelectedDateContext);

    const events = useVMvalue(model.eventsModule.getDateModel(date.getTime()).events)
    const eventsCount = events.size
    const imageURL = React.useMemo(() => {
        // not that reactive, but who cares
        return [...events.values()].find(e => e.val.imageURL)?.val.imageURL
    }, [events])

    const isSelected = (date.getTime() === selectedDate && !otherMonth);

    const isToday = React.useMemo(() => {
        const today = new Date()
        return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
    }, [date])

    const onClick = React.useCallback(() => {
        selectDate(date.getTime());
    }, [date, selectDate]);

    return <div
        style={{
            display: 'flex',
            flexDirection: 'column',
            width: 'calc(100%/7)',
            height: dayViewHeight,
            justifyContent: 'start',
            alignItems: 'center',
            gap: 4,
            opacity: otherMonth ? .3 : undefined
        }}
        onClick={!otherMonth ? onClick : undefined}
    >
        <div style={{
            boxSizing: 'border-box',
            display: 'flex',
            width: selectedCircleSize,
            height: selectedCircleSize,
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            borderRadius: imageURL ? 8 : selectedCircleSize,
            border: `2px solid ${isSelected ? 'var(--tg-theme-button-color)' : isToday ? 'var(--tg-theme-text-color)' : 'transparent'}`,
            color: (isToday && !imageURL) ? 'var(--tg-theme-bg-color)' : (isSelected || !!imageURL) ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
            background: imageURL ? `url(${imageURL}) center center / cover no-repeat border-box` : undefined,
            backgroundColor: isToday ? 'var(--tg-theme-text-color)' : isSelected ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',

        }}>
            <div style={{ display: 'flex' }}>{date.getDate()}</div>
        </div>
        {!!eventsCount && <div style={{ width: 4, height: 4, borderRadius: 4, backgroundColor: 'var(--tg-theme-hint-color)' }} />}
    </div>
}))

const Week = React.memo(({ days, monthStart }: { days: Date[], monthStart: Date }) => {
    const month = React.useMemo(() => monthStart.getMonth(), [monthStart])
    return <div className="week" style={{ display: 'flex', flexDirection: 'row' }}>
        {days.map(d => <Day date={d} otherMonth={d.getMonth() !== month} />)}
    </div>
})

const Month = React.memo(({ startDate, scrollInto, intersectionObserver }: { startDate: Date, scrollInto?: { date: number }, intersectionObserver?: IntersectionObserver }) => {
    const weeks = React.useMemo(() => {
        const weekDay = (startDate.getDay() + 7 - WEEK_START.MONDAY) % 7
        const weeksCount = 6

        const weeks: Date[][] = []
        let day = 0
        for (let i = 0; i < weeksCount; i++) {
            const week: Date[] = []
            let daysCount = 7
            const weekStartTime = startDate.getTime() - 1000 * 60 * 60 * 24 * weekDay
            for (let weekDay = 0; weekDay < daysCount; weekDay++) {
                week.push(new Date(weekStartTime + 1000 * 60 * 60 * 24 * day++))
            }
            weeks.push(week)
        }
        return weeks
    }, [startDate])

    const titleRef = React.useRef<HTMLDivElement>(null)
    React.useEffect(() => {
        if (scrollInto && containerRef.current) {
            containerRef.current.scrollIntoView()
        }
    }, [scrollInto])

    const containerRef = React.useRef<HTMLDivElement>(null)
    React.useEffect(() => {
        const target = containerRef.current
        if (intersectionObserver && target) {
            intersectionObserver.observe(target);
        }
        return () => {
            if (intersectionObserver && target) {
                intersectionObserver.unobserve(target)
            }
        }
    }, [startDate, weeks.length, intersectionObserver])

    return <div
        data-date={startDate.getTime()}
        ref={containerRef}
        style={{
            display: 'flex',
            width: '100%',
            flexShrink: 0,
            flexDirection: 'column',
            alignItems: 'flex-start',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
        }}>
        <div ref={titleRef} style={{ display: 'flex', alignSelf: 'flex-end', height: calTitleHeight, alignItems: 'center', paddingRight: 20, fontWeight: 600 }}>{startDate.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch' }}>
            {weeks.map(d => <Week days={d} monthStart={startDate} />)}
        </div>
    </div>
})

const MonthCalendar = WithModel(React.memo(({ show, model, scrollInto }: { show: boolean, model: SessionModel, scrollInto?: { date: number } }) => {
    const [months, monthStartDate] = React.useMemo(() => {
        const now = new Date()
        const month = now.getMonth();
        const year = now.getFullYear();
        const startDate = new Date(year, month, 1)
        const months: Date[] = [startDate];
        for (let i = 1; i <= 12; i++) {
            months.unshift(new Date(year, month - i, 1));
            months.push(new Date(year, month + i, 1));
        }

        return [months, startDate]
    }, [])

    const [intersectionObserver, setIntersectionObserver] = React.useState<IntersectionObserver>()
    const containerRef = React.useRef<HTMLDivElement>(null)

    const { selectedDate, selectDate, startDate, closeCal } = React.useContext(SelectedDateContext);
    // refs used to prevent IntersectionObserver from re createing
    const selectedDateRef = React.useRef(selectedDate && new Date(selectedDate));
    selectedDateRef.current = selectedDate && new Date(selectedDate);
    const selectDateRef = React.useRef(selectDate);
    selectDateRef.current = selectDate;

    const activateMonthsAround = React.useCallback((time: number) => {
        const date = new Date(time);
        model.eventsModule.acivateMonthOnce(time);
        model.eventsModule.acivateMonthOnce(new Date(date.getFullYear(), date.getMonth() - 1).getTime());
        model.eventsModule.acivateMonthOnce(new Date(date.getFullYear(), date.getMonth() + 1).getTime())
    }, [])

    // load initial data
    React.useEffect(() => {
        let loadAround = monthStartDate
        if (selectedDate) {
            loadAround = new Date(selectedDate)
            loadAround.setDate(1)
        }
        activateMonthsAround(loadAround.getTime())
    }, [])

    const onMonthSelected = React.useCallback((time: number) => {
        const date = new Date(time)
        if (!selectedDateRef.current || (new Date(selectedDateRef.current).getMonth() !== date.getMonth())) {
            selectDateRef.current?.(time);
            activateMonthsAround(time);
        }
    }, [])

    React.useEffect(() => {
        if (containerRef.current) {
            const prevRatios = new Map<Element, number>()
            const observer = new IntersectionObserver((ev) => {
                ev.forEach(e => {
                    const prev = prevRatios.get(e.target) ?? 0
                    if (e.intersectionRatio > prev && e.intersectionRatio > 0.5) {
                        onMonthSelected(Number(e.target.getAttribute('data-date')))
                    }
                    prevRatios.set(e.target, e.intersectionRatio)
                })
            }, { root: containerRef.current, rootMargin: '0px', threshold: [0, .25, .51, .75, 1] });
            setIntersectionObserver(observer)
        }

    }, [])

    const todayClick = React.useCallback(() => {
        if (startDate === selectedDate) {
            closeCal();
        } else {
            selectDate(startDate, { forceScroll: true });

        }
    }, [selectDate, selectedDate, startDate, closeCal]);

    const useHorisontal = React.useMemo(() => isAndroid(), []);

    if (typeof window === 'undefined') {
        return null;
    }

    return <>
        <div
            ref={containerRef}
            style={{
                display: 'flex',
                flexDirection: useHorisontal ? 'row' : 'column',
                width: '100%',
                height: calHeight,
                overflowX: useHorisontal ? 'scroll' : undefined,
                overflowY: useHorisontal ? undefined : 'scroll',
                scrollSnapType: `${useHorisontal ? 'x' : 'y'} mandatory`,
                backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            }}>
            {months.map((d, i) =>
                <Month
                    startDate={d}
                    scrollInto={(d.getTime() === scrollInto?.date) ? scrollInto : undefined}
                    intersectionObserver={intersectionObserver}
                />)}
        </div>
        <div style={{ position: 'fixed', top: 0, left: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', height: calTitleHeight, }}>
            <button className="gost" onClick={todayClick}>Today</button>
        </div>
    </>
}))

export default MonthCalendar