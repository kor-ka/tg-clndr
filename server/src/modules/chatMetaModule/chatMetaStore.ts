import { ObjectId } from "mongodb";
import { ChatSettings } from "../../../../src/shared/entity";
import { MDB } from "../../utils/MDB";

export interface ChatMeta {
  _id: ObjectId;
  chatId: number;
  name: string;
  // TODO: drop
  token?: string;
  settings: ChatSettings
}

export const CHATMETA = () => MDB.collection<ChatMeta>("settings");
