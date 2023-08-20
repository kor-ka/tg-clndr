import TB from "node-telegram-bot-api";
import { container } from "tsyringe";
import { UserModule } from "../../modules/userModule/UserModule";
import { SavedEvent } from "../../modules/eventsModule/eventStore";
import { getChatToken } from "../Auth";
import { SavedUser } from "../../modules/userModule/userStore";

export function htmlEntities(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const usersListStr = async (uids: number[]) => {
  const userModule = container.resolve(UserModule);
  const users = (await Promise.all(uids.map(uid => userModule.getUser(uid))))
    .filter(Boolean)
    .map(u => ({ ...u as SavedUser, fullName: [u!.name, u!.lastname].filter(Boolean).join(' ') }));
  return users.sort((a, b) => [a.name, a.lastname].filter(Boolean).join(', ').localeCompare(b.fullName))
    .map(u => u.fullName).join(', ');
}

export const renderPin = async (chatId: number, threadId: number | undefined, events: SavedEvent[]) => {
  const timeZones = new Set<string>();
  events.forEach(e => timeZones.add(e.tz));
  const lines = (await Promise.all(events.map(async ({ date, tz, title, description, attendees }) => {
    const dateStr = new Date(date).toLocaleString('en', { month: 'short', day: 'numeric', timeZone: tz });
    const timeStr = new Date(date).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hourCycle: 'h24', timeZone: tz });

    const lines = [`🗓️ ${dateStr} - <b>${htmlEntities(title.trim())}</b>, ${timeStr} ${timeZones.size > 1 ? `(${tz})` : ''}`];
    if (description.trim()) {
      lines.push(`✏️ ${htmlEntities(description.trim())}`);
    }

    let yesUsers = await usersListStr(attendees.yes);
    yesUsers = yesUsers ? '✅ ' + yesUsers : '';
    if (yesUsers) {
      lines.push(yesUsers)
    }

    let maybeUsers = await usersListStr(attendees.maybe);
    maybeUsers = maybeUsers ? '🤔 ' + maybeUsers : '';
    if (maybeUsers) {
      lines.push(maybeUsers)
    }

    let noUsers = await usersListStr(attendees.no);
    noUsers = noUsers ? '🙅 ' + noUsers : '';
    if (noUsers) {
      lines.push(noUsers)
    }

    lines.push('')
    return lines
  }))).flat();

  let key = [chatId, threadId].filter(Boolean).join('_');
  const token = getChatToken(chatId);
  key = [key, token].filter(Boolean).join('T');

  const webcalUrl = `https://tg-clndr-4023e1d4419a.herokuapp.com/ics/${key}/cal.ics`
  lines.push(`<a href="${webcalUrl}">add to iOS calendar</a> (hold → open in Safari)`);
  lines.push(`<a href="${getAndroidLink(webcalUrl)}">add to Android calendar</a>`);

  const text = lines.length > 1 ? lines.join('\n').trim() : '🗓️ no upcoming events';

  let buttonsRows: TB.InlineKeyboardButton[][] = [];
  buttonsRows.push([
    {
      text: "calendar",
      url: `https://t.me/clndrrrbot/clndr?startapp=${key}&startApp=${key}`,
    },
  ]);


  return { text, buttonsRows };
};

const getAndroidLink = (url: string) => {
  return `https://calendar.google.com/calendar/u/0/r?cid=${url.replace('https://', 'webcal://')}`
}