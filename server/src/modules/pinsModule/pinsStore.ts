import { ObjectId } from "mongodb";
import { MDB } from "../../utils/MDB";
interface Pins {
  _id: ObjectId;
  chatId: number;
  threadId: number | null;
  messageId: number;
  chatInstance?: string;
  text?: string,
  inlineKeyboardDescriptor?: string
}

export const PINS = () => MDB.collection<Pins>("pins");
