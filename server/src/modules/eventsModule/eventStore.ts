import { WithId } from "mongodb";
import { Event } from "../../../../src/shared/entity";
import { MDB } from "../../utils/MDB";


export type ServerEvent = Omit<Event, 'id' | 'notification'> & {
    chatId: number,
    threadId: number | undefined,
    idempotencyKey: string,
    messages?: number[],
    // Recurring event fields stored on server
    materializationHorizon?: number // Timestamp until which events have been materialized
}
export type SavedEvent = WithId<ServerEvent>
export const EVENTS = () => MDB.collection<ServerEvent>("events");

export const LATEST_EVENTS = () => MDB.collection<{ chatId: number, threadId: number | undefined, date: number, endDate: number, updated?: number }>("latest_events");

// Collection to track recurring event groups that need continuous materialization
export type RecurringGroupMeta = {
    groupId: string,
    chatId: number,
    threadId: number | undefined,
    rrule: string,
    templateEventId: string, // ObjectId as string
    materializationHorizon: number, // Timestamp until which events have been materialized
    deleted?: boolean
}
export const RECURRING_GROUPS = () => MDB.collection<RecurringGroupMeta>("recurring_groups");
