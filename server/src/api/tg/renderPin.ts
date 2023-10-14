import TB from "node-telegram-bot-api";
import { SavedEvent } from "../../modules/eventsModule/eventStore";
import { getChatToken } from "../Auth";
import { renderEvent } from "./renderEvent";

export const renderPin = async (chatId: number, threadId: number | undefined, events: SavedEvent[]) => {
  let key = [chatId, threadId].filter(Boolean).join('_');
  const token = getChatToken(chatId);
  key = [key, token].filter(Boolean).join('T');

  const timeZones = new Set<string>();
  events.forEach(e => timeZones.add(e.tz));

  let lines = (await Promise.all(events.map(e => renderEvent(e, { timeZones })))).flat();
  lines = lines.length > 0 ? lines : ['🗓️ no upcoming events']

  lines.push('');
  const webcalUrl = `https://tg-clndr-4023e1d4419a.herokuapp.com/ics/${key}/cal.ics`;
  lines.push(`<a href="${webcalUrl}">add to iOS calendar</a> (hold → open in Safari)`);
  lines.push(`<a href="${getAndroidLink(webcalUrl)}">add to Android calendar</a>`);

  const text = lines.join('\n').trim();

  let buttonsRows: TB.InlineKeyboardButton[][] = [];
  buttonsRows.push([
    {
      text: "Calendar",
      url: `https://t.me/clndrrrbot/clndr?startapp=${key}&startApp=${key}`,
    },
  ]);

  return { text, buttonsRows };
};

const getAndroidLink = (url: string) => {
  return `https://calendar.google.com/calendar/u/0/r?cid=${url.replace('https://', 'webcal://') + '?s=0'}`
}