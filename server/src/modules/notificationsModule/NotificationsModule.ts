import { ClientSession, ObjectId } from "mongodb";
import { container, singleton } from "tsyringe";
import { NOTIFICATIONS } from "./notificationsStore";
import { DurationDscrpitor, Duraion, Notification } from "../../../../src/shared/entity";
import { USER } from "../userModule/userStore";
import { CronJob } from "cron";
import { __DEV__ } from "../../utils/dev";
import { EVENTS } from "../eventsModule/eventStore";
import { TelegramBot } from "../../api/tg/tg";

export const beforeToMs = (before: DurationDscrpitor) => {
  const multiplyer = Duraion[before[before.length - 1] as keyof typeof Duraion] ?? 1
  const number = Number(before.slice(0, before.length - 1))
  return number * multiplyer
}

@singleton()
export class NotificationsModule {
  private db = NOTIFICATIONS();
  private users = USER();

  constructor() {
    new CronJob('* * * * *', async () => {
      console.log('notifications cron fire')
      try {
        let i = 0;
        await this.db
          .find({ sent: { $ne: true }, time: { $lte: Date.now() } })
          // tg limits
          .limit(29 * 60)
          .forEach((n) => {
            setTimeout(async () => {
              try {
                // TODO: group/cache events
                const event = await EVENTS().findOne({ _id: n.eventId });
                if (event) {
                  const user = await USER().findOne({ id: n.userId })
                  if (user?.settings.enableNotifications) {
                    await container.resolve(TelegramBot).sendNotification(event, n.userId);
                  }
                }
                await this.db.updateOne({ _id: n._id }, { $set: { sent: true } });

              } catch (e) {
                console.error(e)
              }

              // ~30 m/s
            }, i++ * 33)

          })
      } catch (e: any) {
        console.error(e?.message)
      }
    }, null, !__DEV__);
  }

  updateNotificationOnAttend = async (eventId: ObjectId, date: number, isAttendee: boolean, userId: number, session: ClientSession) => {
    if (isAttendee) {
      const { settings: { enableNotifications, notifyBefore } } = (await this.users.findOne({ id: userId }))!;
      if (enableNotifications && notifyBefore) {
        const notifyBeforeMs = beforeToMs(notifyBefore)
        await this.db.updateOne({ eventId, userId }, {
          $setOnInsert: {
            sent: false,
            time: date - notifyBeforeMs,
            eventTime: date,
            notifyBefore,
            notifyBeforeMs
          }
        }, { upsert: true, session })
      }
    } else {
      await this.db.deleteOne({ eventId, userId }, { session })
    }
  }

  updateNotification = async (eventId: ObjectId, userId: number, { notifyBefore }: Notification) => {
    if (notifyBefore) {
      const notifyBeforeMs = beforeToMs(notifyBefore);
      await this.db.updateOne({ eventId, userId }, [
        {
          $set: {
            time: { $subtract: ['$eventTime', notifyBeforeMs] },
            notifyBefore,
            notifyBeforeMs
          }
        },
        {
          $set: {
            // if notification moved to future, re-enable it
            sent: { $cond: [{ $gt: ['$time', Date.now()] }, false, '$sent'] }
          }
        }
      ], { upsert: true });
    } else {
      await this.db.deleteOne({ eventId, userId });
    }
  }

  onEventUpdated = async (eventId: ObjectId, date: number, session: ClientSession) => {
    this.db.updateMany({ eventId }, [
      {
        $set: {
          eventTime: date,
          time: { $subtract: [date, '$notifyBeforeMs'] }
        }
      },
      {
        $set: {
          // if notification moved to future, re-enable it
          sent: { $cond: [{ $gt: ['$time', Date.now()] }, false, '$sent'] }
        }
      }
    ], { session })
  }

  onEventDeleted = (eventId: ObjectId, session: ClientSession) => this.db.deleteMany({ eventId }, { session })

}
