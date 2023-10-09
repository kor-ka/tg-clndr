import { ObjectId } from "mongodb";
import { MDB } from "../../utils/MDB";

export interface ChatMeta {
  _id: ObjectId;
  chatId: number;
  name: string;
  // TODO: drop
  token?: string;
  settings: {
    allowPublicEdit: boolean
    enableEventMessages: boolean
  }
}

export const CHATMETA = () => MDB.collection<ChatMeta>("settings");
