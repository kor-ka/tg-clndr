import { CronJob } from "cron";
import { container, singleton } from "tsyringe";
import { EventsModule } from "../eventsModule/EventsModule";
import { LATEST_EVENTS } from "../eventsModule/eventStore";
import { ICS } from "./icsStore";
import * as ics from "ics"

@singleton()
export class ICSModule {
  private db = ICS();
  private eventsModule = container.resolve(EventsModule)

  readonly update = async (chatId: number, threadId: number | undefined) => {
    const events = await this.eventsModule.getEvents(chatId, threadId);

    // TODO: migrate description - title
    const { error, value } = ics.createEvents(events.map(e => {
      const date = new Date(e.date);
      return {
        title: e.description,
        start: [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()],
        duration: { minutes: 60 }
      }
    }));

    if (value) {
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
