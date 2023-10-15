import { container } from "tsyringe";
import { SavedEvent } from "../../modules/eventsModule/eventStore";
import { UserModule } from "../../modules/userModule/UserModule";
import { SavedUser } from "../../modules/userModule/userStore";

export function htmlEntities(str: string) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const limit = 5;
const usersListStr = async (uids: number[]) => {
    const overflow = uids.length > limit ? (uids.length - limit + 1) : 0;
    const showLength = overflow ? uids.length - overflow : uids.length;

    const userModule = container.resolve(UserModule);
    const users = (await Promise.all(uids.slice(0, showLength).map(uid => userModule.getUser(uid))))
        .filter(Boolean)
        .map(u => ({ ...u as SavedUser, fullName: [u!.name, u!.lastname].filter(Boolean).join(' ') }));
    let text = users.sort((a, b) => [a.name, a.lastname].filter(Boolean).join(', ').localeCompare(b.fullName))
        .map(u => u.fullName).join(', ');
    if (overflow) {
        text += `, ${overflow} more`
    }
    return text
}

export const renderEvent = async ({ date, tz, title, description, attendees, deleted, geo }: SavedEvent, options?: { timeZones?: Set<string>, renderAttendees?: boolean, chatName?: string }) => {
    const { timeZones, renderAttendees, chatName } = options ?? {}
    const dateStr = new Date(date).toLocaleString('en', { month: 'short', day: 'numeric', timeZone: tz });
    const timeStr = new Date(date).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hourCycle: 'h24', timeZone: tz });

    const lines = [`${deleted ? "<s>" : ""}🗓️ ${dateStr} - <b>${htmlEntities(title.trim() + (chatName ? `@${chatName}` : ''))}</b>, ${timeStr} ${(timeZones?.size ?? 0) > 1 ? `(${tz})` : ''}${deleted ? "</s>" : ""}`];
    if (description.trim()) {
        lines.push(`✏️ ${htmlEntities(description.trim())}`);
    }
    if (geo) {
        lines.push(`📍 <a href="https://maps.google.com/?q=${geo.location[0]},${geo.location[1]}">${htmlEntities(geo.address)}</a>`)
    }

    if (renderAttendees !== false) {
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
    }

    lines.push('')
    return lines
}