import { CronJob } from "cron";
import { container, singleton } from "tsyringe";
import { EventsModule } from "../eventsModule/EventsModule";
import { LATEST_EVENTS } from "../eventsModule/eventStore";
import { ICS } from "./icsStore";
import * as ics from "ics"
import { ChatMetaModule } from "../chatMetaModule/ChatMetaModule";
import { Attendee, ParticipationStatus } from "ics";
import { UserModule } from "../userModule/UserModule";

const uidToAttendee = async (uid: number, status: ParticipationStatus): Promise<Attendee> => {
  const userModule = container.resolve(UserModule);
  try {
    const user = await userModule.getUser(uid)
    if (user) {
      return {
        name: [user.name, user.lastname].filter(Boolean).join(' '),
        email: "stupid.ios.needs@email.here",
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
      const attendees: Attendee[] = (await Promise.all([
        e.attendees.yes.map(uid => uidToAttendee(uid, 'ACCEPTED')),
        e.attendees.maybe.map(uid => uidToAttendee(uid, 'TENTATIVE')),
        e.attendees.no.map(uid => uidToAttendee(uid, 'DECLINED'))
      ].flat()))
      evs.push(
        {
          calName: chat?.name ?? undefined,
          uid: e._id.toHexString(),
          sequence: e.seq,
          title: e.title,
          description: e.description,
          start: [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()],
          duration: { minutes: 60 },
          attendees
        }
      )
    }
    let { error, value } = ics.createEvents(evs);

    if (value) {
      value = value.replace('X-PUBLISHED-TTL:PT1H', 'X-PUBLISHED-TTL:PT1M')
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
    // TODO: same work as tg - extract unifying module?
    this.eventsModule.upateSubject.subscribe(async (upd) => {
      try {
        await this.update(upd.chatId, upd.threadId)
      } catch (e) {
        console.error(e)
      }
    })

    new CronJob('* * * * *', async () => {
      console.log('ics cron fire')
      try {
        const now = Date.now()
        LATEST_EVENTS()
          .find({ date: { $gte: now } })
          .forEach(le => {
            console.log('udpate', JSON.stringify(le, undefined, 4))
            this.update(le.chatId, le.threadId).catch(e => {
              console.error(e)
            })
          }).catch(e => {
            console.error(e)
          })
      } catch (e) {
        console.error(e)
      }
    }, null, true);
  }





}
