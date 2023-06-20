import TB from "node-telegram-bot-api";
import { container } from "tsyringe";
import { UserModule } from "../../modules/userModule/UserModule";
import { ChatMetaModule } from "../../modules/chatMetaModule/ChatMetaModule";
import { SavedEvent } from "../../modules/eventsModule/eventStore";

export function htmlEntities(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const renderPin = async (chatId: number, threadId: number | undefined, events: SavedEvent[]) => {
  const userModule = container.resolve(UserModule)
  const chatMetaModule = container.resolve(ChatMetaModule)
  const lines = events.map(({ date, tz, description, }) => {
    const dateStr = new Date(date).toLocaleString('en', { month: 'short', day: 'numeric', timeZone: tz })
    const timeStr = new Date(date).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hourCycle: 'h24', timeZone: tz })
    return `${dateStr} - ${description}, ${timeStr} (${tz})`;
  });

  const text = lines.join('\n').trim() || '✨ Looking forward to new adventures ✨';
  let key = [chatId, threadId].filter(Boolean).join('_');
  const token = (await chatMetaModule.getChatMeta(chatId))?.token
  key = [key, token].filter(Boolean).join('T')
  let buttonsRows: TB.InlineKeyboardButton[][] = [];
  buttonsRows.push([
    {
      text: "calendar",
      url: `https://t.me/clndrrrbot/clndr?startapp=${key}&startApp=${key}`,
    },
  ]);


  return { text, buttonsRows };
};
