import { ClientSession, ObjectId } from "mongodb";
import { singleton } from "tsyringe";
import { NOTIFICATIONS } from "./notificationsStore";
import { BeforePreset, Duraion, Notification } from "../../../../src/shared/entity";
import { USER } from "../userModule/userStore";

export const beforeToMs = (before: BeforePreset) => {
  const multiplyer = Duraion[before[before.length - 1] as keyof typeof Duraion] ?? 1
  const number = Number(before.slice(0, before.length - 1))
  return number * multiplyer
}

@singleton()
export class NotificationsModule {
  private db = NOTIFICATIONS();
  private users = USER();

  updateNotificationOnAttend = async (eventId: ObjectId, date: number, isAttendee: boolean, userId: number, session: ClientSession) => {
    if (isAttendee) {
      const { settings } = (await this.users.findOne({ id: userId }))!;
      const notifyBefore = settings?.notifyBefore
      if (notifyBefore) {
        const notifyBeforeMs = beforeToMs(notifyBefore)
        await this.db.updateOne({ eventId, userId }, {
          $set: {
            time: date - notifyBeforeMs,
            eventTime: date,
            notifyBefore,
            notifyBeforeMs
          },
          $setOnInsert: { sent: false }
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
      ]);
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