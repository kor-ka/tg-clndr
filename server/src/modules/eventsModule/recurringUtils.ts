import { RRule, RRuleSet, rrulestr } from 'rrule';
import { v4 as uuidv4 } from 'uuid';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export interface MaterializedEventData {
    date: number;
    endDate: number;
    recurringGroupId: string;
    recurringEventId: string;
}

/**
 * Parse an RRule string and generate occurrences within a date range
 */
export function generateOccurrences(
    rruleString: string,
    startDate: Date,
    eventDuration: number,
    fromDate: Date,
    untilDate: Date
): { date: Date; endDate: Date }[] {
    const rrule = rrulestr(rruleString, { dtstart: startDate });
    const occurrences = rrule.between(fromDate, untilDate, true);

    return occurrences.map(date => ({
        date,
        endDate: new Date(date.getTime() + eventDuration)
    }));
}

/**
 * Calculate the materialization horizon (1 year from now by default)
 */
export function getMaterializationHorizon(): number {
    return Date.now() + ONE_YEAR_MS;
}

/**
 * Generate a new recurring group ID
 */
export function generateRecurringGroupId(): string {
    return uuidv4();
}

/**
 * Materialize recurring events from the template event
 * Returns array of event data to be inserted
 */
export function materializeRecurringEvents(
    templateEvent: {
        date: number;
        endDate: number;
        rrule: string;
    },
    recurringGroupId: string,
    templateEventId: string,
    fromDate?: number,
    untilDate?: number
): MaterializedEventData[] {
    const eventDuration = templateEvent.endDate - templateEvent.date;
    const startDate = new Date(templateEvent.date);

    const from = fromDate ? new Date(fromDate) : startDate;
    const until = untilDate ? new Date(untilDate) : new Date(getMaterializationHorizon());

    const occurrences = generateOccurrences(
        templateEvent.rrule,
        startDate,
        eventDuration,
        from,
        until
    );

    // Skip the first occurrence if it matches the template event date (already exists as template)
    const filteredOccurrences = occurrences.filter(occ =>
        occ.date.getTime() !== templateEvent.date
    );

    return filteredOccurrences.map(occ => ({
        date: occ.date.getTime(),
        endDate: occ.endDate.getTime(),
        recurringGroupId,
        recurringEventId: templateEventId
    }));
}

/**
 * Check if we need to extend materialization for a recurring group
 * Returns true if horizon is less than 30 days away
 */
export function needsMaterialization(currentHorizon: number): boolean {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return currentHorizon - Date.now() < thirtyDaysMs;
}

/**
 * Validate an RRule string
 */
export function validateRRule(rruleString: string): { valid: boolean; error?: string } {
    try {
        rrulestr(rruleString);
        return { valid: true };
    } catch (e) {
        return {
            valid: false,
            error: e instanceof Error ? e.message : 'Invalid RRule string'
        };
    }
}

/**
 * Create a simple RRule string from common parameters
 */
export function createRRuleString(params: {
    freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    count?: number;
    until?: Date;
    byweekday?: number[]; // 0=Monday, 6=Sunday
}): string {
    const freqMap = {
        daily: RRule.DAILY,
        weekly: RRule.WEEKLY,
        monthly: RRule.MONTHLY,
        yearly: RRule.YEARLY
    };

    const options: Partial<InstanceType<typeof RRule>['options']> = {
        freq: freqMap[params.freq],
        interval: params.interval || 1,
    };

    if (params.count !== undefined) {
        options.count = params.count;
    }

    if (params.until !== undefined) {
        options.until = params.until;
    }

    if (params.byweekday !== undefined) {
        options.byweekday = params.byweekday;
    }

    const rule = new RRule(options as any);
    return rule.toString();
}
