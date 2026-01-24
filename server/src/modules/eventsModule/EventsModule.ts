import { ServerEvent, SavedEvent, EVENTS, LATEST_EVENTS } from "./eventStore";
import { container, singleton } from "tsyringe";
import { MDBClient } from "../../utils/MDB";
import { ObjectId, WithId } from "mongodb";
import { Subject } from "../../utils/subject";
import { ClientApiEventUpsertCommand, Duraion } from "../../../../src/shared/entity";
import { GeoModule } from "../geoModule/GeoModule";
import { NotificationsModule } from "../notificationsModule/NotificationsModule";
import * as linkify from 'linkifyjs';
import { parseMeta as getMeta } from "./metaParser";
import { RRule } from 'rrule'

@singleton()
export class EventsModule {
  private geo = container.resolve(GeoModule)

  private events = EVENTS();
  private eventsLatest = LATEST_EVENTS();

  readonly upateSubject = new Subject<{ chatId: number, threadId: number | undefined, event: SavedEvent, type: 'create' | 'update' | 'delete' }>;

  // constructor() {
  //   (async () => {
  //     const a = this.events
  //       .find()
  //       .map(e => this.events.updateOne({ _id: e._id }, { $set: { 'attendees.yes': [e.uid], 'attendees.no': [], 'attendees.maybe': [] } }))
  //       .toArray()
  //     await Promise.all((await a).flat())
  //     console.log('migrated')
  //   })()
  // }

  commitOperation = async (chatId: number, threadId: number | undefined, uid: number, command: ClientApiEventUpsertCommand) => {
    const { type, event } = command;
    const session = MDBClient.startSession()
    let _id: ObjectId | undefined

    let latestDateCandidate = event.date;
    let latestEndDateCandidate = event.endDate ?? event.date + Duraion.h;
    try {
      await session.withTransaction(async () => {
        // Write op
        if (command.type === 'create') {
          const { id, recurrent, ...event } = command.event
          const eventData = {
            ...event,

            recurrent: recurrent ? {
              groupId: new ObjectId(),
              descriptor: recurrent
            } : undefined,

            uid,
            chatId,
            threadId,

            seq: 0,
            idempotencyKey: `${uid}_${id}`,
            attendees: { yes: [uid], no: [], maybe: [] },
            geo: null
          };
          // create new event
          _id = (await this.events.insertOne({ ...eventData }, { session })).insertedId
          await container.resolve(NotificationsModule).updateNotificationOnAttend(_id, event.date, true, uid, session)

          if (eventData.recurrent) {
            // Materialise future events
            const rule = RRule.fromString(eventData.recurrent.descriptor)
            const fromDate = new Date(eventData.date)
            const toDate = new Date(eventData.date)
            toDate.setFullYear(fromDate.getFullYear() + 1)

            const duration = eventData.endDate - eventData.date
            const futureOccurrences = rule.between(fromDate, toDate, false) // false = exclude start date
            const futureEvents = futureOccurrences.slice(1).map(dateObj => { // Skip first occurrence (it's the main event)
              const date = new Date(dateObj).getTime()
              const eventId = new ObjectId()
              return { _id: eventId, ...eventData, idempotencyKey: `${eventData.idempotencyKey}_${date}`, date, endDate: date + duration }
            })

            if (futureEvents.length > 0) {
              await this.events.insertMany(futureEvents, { session })
              // Create notifications for all materialized events
              const notificationsModule = container.resolve(NotificationsModule)
              for (const futureEvent of futureEvents) {
                await notificationsModule.updateNotificationOnAttend(futureEvent._id, futureEvent.date, true, uid, session)
              }
            }
          }
        } else if (type === 'update') {
          const { id, recurrent, udpateFutureRecurringEvents, ...event } = command.event
          _id = new ObjectId(id)
          // update event
          const savedEvent = (await this.events.findOne({ _id, deleted: { $ne: true } }, { session }))
          if (!savedEvent) {
            throw new Error("Event not found")
          }

          const groupId = savedEvent.recurrent?.groupId

          // Prepare the update data
          const eventData: Partial<ServerEvent> = {
            ...event,
            // If not updating future events, remove recurrence from this single event
            // If updating future events, keep/update the recurrence
            recurrent: udpateFutureRecurringEvents && recurrent ? {
              groupId: groupId ?? new ObjectId(),
              descriptor: recurrent
            } : (udpateFutureRecurringEvents ? savedEvent.recurrent : undefined)
          }

          await this.events.updateOne({ _id, seq: savedEvent.seq }, { $set: eventData, $inc: { seq: 1 } }, { session })

          // If updating future recurring events and there's a group
          if (udpateFutureRecurringEvents && groupId) {
            // Delete all future events in this recurrence group (after this event's original date)
            await this.events.deleteMany({
              'recurrent.groupId': groupId,
              date: { $gt: savedEvent.date },
              _id: { $ne: _id }
            }, { session })

            // Re-materialize future events if we have a recurrence rule
            const finalRecurrent = eventData.recurrent
            if (finalRecurrent) {
              const rule = RRule.fromString(finalRecurrent.descriptor)
              const fromDate = new Date(event.date)
              const toDate = new Date(event.date)
              toDate.setFullYear(fromDate.getFullYear() + 1)

              const duration = event.endDate - event.date
              const futureOccurrences = rule.between(fromDate, toDate, false) // false = exclude start date
              const futureEvents = futureOccurrences.slice(1).map(dateObj => { // Skip first occurrence (it's the edited event)
                const date = new Date(dateObj).getTime()
                const eventId = new ObjectId()
                return {
                  _id: eventId,
                  ...savedEvent,
                  ...event,
                  recurrent: finalRecurrent,
                  idempotencyKey: `${savedEvent.idempotencyKey.split('_').slice(0, 2).join('_')}_${date}`,
                  date,
                  endDate: date + duration,
                  seq: 0
                }
              })
              if (futureEvents.length > 0) {
                await this.events.insertMany(futureEvents, { session })
                // Create notifications for all re-materialized events
                const notificationsModule = container.resolve(NotificationsModule)
                for (const futureEvent of futureEvents) {
                  await notificationsModule.updateNotificationOnAttend(futureEvent._id, futureEvent.date, true, savedEvent.uid, session)
                }
              }
            }
          }

          // update notifications
          await container.resolve(NotificationsModule).onEventUpdated(_id, event.date, session)

          // keep latest date latest
          const latest = (await this.events.find({ chatId, threadId }, { session }).sort({ date: -1 }).limit(1).toArray())[0];
          latestDateCandidate = Math.max(latestDateCandidate, latest?.date);
          latestEndDateCandidate = latest?.endDate ?? (latest?.date + Duraion.h);
        } else {
          throw new Error('Unknown operation modification type')
        }

        // bump latest index
        await this.eventsLatest.updateOne({ chatId, threadId }, { $max: { date: latestDateCandidate, endDate: latestEndDateCandidate } }, { upsert: true, session });

      })

    } finally {
      await session.endSession();
    }

    // non blocking update tz meta - for stats
    if (command.type === 'create') {
      this.geo.getTzLocation(command.event.tz).catch((e) => {
        console.error(e)
      })
    }

    // combine non-critical promises
    const syncActions: Promise<unknown>[] = []

    // try get meta
    if (_id) {
      // geo - can return unexpected results, disable until the way of removing implemented
      // if (command.event.description) {
      //   this.geo.geocode(command.event.description)
      //     // never wait 3d party APIs
      //     .then(geo => this.events.updateOne({ _id }, { $set: { geo } }))
      //     .catch(e => console.error(e));
      // } else {
      //   syncActions.push(
      //     this.events.updateOne({ _id }, { $set: { geo: undefined } })
      //       .catch(e => console.error(e))
      //   );
      // }

      // meta images
      let clearMeta = !command.event.description;
      if (command.event.description) {
        const url = linkify.find(event.description, 'url').find(u => u.isLink)?.href;
        clearMeta = clearMeta || !url;
        if (url) {
          getMeta(url)
            // never wait 3d party APIs
            .then((meta) => meta && this.events.updateOne({ _id }, { $set: { imageURL: meta.og.image || meta.images?.[0]?.src } }))
            .catch(e => console.error(e));
        }
      }
      if (clearMeta) {
        syncActions.push(
          this.events.updateOne({ _id }, { $set: { imageURL: undefined } })
            .catch(e => console.error(e))
        );
      }
    }

    // non-blocking cache update
    this.getEvents(chatId, threadId).catch((e) => console.error(e));

    syncActions.push(
      this.events.findOne({ _id })
    );
    const updatedEvent = (await Promise.all(syncActions))[syncActions.length - 1] as WithId<ServerEvent> | null
    if (!updatedEvent) {
      throw new Error("operation lost during " + type);
    }
    // notify all
    this.upateSubject.next({ chatId, threadId, event: updatedEvent, type });

    return updatedEvent;
  };

  // TODO: merge with commit? - two signatures for this function?
  deleteEvent = async (id: string, deleteFutureRecurringEvents?: boolean) => {
    const _id = new ObjectId(id);
    let event = await this.events.findOne({ _id });
    if (!event) {
      throw new Error("Event not found")
    }
    const { chatId, threadId } = event;
    if (event?.deleted) {
      // already deleted - just return
      return event;
    } else {
      const session = MDBClient.startSession()
      const deletedFutureEvents: SavedEvent[] = []
      try {
        await session.withTransaction(async () => {
          // Delete the main event
          await this.events.updateOne({ _id }, { $set: { deleted: true }, $inc: { seq: 1 } }, { session });
          // update notifications for main event
          await container.resolve(NotificationsModule).onEventDeleted(_id, session)

          // If deleting future recurring events
          if (deleteFutureRecurringEvents && event!.recurrent?.groupId) {
            const groupId = event!.recurrent.groupId
            // Find all future events in this group
            const futureEvents = await this.events.find({
              'recurrent.groupId': groupId,
              date: { $gt: event!.date },
              deleted: { $ne: true }
            }, { session }).toArray()

            // Mark them as deleted
            for (const futureEvent of futureEvents) {
              await this.events.updateOne(
                { _id: futureEvent._id },
                { $set: { deleted: true }, $inc: { seq: 1 } },
                { session }
              )
              await container.resolve(NotificationsModule).onEventDeleted(futureEvent._id, session)
              deletedFutureEvents.push({ ...futureEvent, deleted: true, seq: futureEvent.seq + 1 })
            }
          }
        })
      } finally {
        await session.endSession();
      }

      event = await this.events.findOne({ _id })
      if (!event) {
        throw new Error("event lost during delete")
      }
      // non-blocking cache update
      this.getEvents(chatId, threadId).catch((e) => console.error(e));

      // notify all about main event deletion
      this.upateSubject.next({ chatId, threadId, event, type: 'delete' });

      // notify about all future deleted events
      for (const deletedEvent of deletedFutureEvents) {
        this.upateSubject.next({ chatId, threadId, event: deletedEvent, type: 'delete' });
      }

      return event;
    }
  }

  updateAtendeeStatus = async (chatId: number, threadId: number | undefined, eventId: string, uid: number, status: 'yes' | 'no' | 'maybe') => {
    const _id = new ObjectId(eventId);
    const addTo = status
    const pullFrom = ['yes', 'no', 'maybe'].filter(s => s != addTo).map(k => `attendees.${k}`)

    let updatedEvent: SavedEvent | undefined

    const session = MDBClient.startSession()
    try {
      await session.withTransaction(async () => {
        await this.events.updateOne({ _id }, { $pull: { [pullFrom[0]]: uid, [pullFrom[1]]: uid }, $addToSet: { [`attendees.${addTo}`]: uid }, $inc: { seq: 1 } }, { session })
        // update notifications
        updatedEvent = (await this.events.findOne({ _id }, { session }))!
        await container.resolve(NotificationsModule).updateNotificationOnAttend(_id, updatedEvent.date, status === 'yes', uid, session)
      })
    } finally {
      await session.endSession();
    }

    // non-blocking cache update
    this.getEvents(chatId, threadId).catch((e) => console.error(e));

    if (!updatedEvent) {
      throw new Error("operation lost during updateAtendeeStatus");
    }
    // notify all
    this.upateSubject.next({ chatId, threadId, event: updatedEvent, type: 'update' });

    return updatedEvent;
  }

  logCache = new Map<string, SavedEvent[]>();
  getEvents = async (chatId: number, threadId: number | undefined, limit = 200): Promise<SavedEvent[]> => {
    const now = new Date().getTime();
    let res = await this.events.find({ chatId, threadId, endDate: { $gte: now }, deleted: { $ne: true } }, { limit, sort: { date: 1 } }).toArray();
    this.logCache.set(`${chatId}-${threadId ?? undefined}-${limit}`, res)
    return res
  }

  getEventsDateRange = async (from: number, to: number, chatId: number, threadId: number | null): Promise<SavedEvent[]> => {
    return await this.events.find({ chatId, threadId: threadId ?? undefined, date: { $gte: from, $lt: to }, deleted: { $ne: true } }, { sort: { date: 1 } }).toArray();
  }

  getEvent = async (id: string): Promise<SavedEvent> => {
    const event = await this.events.findOne({ _id: new ObjectId(id) });
    if (!event) {
      throw new Error("Event not found");
    }
    return event;
  }

  getEventsCached = async (chatId: number, threadId: number | undefined, limit = 200) => {
    const now = new Date().getTime();

    let events = this.logCache.get(`${chatId}-${threadId ?? undefined}-${limit}`)?.filter(e => e.endDate >= now)
    const eventsPromise = this.getEvents(chatId, threadId, limit).catch(e => {
      console.error(e)
      return []
    })
    if (!events) {
      events = await eventsPromise
    }
    return { events, eventsPromise }
  }
}
