import { MDB } from "../../utils/MDB";

export const ICS = () => MDB.collection<{ chatId: number, threadId: number | undefined, data: string }>("ics");
