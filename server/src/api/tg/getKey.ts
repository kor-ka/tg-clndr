import { getChatToken } from "../Auth";

export const getKey = (chatId: number, threadId: number | undefined) => {
    let key = [chatId, threadId].filter(Boolean).join('_');
    const token = getChatToken(chatId);
    return [key, token].filter(Boolean).join('T');
}