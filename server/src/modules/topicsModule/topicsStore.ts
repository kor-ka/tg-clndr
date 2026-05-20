import { MDB } from "../../utils/MDB";

export const TOPICS = () => MDB.collection<{ chatId: number, threadId: number, name: string }>("topics");
