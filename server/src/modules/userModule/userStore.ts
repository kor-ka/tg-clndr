import { WithId } from "mongodb";
import { User } from "../../../../src/shared/entity";
import { MDB } from "../../utils/MDB";

type ServerUser = Omit<User, 'disabled'> & { chatIds?: number[], threadIds?: number[], disabledChatIds?: number[] }
export type SavedUser = WithId<ServerUser>
export const USER = () => MDB.collection<ServerUser>("users");
