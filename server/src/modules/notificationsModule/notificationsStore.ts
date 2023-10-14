import { ObjectId, WithId } from "mongodb";
import { DurationDscrpitor } from "../../../../src/shared/entity";
import { MDB } from "../../utils/MDB";

export type ServerNotification = { time: number | null, eventTime: number, notifyBefore: DurationDscrpitor, notifyBeforeMs: number, eventId: ObjectId, userId: number, sent: boolean }
export type SavedNotification = WithId<ServerNotification>
export const NOTIFICATIONS = () => MDB.collection<SavedNotification>("notifications");
