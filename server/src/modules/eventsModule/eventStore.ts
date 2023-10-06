import { WithId } from "mongodb";
import { Event } from "../../../../src/shared/entity";
import { MDB } from "../../utils/MDB";


export type ServerEvent = Omit<Event, 'id'> & {
    chatId: number,
    threadId: number | undefined,
    idempotencyKey: string,
    messages?: number[]
}
export type SavedEvent = WithId<ServerEvent>
export const EVENTS = () => MDB.collection<ServerEvent>("events");

export const LATEST_EVENTS = () => MDB.collection<{ chatId: number, threadId: number | undefined, date: number, updated?: number }>("latest_events");
