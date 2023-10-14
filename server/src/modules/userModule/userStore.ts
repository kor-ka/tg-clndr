import { WithId } from "mongodb";
import { User, UserSettings } from "../../../../src/shared/entity";
import { MDB } from "../../utils/MDB";

export type ServerUserSettings = UserSettings & { notifyBeforeMs: number | null }
type ServerUser = Omit<User, 'disabled'> & { chatIds?: number[], threadFullIds?: string[], disabledChatIds?: number[], settings?: ServerUserSettings }
export type SavedUser = WithId<ServerUser>
export const USER = () => MDB.collection<ServerUser>("users");
