// RRule helper functions for parsing and building recurrence rules

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export const WEEKDAYS = [
    { short: 'MO', full: 'Monday' },
    { short: 'TU', full: 'Tuesday' },
    { short: 'WE', full: 'Wednesday' },
    { short: 'TH', full: 'Thursday' },
    { short: 'FR', full: 'Friday' },
    { short: 'SA', full: 'Saturday' },
    { short: 'SU', full: 'Sunday' },
] as const;

export const ORDINALS = [
    { value: 1, label: 'first' },
    { value: 2, label: 'second' },
    { value: 3, label: 'third' },
    { value: 4, label: 'fourth' },
    { value: -1, label: 'last' },
] as const;

export const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

export interface ParsedRRule {
    freq?: Frequency;
    interval?: number;
    byDay?: number[];  // Array of weekday indices (0=Monday, 6=Sunday)
    bySetPos?: number; // Ordinal position (1=first, 2=second, -1=last)
    byDayForSetPos?: number; // Weekday index for BYSETPOS
    byMonth?: number[]; // Array of month numbers (1-12)
}

export interface RRuleOptions {
    freq: Frequency;
    interval?: number;
    byDay?: number[];
    bySetPos?: number;
    byDayForSetPos?: number;
    byMonth?: number[];
}

// Parse RRule string into components
export function parseRRule(rrule: string): ParsedRRule {
    if (!rrule) return {};

    const result: ParsedRRule = {};

    // Parse FREQ
    const freqMatch = rrule.match(/FREQ=(\w+)/);
    if (freqMatch) {
        result.freq = freqMatch[1] as Frequency;
    }

    // Parse INTERVAL
    const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
    if (intervalMatch) {
        result.interval = parseInt(intervalMatch[1], 10);
    }

    // Parse BYDAY (can be like "MO,TU,WE" or "1MO" for first Monday)
    const byDayMatch = rrule.match(/BYDAY=([^;]+)/);
    if (byDayMatch) {
        const byDayStr = byDayMatch[1];
        const days: number[] = [];
        let setPos: number | undefined;
        let setPosDay: number | undefined;

        // Check for ordinal prefix like "1MO", "2TU", "-1FR"
        const ordinalDayMatch = byDayStr.match(/^(-?\d+)(\w{2})$/);
        if (ordinalDayMatch) {
            setPos = parseInt(ordinalDayMatch[1], 10);
            const dayCode = ordinalDayMatch[2];
            const dayIndex = WEEKDAYS.findIndex(w => w.short === dayCode);
            if (dayIndex !== -1) {
                setPosDay = dayIndex;
            }
            result.bySetPos = setPos;
            result.byDayForSetPos = setPosDay;
        } else {
            // Parse comma-separated days
            const dayParts = byDayStr.split(',');
            for (const part of dayParts) {
                const dayIndex = WEEKDAYS.findIndex(w => w.short === part.trim());
                if (dayIndex !== -1) {
                    days.push(dayIndex);
                }
            }
            if (days.length > 0) {
                result.byDay = days;
            }
        }
    }

    // Parse BYSETPOS (separate from BYDAY)
    const bySetPosMatch = rrule.match(/BYSETPOS=(-?\d+)/);
    if (bySetPosMatch) {
        result.bySetPos = parseInt(bySetPosMatch[1], 10);
    }

    // Parse BYMONTH
    const byMonthMatch = rrule.match(/BYMONTH=([^;]+)/);
    if (byMonthMatch) {
        const months = byMonthMatch[1].split(',').map(m => parseInt(m.trim(), 10));
        result.byMonth = months.filter(m => m >= 1 && m <= 12);
    }

    return result;
}

// Build RRule string from options
export function buildRRule(options: RRuleOptions): string {
    const parts: string[] = [];

    parts.push(`FREQ=${options.freq}`);

    if (options.interval && options.interval > 1) {
        parts.push(`INTERVAL=${options.interval}`);
    }

    // Handle BYDAY for weekly frequency
    if (options.freq === 'WEEKLY' && options.byDay && options.byDay.length > 0) {
        const dayStrs = options.byDay.map(d => WEEKDAYS[d].short);
        parts.push(`BYDAY=${dayStrs.join(',')}`);
    }

    // Handle ordinal weekday (e.g., first Monday)
    if (options.bySetPos !== undefined && options.byDayForSetPos !== undefined) {
        const dayStr = WEEKDAYS[options.byDayForSetPos].short;
        parts.push(`BYDAY=${options.bySetPos}${dayStr}`);
    }

    // Handle BYMONTH for yearly frequency
    if (options.freq === 'YEARLY' && options.byMonth && options.byMonth.length > 0) {
        parts.push(`BYMONTH=${options.byMonth.join(',')}`);
    }

    return parts.join(';');
}

// Generate human-readable label for recurrence
export function recurrenceToDetailedLabel(rrule: string): string {
    if (!rrule) return 'Never';

    const parsed = parseRRule(rrule);
    if (!parsed.freq) return 'Custom';

    const interval = parsed.interval || 1;

    switch (parsed.freq) {
        case 'DAILY':
            return interval === 1 ? 'Every day' : `Every ${interval} days`;

        case 'WEEKLY':
            if (parsed.byDay && parsed.byDay.length > 0) {
                const dayNames = parsed.byDay.map(d => WEEKDAYS[d].full);
                const prefix = interval === 1 ? 'Every week' : `Every ${interval} weeks`;
                return `${prefix} on ${dayNames.join(', ')}`;
            }
            return interval === 1 ? 'Every week' : `Every ${interval} weeks`;

        case 'MONTHLY':
            const monthPrefix = interval === 1 ? 'Every month' : `Every ${interval} months`;
            if (parsed.bySetPos !== undefined && parsed.byDayForSetPos !== undefined) {
                const ordinal = ORDINALS.find(o => o.value === parsed.bySetPos)?.label || '';
                const day = WEEKDAYS[parsed.byDayForSetPos].full;
                return `${monthPrefix} on the ${ordinal} ${day}`;
            }
            return monthPrefix;

        case 'YEARLY':
            const yearPrefix = interval === 1 ? 'Every year' : `Every ${interval} years`;
            const parts: string[] = [yearPrefix];

            if (parsed.byMonth && parsed.byMonth.length > 0) {
                const monthNames = parsed.byMonth.map(m => MONTHS[m - 1]);
                if (parsed.bySetPos !== undefined && parsed.byDayForSetPos !== undefined) {
                    const ordinal = ORDINALS.find(o => o.value === parsed.bySetPos)?.label || '';
                    const day = WEEKDAYS[parsed.byDayForSetPos].full;
                    return `${yearPrefix} on the ${ordinal} ${day} of ${monthNames.join(', ')}`;
                }
                return `${yearPrefix} in ${monthNames.join(', ')}`;
            }

            return yearPrefix;

        default:
            return 'Custom';
    }
}
