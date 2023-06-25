import * as jwt from "jsonwebtoken";
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET as string;

export const getChatToken = (chatId: number) => {
    const token = jwt.sign(
        { chatId: chatId },
        ACCESS_TOKEN_SECRET,
        { expiresIn: "1000y" }
    );
    return token;
}

export const checkChatToken = (token: string, chatId: number) => {
    jwt.verify(token, ACCESS_TOKEN_SECRET, (err: any, data: any) => {
        if (err) {
            throw err;
        }
        if (data.chatId !== chatId) {
            throw new Error("Token invalid");
        }
    });
}