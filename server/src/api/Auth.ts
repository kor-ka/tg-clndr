import * as crypto from "crypto";
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET as string;

export const getChatToken = (chatId: number) => {
    return crypto
        .createHmac("sha1", ACCESS_TOKEN_SECRET)
        .update(chatId + '')
        .digest("hex")
}

export const checkChatToken = (token: string, chatId: number) => {
    if (getChatToken(chatId) !== token) {
        throw new Error("Token invalid")
    }
}