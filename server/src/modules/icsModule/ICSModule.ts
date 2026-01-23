import { CronJob } from "cron";
import { container, singleton } from "tsyringe";
import { EventsModule } from "../eventsModule/EventsModule";
import { LATEST_EVENTS } from "../eventsModule/eventStore";
import { ICS } from "./icsStore";
import * as ics from "ics"
import { ChatMetaModule } from "../chatMetaModule/ChatMetaModule";
import { Attendee, GeoCoordinates, ParticipationStatus } from "ics";
import { UserModule } from "../userModule/UserModule";

const uidToAttendee = async (uid: number, status: ParticipationStatus, chatId: number): Promise<Attendee> => {
  const userModule = container.resolve(UserModule);
  try {
    const user = await userModule.getUser(uid, chatId)
    if (user) {
      return {
        name: [user.name, user.lastname].filter(Boolean).join(' '),
        email: `${uid}-stupid.ios.needs@email.here`,
        partstat: status
      }
    }
  } catch (e) {
    console.error(e);
  }
  return { name: '???' };
}

@singleton()
export class ICSModule {
  private db = ICS();
  private eventsModule = container.resolve(EventsModule)
  private chatMetaModule = container.resolve(ChatMetaModule)

  readonly update = async (chatId: number, threadId: number | undefined) => {
    const events = await this.eventsModule.getEvents(chatId, threadId);
    const chat = await this.chatMetaModule.getChatMeta(chatId);

    const evs: ics.EventAttributes[] = []
    for (let e of events) {
      const date = new Date(e.date);
      const endDate = new Date(e.endDate);
      const attendees: Attendee[] = (await Promise.all([
        e.attendees.yes.map(uid => uidToAttendee(uid, 'ACCEPTED', chatId)),
        e.attendees.maybe.map(uid => uidToAttendee(uid, 'TENTATIVE', chatId)),
        e.attendees.no.map(uid => uidToAttendee(uid, 'DECLINED', chatId))
      ].flat()))
      let location: string | undefined = undefined
      let description = e.description
      let geo: GeoCoordinates | undefined = undefined
      if (e.geo) {
        location = e.geo.address
        geo = { lat: e.geo.location[0], lon: e.geo.location[1] }
      } else {
        // if no geo - use first line from description as location
        const lines = (e.description ?? "").split("\n");
        location = lines.shift();
        description = lines.join("\n");
      }
      evs.push(
        {
          calName: chat?.name ?? undefined,
          uid: e._id.toHexString(),
          sequence: e.seq,
          title: e.title,
          location,
          geo,
          description,
          start: [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()],
          end: [endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate(), endDate.getHours(), endDate.getMinutes()],
          attendees
        }
      )
    }
    let { error, value } = ics.createEvents(evs);

    if (value) {
      value = value.replace('X-PUBLISHED-TTL:PT1H', 'X-PUBLISHED-TTL:PT1M')

      for (let e of events) {
        if (e.geo) {
          const geoStr = `GEO:${e.geo.location[0]};${e.geo.location[1]}`;
          value = value.replaceAll(geoStr, `${geoStr}\nX-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS="${e.geo.address}";X-APPLE-RADIUS=70;X-APPLE-REFERENCEFRAME=1;X-TITLE="${e.geo.address}":geo:${e.geo.location[0]},${e.geo.location[1]}`)
        }
      }

      await this.db.updateOne({ chatId, threadId }, { $set: { chatId, threadId, data: value } }, { upsert: true });
    } else if (error) {
      console.log(error)
      return
    }

  };

  getIcs = async (chatId: number, threadId: number | undefined) => {
    return (await this.db.findOne({ chatId, threadId }))?.data
  }

  readonly init = () => {
    this.eventsModule.upateSubject.subscribe(async (upd) => {
      try {
        await this.update(upd.chatId, upd.threadId)
      } catch (e) {
        console.error(e)
      }
    })
  }
}
