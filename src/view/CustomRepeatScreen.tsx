import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ListItem, Card, Page } from "./uikit/kit";
import { BackButtonController } from "./uikit/tg/BackButtonController";
import { MainButtonController } from "./uikit/tg/MainButtonController";
import { Switch } from "./uikit/mark42/Switch";
import { parseRRule, buildRRule, Frequency, WEEKDAYS, ORDINALS, MONTHS } from "../shared/rruleHelpers";
import "./CustomRepeatScreen.css";

type FrequencyOption = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

const FrequencyLabels: Record<FrequencyOption, string> = {
    DAILY: 'Daily',
    WEEKLY: 'Weekly',
    MONTHLY: 'Monthly',
    YEARLY: 'Yearly',
};

const IntervalLabels: Record<FrequencyOption, { singular: string; plural: string }> = {
    DAILY: { singular: 'day', plural: 'days' },
    WEEKLY: { singular: 'week', plural: 'weeks' },
    MONTHLY: { singular: 'month', plural: 'months' },
    YEARLY: { singular: 'year', plural: 'years' },
};

const CustomRepeatScreen = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialRRule = searchParams.get("rrule") || "";
    const returnPath = searchParams.get("returnPath") || "/tg/addEvent";

    // Parse initial RRule
    const parsed = React.useMemo(() => parseRRule(initialRRule), [initialRRule]);

    // State
    const [frequency, setFrequency] = React.useState<FrequencyOption>(parsed.freq as FrequencyOption || 'DAILY');
    const [interval, setInterval] = React.useState(parsed.interval || 1);
    const [selectedWeekdays, setSelectedWeekdays] = React.useState<number[]>(parsed.byDay || []);
    const [monthlyMode, setMonthlyMode] = React.useState<'each' | 'onThe'>(parsed.bySetPos ? 'onThe' : 'each');
    const [ordinal, setOrdinal] = React.useState(parsed.bySetPos || 1);
    const [ordinalWeekday, setOrdinalWeekday] = React.useState(parsed.byDayForSetPos ?? 0);
    const [selectedMonths, setSelectedMonths] = React.useState<number[]>(parsed.byMonth || [1]);
    const [yearlyDaysOfWeek, setYearlyDaysOfWeek] = React.useState(parsed.bySetPos !== undefined && parsed.freq === 'YEARLY');

    // Show frequency dropdown
    const [showFrequencyPicker, setShowFrequencyPicker] = React.useState(false);

    // Build description text
    const descriptionText = React.useMemo(() => {
        const intervalLabel = interval === 1
            ? IntervalLabels[frequency].singular
            : `${interval} ${IntervalLabels[frequency].plural}`;

        let base = `Event will occur every ${intervalLabel}`;

        if (frequency === 'WEEKLY' && selectedWeekdays.length > 0) {
            const days = selectedWeekdays.map(d => WEEKDAYS[d].full).join(', ');
            base += ` on ${days}`;
        }

        if (frequency === 'MONTHLY' && monthlyMode === 'onThe') {
            const ordinalLabel = ORDINALS[ordinal - 1]?.label || ORDINALS[ORDINALS.length - 1].label;
            base += ` on the ${ordinalLabel} ${WEEKDAYS[ordinalWeekday].full}`;
        }

        if (frequency === 'YEARLY') {
            const monthNames = selectedMonths.map(m => MONTHS[m - 1]).join(', ');
            if (yearlyDaysOfWeek) {
                const ordinalLabel = ORDINALS[ordinal - 1]?.label || ORDINALS[ORDINALS.length - 1].label;
                base += ` on the ${ordinalLabel} ${WEEKDAYS[ordinalWeekday].full} of ${monthNames}`;
            } else if (selectedMonths.length > 0) {
                base = `Event will occur every ${interval === 1 ? 'year' : `${interval} years`} in ${monthNames}`;
            }
        }

        return base + '.';
    }, [frequency, interval, selectedWeekdays, monthlyMode, ordinal, ordinalWeekday, selectedMonths, yearlyDaysOfWeek]);

    // Toggle weekday selection
    const toggleWeekday = React.useCallback((dayIndex: number) => {
        setSelectedWeekdays(prev => {
            if (prev.includes(dayIndex)) {
                return prev.filter(d => d !== dayIndex);
            }
            return [...prev, dayIndex].sort((a, b) => a - b);
        });
    }, []);

    // Toggle month selection
    const toggleMonth = React.useCallback((monthNum: number) => {
        setSelectedMonths(prev => {
            if (prev.includes(monthNum)) {
                if (prev.length === 1) return prev; // Keep at least one month
                return prev.filter(m => m !== monthNum);
            }
            return [...prev, monthNum].sort((a, b) => a - b);
        });
    }, []);

    // Handle save
    const onSave = React.useCallback(() => {
        const rrule = buildRRule({
            freq: frequency,
            interval,
            byDay: frequency === 'WEEKLY' ? selectedWeekdays : undefined,
            bySetPos: (frequency === 'MONTHLY' && monthlyMode === 'onThe') || (frequency === 'YEARLY' && yearlyDaysOfWeek) ? ordinal : undefined,
            byDayForSetPos: (frequency === 'MONTHLY' && monthlyMode === 'onThe') || (frequency === 'YEARLY' && yearlyDaysOfWeek) ? ordinalWeekday : undefined,
            byMonth: frequency === 'YEARLY' ? selectedMonths : undefined,
        });

        // Navigate back with the RRule as a query parameter
        const separator = returnPath.includes('?') ? '&' : '?';
        navigate(`${returnPath}${separator}rrule=${encodeURIComponent(rrule)}`, { replace: true });
    }, [frequency, interval, selectedWeekdays, monthlyMode, ordinal, ordinalWeekday, selectedMonths, yearlyDaysOfWeek, returnPath, navigate]);

    return (
        <Page>
            <BackButtonController />
            <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 0px' }}>
                <h2 style={{ textAlign: 'center', margin: '0 0 16px 0' }}>Custom</h2>

                {/* Frequency and Interval Card */}
                <Card>
                    <ListItem
                        titile="Frequency"
                        right={
                            <div
                                className="frequency-selector"
                                onClick={() => setShowFrequencyPicker(!showFrequencyPicker)}
                            >
                                {FrequencyLabels[frequency]}
                                <span className="chevron">&#8963;</span>
                            </div>
                        }
                    />
                    {showFrequencyPicker && (
                        <div className="frequency-dropdown">
                            {(Object.keys(FrequencyLabels) as FrequencyOption[]).map(freq => (
                                <div
                                    key={freq}
                                    className={`frequency-option ${frequency === freq ? 'selected' : ''}`}
                                    onClick={() => {
                                        setFrequency(freq);
                                        setShowFrequencyPicker(false);
                                    }}
                                >
                                    {FrequencyLabels[freq]}
                                    {frequency === freq && <span className="checkmark">&#10003;</span>}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="divider" />
                    <ListItem
                        titile="Every"
                        right={
                            <span style={{ color: 'var(--tg-theme-link-color)' }}>
                                {interval === 1 ? IntervalLabels[frequency].singular.charAt(0).toUpperCase() + IntervalLabels[frequency].singular.slice(1) : `${interval} ${IntervalLabels[frequency].plural}`}
                            </span>
                        }
                    />
                </Card>

                {/* Interval Picker */}
                <Card>
                    <div className="picker-container">
                        <div className="picker-wheel">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                                <div
                                    key={num}
                                    className={`picker-item ${interval === num ? 'selected' : ''}`}
                                    onClick={() => setInterval(num)}
                                >
                                    {num}
                                </div>
                            ))}
                        </div>
                        <div className="picker-wheel">
                            <div className="picker-item selected">
                                {interval === 1 ? IntervalLabels[frequency].singular : IntervalLabels[frequency].plural}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Description */}
                <div className="description-text">
                    {descriptionText}
                </div>

                {/* Weekly: Day selection */}
                {frequency === 'WEEKLY' && (
                    <Card>
                        {WEEKDAYS.map((day, index) => (
                            <React.Fragment key={day.short}>
                                <ListItem
                                    titile={day.full}
                                    onClick={() => toggleWeekday(index)}
                                    right={selectedWeekdays.includes(index) ? <span className="checkmark-red">&#10003;</span> : null}
                                />
                                {index < WEEKDAYS.length - 1 && <div className="divider" />}
                            </React.Fragment>
                        ))}
                    </Card>
                )}

                {/* Monthly: Each vs On the... */}
                {frequency === 'MONTHLY' && (
                    <>
                        <Card>
                            <ListItem
                                titile="Each"
                                onClick={() => setMonthlyMode('each')}
                                right={monthlyMode === 'each' ? <span className="checkmark-red">&#10003;</span> : null}
                            />
                            <div className="divider" />
                            <ListItem
                                titile="On the..."
                                onClick={() => setMonthlyMode('onThe')}
                                right={monthlyMode === 'onThe' ? <span className="checkmark-red">&#10003;</span> : null}
                            />
                        </Card>

                        {monthlyMode === 'onThe' && (
                            <Card>
                                <div className="picker-container">
                                    <div className="picker-wheel">
                                        {ORDINALS.map(ord => (
                                            <div
                                                key={ord.value}
                                                className={`picker-item ${ordinal === ord.value ? 'selected' : ''}`}
                                                onClick={() => setOrdinal(ord.value)}
                                            >
                                                {ord.label}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="picker-wheel">
                                        {WEEKDAYS.map((day, index) => (
                                            <div
                                                key={day.short}
                                                className={`picker-item ${ordinalWeekday === index ? 'selected' : ''}`}
                                                onClick={() => setOrdinalWeekday(index)}
                                            >
                                                {day.full}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        )}
                    </>
                )}

                {/* Yearly: Month selection */}
                {frequency === 'YEARLY' && (
                    <>
                        <Card>
                            <div className="months-grid">
                                {MONTHS.map((month, index) => (
                                    <div
                                        key={month}
                                        className={`month-item ${selectedMonths.includes(index + 1) ? 'selected' : ''}`}
                                        onClick={() => toggleMonth(index + 1)}
                                    >
                                        {month}
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card>
                            <ListItem
                                titile="Days of Week"
                                right={
                                    <Switch
                                        checked={yearlyDaysOfWeek}
                                        onChange={(e) => setYearlyDaysOfWeek(e.target.checked)}
                                    />
                                }
                            />
                        </Card>

                        {yearlyDaysOfWeek && (
                            <Card>
                                <div className="picker-container">
                                    <div className="picker-wheel">
                                        {ORDINALS.map(ord => (
                                            <div
                                                key={ord.value}
                                                className={`picker-item ${ordinal === ord.value ? 'selected' : ''}`}
                                                onClick={() => setOrdinal(ord.value)}
                                            >
                                                {ord.label}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="picker-wheel">
                                        {WEEKDAYS.map((day, index) => (
                                            <div
                                                key={day.short}
                                                className={`picker-item ${ordinalWeekday === index ? 'selected' : ''}`}
                                                onClick={() => setOrdinalWeekday(index)}
                                            >
                                                {day.full}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        )}
                    </>
                )}
            </div>
            <MainButtonController isVisible={true} onClick={onSave} text="Done" />
        </Page>
    );
};

export default CustomRepeatScreen;
