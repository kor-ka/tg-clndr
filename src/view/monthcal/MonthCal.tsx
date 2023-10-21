import React from "react";

enum WEEK_START {
    SYNDAY = 0,
    MONDAY = 1
}
export const dayViewHeight = 48;
export const calTitleHeight = 48;

export const SelectedDateContext = React.createContext<{ date: number, selectDate: (date: number) => void }>({ date: new Date().getTime(), selectDate: () => { } })

const Day = React.memo(({ date, otherMonth }: { date: Date, otherMonth: boolean }) => {
    const { date: selectedDate, selectDate } = React.useContext(SelectedDateContext);
    const selected = (date.getTime() === selectedDate && !otherMonth);

    const onClick = React.useCallback(() => {
        selectDate(date.getTime());
    }, [date, selectDate]);


    return <div
        style={{
            display: 'flex',
            width: 'calc(100%/7)',
            height: dayViewHeight,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: otherMonth ? .3 : undefined
        }}
        onClick={!otherMonth ? onClick : undefined}
    >
        <div style={{
            display: 'flex',
            width: dayViewHeight - 16,
            height: dayViewHeight - 16,
            justifyContent: 'center',
            alignItems: 'center',

            borderRadius: dayViewHeight - 16,
            textAlign: 'center',
            color: selected ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-button-text)',
            backgroundColor: selected ? 'var(--tg-theme-button-color)' : undefined,

        }}>
            <div style={{ display: 'flex' }}>{date.getDate()}</div>
        </div>
    </div>
})

const Week = React.memo(({ days, monthStart }: { days: Date[], monthStart: Date }) => {
    const month = React.useMemo(() => monthStart.getMonth(), [monthStart])
    return <div className="week" style={{ display: 'flex', flexDirection: 'row' }}>
        {days.map(d => <Day date={d} otherMonth={d.getMonth() !== month} />)}
    </div>
})

const Month = React.memo(({ startDate, autofocus, intersectionObserver }: { startDate: Date, autofocus?: boolean, intersectionObserver?: IntersectionObserver }) => {
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
        if (autofocus && titleRef.current) {
            titleRef.current.scrollIntoView()
        }
    }, [autofocus])

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
            flexDirection: 'column',
            alignItems: 'flex-start',
            scrollSnapAlign: 'start'
        }}>
        <div ref={titleRef} style={{ display: 'flex', height: calTitleHeight, alignItems: 'center', paddingLeft: 24, fontWeight: 600 }}>{startDate.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch' }}>
            {weeks.map(d => <Week days={d} monthStart={startDate} />)}
        </div>
    </div>
})

export const MonthCalendar = React.memo(({ show }: { show: boolean }) => {
    const [months, startDate] = React.useMemo(() => {
        const now = new Date()
        const month = now.getMonth();
        const year = now.getFullYear();
        const startDate = new Date(year, month, 1)
        console.log(startDate)
        const months: Date[] = [startDate];
        for (let i = 1; i <= 12; i++) {
            months.unshift(new Date(year, month - i, 1));
            months.push(new Date(year, month + i, 1));
        }

        return [months, startDate]
    }, [])

    const [intersectionObserver, setIntersectionObserver] = React.useState<IntersectionObserver>()
    const containerRef = React.useRef<HTMLDivElement>(null)

    const { date: selectedDate, selectDate } = React.useContext(SelectedDateContext);
    const selectedDateRef = React.useRef(new Date(selectedDate));
    selectedDateRef.current = new Date(selectedDate);

    const onMonthSelected = React.useCallback((date: number) => {
        if (!selectedDateRef.current || (new Date(selectedDateRef.current).getMonth() !== new Date(date).getMonth())) {
            selectDate(date)
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

    if (typeof window === 'undefined') {
        return null
    }
    return <>
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: 7 * dayViewHeight,
                overflow: 'scroll',
                scrollSnapType: 'y mandatory',
                backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            }}>
            {months.map((d, i) =>
                <Month
                    startDate={d}
                    autofocus={(d.getFullYear() === selectedDateRef.current.getFullYear() && d.getMonth() === selectedDateRef.current.getMonth()) && show}
                    intersectionObserver={intersectionObserver}
                />)}
        </div>
    </>
})