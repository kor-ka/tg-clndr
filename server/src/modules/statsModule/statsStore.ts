import { MDB } from "../../utils/MDB";

type Stat = { userId: number, chatId: number }
export type StatSession = Stat & { type: "ws_session", start: number, end?: number, length?: number }
export type StatMessage = Stat & { type: "tg_message", command: string }
export type StatCallbackQuery = Stat & { type: "tg_callback_query", command: string }

export const STATS = () => MDB.collection<StatSession | StatMessage | StatCallbackQuery>("stats");
