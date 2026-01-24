import { ObjectId, WithId } from "mongodb";
import { Event } from "../../../../src/shared/entity";
import { MDB } from "../../utils/MDB";


export type ServerEvent = Omit<Event, 'id' | 'notification' | 'recurrent'> & {
    chatId: number,
    threadId: number | undefined,
    idempotencyKey: string,
    messages?: number[]
    recurrent?: {
        groupId: ObjectId,
        descriptor: string
    }
}
export type SavedEvent = WithId<ServerEvent>
export const EVENTS = () => MDB.collection<ServerEvent>("events");

export const LATEST_EVENTS = () => MDB.collection<{ chatId: number, threadId: number | undefined, date: number, endDate: number, updated?: number }>("latest_events");
