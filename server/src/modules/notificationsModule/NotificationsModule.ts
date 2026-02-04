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
                // non-outdated
                if (n.time && (Date.now() - n.time < 1000 * 60 * 60)) {
                  // TODO: group/cache events
                  const event = await EVENTS().findOne({ _id: n.eventId, deleted: { $ne: true } });
                  // event still exists
                  if (event) {
                    const user = await USER().findOne({ id: n.userId })
                    // user enabled notifications
                    if (user?.settings.enableNotifications) {
                      await container.resolve(TelegramBot).sendNotification(event, n.userId);
                    }
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

  /**
   * Batch create notifications for multiple events for a single user.
   * This is much faster than calling updateNotificationOnAttend in a loop
   * because it fetches user settings once and uses bulkWrite for all notifications.
   */
  batchCreateNotificationsForUser = async (
    events: { eventId: ObjectId; date: number }[],
    userId: number,
    session: ClientSession
  ) => {
    if (events.length === 0) return;

    // Fetch user settings once instead of for each event
    const user = await this.users.findOne({ id: userId });
    if (!user) return;

    const { settings: { enableNotifications, notifyBefore } } = user;
    if (!enableNotifications || !notifyBefore) return;

    const notifyBeforeMs = beforeToMs(notifyBefore);

    // Use bulkWrite with upsert operations for all events at once
    const operations = events.map(({ eventId, date }) => ({
      updateOne: {
        filter: { eventId, userId },
        update: {
          $setOnInsert: {
            sent: false,
            time: date - notifyBeforeMs,
            eventTime: date,
            notifyBefore,
            notifyBeforeMs
          }
        },
        upsert: true
      }
    }));

    await this.db.bulkWrite(operations, { session });
  }

  /**
   * Batch update notifications for multiple events when attendance changes.
   * Creates notifications if attending, deletes them if not attending.
   */
  batchUpdateNotificationsOnAttend = async (
    events: { eventId: ObjectId; date: number }[],
    isAttendee: boolean,
    userId: number,
    session: ClientSession
  ) => {
    if (events.length === 0) return;

    if (isAttendee) {
      await this.batchCreateNotificationsForUser(events, userId, session);
    } else {
      const eventIds = events.map(e => e.eventId);
      await this.db.deleteMany({ eventId: { $in: eventIds }, userId }, { session });
    }
  }

  updateNotification = async (eventId: ObjectId, userId: number, { notifyBefore }: Notification) => {
    const event = await EVENTS().findOne({ _id: eventId })
    if (!event) {
      throw new Error(`event not found: ${eventId} `)
    }
    if (notifyBefore) {
      const notifyBeforeMs = beforeToMs(notifyBefore);
      await this.db.updateOne({ eventId, userId }, [
        {
          $set: {
            eventTime: event.date,
            time: event.date - notifyBeforeMs,
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

  onEventUpdated = (eventId: ObjectId, date: number, session: ClientSession) => {
    return this.db.updateMany({ eventId }, [
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

  onEventsDeleted = (eventIds: ObjectId[], session: ClientSession) => this.db.deleteMany({ eventId: { $in: eventIds } }, { session })

}

