import * as crypto from "crypto";

const tgToken = process.env.TELEGRAM_BOT_TOKEN!;

export const checkTgAuth = (initData: string, hash: string, authDate: number) => {
  try {
    const secret = crypto.createHmac("sha256", "WebAppData").update(tgToken).digest();
    const dataCheckString = initData
      .split("&")
      .filter(e => !e.startsWith('hash='))
      .sort((a, b) => a.localeCompare(b))
      .join('\n')
    const h = crypto
      .createHmac("sha256", secret)
      .update(dataCheckString)
      .digest("hex");

    // const now = Date.now() / 1000;
    // const timeDiff = now - Number(authDate);

    if (h !== hash) {
      throw new Error("Auth: Telegram: data is NOT from Telegram");
    }
    //  ignore authDate, it gets cached by iphone client
    // if (timeDiff > 60 * 60 * 24) {
    //   throw new Error("Auth: Telegram: Data is outdated");
    // }
    return true
  } catch (e) {
    console.log("no tgAuth", initData, hash, authDate);
    console.error(e)
    return false
  }
};
