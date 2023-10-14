import { ClientSession, ObjectId } from "mongodb";
import { singleton } from "tsyringe";
import { NOTIFICATIONS } from "./notificationsStore";
import { BeforePreset, Duraion, UserSettings } from "../../../../src/shared/entity";
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

  upsertNotification = async (eventId: ObjectId, date: number, isAttendee: boolean, userId: number, session: ClientSession) => {
    const { settings: { notifyBefore } } = (await this.users.findOne({ id: userId }))!;
    const enabled = isAttendee && (notifyBefore !== null);
    await this.db.updateOne({ eventId, userId }, {
      $set: { time: enabled ? date - beforeToMs(notifyBefore) : null, eventTime: date },
      $setOnInsert: { sent: false }
    }, { upsert: true, session })
  }

  onUpdateNotificationSettings = async (userId: number, settings: Pick<UserSettings, 'notifyBefore'>, session: ClientSession) => {
    const beforePreset = settings.notifyBefore
    const enabled = beforePreset !== null
    this.db.updateMany({ userId, eventTime: { $gt: Date.now() } }, [
      {
        $set: {
          time: enabled ?
            { $substr: ['$eventTime', beforeToMs(beforePreset)] }
            : null,
        }
      },
      {
        $set: {
          // if notification moved to future, re-enable it
          sent: {
            $cond: [
              { $gt: ['$time', Date.now()] },
              false,
              '$sent'
            ]
          }
        }
      }
    ], { session })
  }

  onEventUpdated = async (eventId: ObjectId, date: number, session: ClientSession) => {
    this.db.updateMany({ eventId }, [
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: 'id',
          as: 'user'
        }
      },
      {
        $set: {
          eventTime: date,
          time: {
            $cond: [
              { $ne: ['$user.settings.notifyBefore', null] },
              { $substr: [date, '$user.settings.notifyBeforeMs'] },
              null
            ]
          }
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
