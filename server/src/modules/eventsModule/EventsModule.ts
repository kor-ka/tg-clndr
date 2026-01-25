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
import { CronJob } from "cron";
import { __DEV__ } from "../../utils/dev";

// Time constants for recurring event materialization
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

@singleton()
export class EventsModule {
  private geo = container.resolve(GeoModule)

  private events = EVENTS();
  private eventsLatest = LATEST_EVENTS();

  readonly upateSubject = new Subject<{ chatId: number, threadId: number | undefined, event: SavedEvent, type: 'create' | 'update' | 'delete' }>;
  readonly updateBatchSubject = new Subject<{ chatId: number, threadId: number | undefined, events: SavedEvent[], type: 'create' | 'update' }>();
  readonly deleteBatchSubject = new Subject<{ chatId: number, threadId: number | undefined, eventIds: ObjectId[] }>();

  constructor() {
    // Cron job to materialize recurring events - runs daily at 3 AM
    new CronJob('0 3 * * *', async () => {
      console.log('recurring events materialization cron fired');
      try {
        await this.materializeRecurringEvents();
      } catch (e) {
        console.error('Error in recurring events materialization cron:', e);
      }
    }, null, !__DEV__);
  }

  /**
   * Materializes future recurring events for all recurring event groups
   * where the latest materialized event is less than 6 months away.
   */
  private materializeRecurringEvents = async () => {
    const now = Date.now();
    const sixMonthsFromNow = now + SIX_MONTHS_MS;
    const oneYearFromNow = now + ONE_YEAR_MS;

    // Find all distinct recurring event groups
    const recurringGroups = await this.events.aggregate<{
      _id: ObjectId;
      latestDate: number;
      latestEvent: SavedEvent;
    }>([
      // Only non-deleted events with recurrent field
      { $match: { 'recurrent.groupId': { $exists: true }, deleted: { $ne: true } } },
      // Group by recurrent.groupId and find the latest event in each group
      {
        $sort: { date: -1 }
      },
      {
        $group: {
          _id: '$recurrent.groupId',
          latestDate: { $max: '$date' },
          latestEvent: { $first: '$$ROOT' }
        }
      },
      // Only groups where latest event is less than 6 months away
      { $match: { latestDate: { $lt: sixMonthsFromNow } } }
    ]).toArray();

    console.log(`Found ${recurringGroups.length} recurring groups needing materialization`);

    for (const group of recurringGroups) {
      try {
        const { latestEvent, latestDate } = group;
        const recurrent = latestEvent.recurrent;

        if (!recurrent) continue;

        const fromDate = new Date(latestDate);
        const toDate = new Date(oneYearFromNow);

        // Create RRule with dtstart set to the latest event date so occurrences are based on event time, not current time
        // Pass timezone to prevent DST-related time shifts throughout the year
        const rule = new RRule({
          ...RRule.parseString(recurrent.descriptor),
          dtstart: fromDate,
          tzid: latestEvent.tz
        });

        const duration = latestEvent.endDate - latestEvent.date;

        // Get future occurrences starting from the latest existing event
        const futureOccurrences = rule.between(fromDate, toDate, false); // exclude start date

        if (futureOccurrences.length === 0) continue;

        // Skip the first one if it matches the latest event date
        const newOccurrences = futureOccurrences.filter(d => new Date(d).getTime() > latestDate);

        if (newOccurrences.length === 0) continue;

        const baseIdempotencyKey = latestEvent.idempotencyKey.split('_').slice(0, 2).join('_');

        const newEvents = newOccurrences.map(dateObj => {
          const date = new Date(dateObj).getTime();
          const eventId = new ObjectId();
          return {
            _id: eventId,
            title: latestEvent.title,
            description: latestEvent.description,
            tz: latestEvent.tz,
            uid: latestEvent.uid,
            chatId: latestEvent.chatId,
            threadId: latestEvent.threadId,
            date,
            endDate: date + duration,
            recurrent,
            idempotencyKey: `${baseIdempotencyKey}_${date}`,
            seq: 0,
            attendees: { yes: [latestEvent.uid], no: [], maybe: [] },
            geo: null
          };
        });

        // Check for duplicates using idempotency keys
        const idempotencyKeys = newEvents.map(e => e.idempotencyKey);
        const existingEvents = await this.events.find({
          idempotencyKey: { $in: idempotencyKeys }
        }).toArray();
        const existingKeys = new Set(existingEvents.map(e => e.idempotencyKey));

        const eventsToInsert = newEvents.filter(e => !existingKeys.has(e.idempotencyKey));

        if (eventsToInsert.length > 0) {
          await this.events.insertMany(eventsToInsert);

          // Create notifications for new events in batch (grouped by user)
          const notificationsModule = container.resolve(NotificationsModule);
          const session = MDBClient.startSession();
          try {
            await session.withTransaction(async () => {
              // Group events by user for batch processing
              const eventsByUser = new Map<number, { eventId: ObjectId; date: number }[]>();
              for (const event of eventsToInsert) {
                const userEvents = eventsByUser.get(event.uid) || [];
                userEvents.push({ eventId: event._id, date: event.date });
                eventsByUser.set(event.uid, userEvents);
              }

              // Create notifications for each user in batch
              await Promise.all(
                Array.from(eventsByUser.entries()).map(([userId, events]) =>
                  notificationsModule.batchCreateNotificationsForUser(events, userId, session)
                )
              );
            });
          } finally {
            await session.endSession();
          }

          console.log(`Materialized ${eventsToInsert.length} new events for group ${group._id}`);
        }
      } catch (e) {
        console.error(`Error materializing events for group ${group._id}:`, e);
      }
    }

    console.log('Recurring events materialization complete');
  }

  commitOperation = async (chatId: number, threadId: number | undefined, uid: number, command: ClientApiEventUpsertCommand) => {
    const { type, event } = command;
    const session = MDBClient.startSession()
    let _id: ObjectId | undefined
    let materializedFutureEvents: SavedEvent[] = []
    let deletedEventIds: ObjectId[] = []

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
            const fromDate = new Date(eventData.date)
            const toDate = new Date(eventData.date)
            toDate.setFullYear(fromDate.getFullYear() + 1)
            // Create RRule with dtstart set to the event date so occurrences are based on event time, not current time
            // Pass timezone to prevent DST-related time shifts throughout the year
            const rule = new RRule({
              ...RRule.parseString(eventData.recurrent.descriptor),
              dtstart: fromDate,
              tzid: eventData.tz
            })

            const duration = eventData.endDate - eventData.date
            const futureOccurrences = rule.between(fromDate, toDate, false) // false = exclude start date
            const futureEvents = futureOccurrences.slice(1).map(dateObj => { // Skip first occurrence (it's the main event)
              const date = new Date(dateObj).getTime()
              const eventId = new ObjectId()
              return { _id: eventId, ...eventData, idempotencyKey: `${eventData.idempotencyKey}_${date}`, date, endDate: date + duration }
            })

            if (futureEvents.length > 0) {
              await this.events.insertMany(futureEvents, { session })
              // Create notifications for all materialized events in batch
              const notificationsModule = container.resolve(NotificationsModule)
              await notificationsModule.batchCreateNotificationsForUser(
                futureEvents.map(e => ({ eventId: e._id, date: e.date })),
                uid,
                session
              )
              // Track future events to emit after transaction
              materializedFutureEvents = futureEvents
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
          }

          // Determine what to do with recurrent field:
          // - Set it if updating future events AND providing a recurrence pattern
          // - Unset it if:
          //   a) Not updating future events (making this single event non-recurring)
          //   b) OR updating future events with no recurrence (setting to "never")
          const shouldSetRecurrent = udpateFutureRecurringEvents && recurrent
          const shouldUnsetRecurrent = groupId && (!udpateFutureRecurringEvents || !recurrent)

          if (shouldSetRecurrent) {
            eventData.recurrent = {
              groupId: groupId ?? new ObjectId(),
              descriptor: recurrent
            }
          }

          // Build the update operation - use $unset for recurrent when needed
          // (MongoDB ignores undefined values in $set, so we must use $unset to remove fields)
          const updateOp: { $set: Partial<ServerEvent>, $inc: { seq: 1 }, $unset?: { recurrent: '' } } = {
            $set: eventData,
            $inc: { seq: 1 }
          }
          if (shouldUnsetRecurrent) {
            updateOp.$unset = { recurrent: '' }
          }

          await this.events.updateOne({ _id, seq: savedEvent.seq }, updateOp, { session })

          // If updating future recurring events and there's an existing group, delete future events
          // This handles both: changing recurrence pattern AND setting to "never"
          if (udpateFutureRecurringEvents && groupId) {
            const filter = {
              'recurrent.groupId': groupId,
              date: { $gt: savedEvent.date },
              _id: { $ne: _id },
              deleted: { $ne: true }
            }

            // Get IDs of events to delete, then update and delete notifications in one go
            deletedEventIds = await this.events.distinct('_id', filter, { session }) as ObjectId[]

            if (deletedEventIds.length > 0) {
              // Batch soft-delete all events and delete notifications
              await Promise.all([
                this.events.updateMany(
                  { _id: { $in: deletedEventIds } },
                  { $set: { deleted: true }, $inc: { seq: 1 } },
                  { session }
                ),
                container.resolve(NotificationsModule).onEventsDeleted(deletedEventIds, session)
              ])
            }

            // If setting to "never", clear recurrent field from all past events in the group
            // to prevent the cron job from materializing more events
            if (!recurrent) {
              await this.events.updateMany(
                { 'recurrent.groupId': groupId, _id: { $ne: _id } },
                { $unset: { recurrent: '' }, $inc: { seq: 1 } },
                { session }
              )
            }
          }

          // Materialize future events if we have a recurrence rule and updating future events
          // This works for both: existing recurring events AND non-recurring converted to recurring
          const finalRecurrent = eventData.recurrent
          if (udpateFutureRecurringEvents && finalRecurrent) {
            const fromDate = new Date(event.date)
            const toDate = new Date(event.date)
            toDate.setFullYear(fromDate.getFullYear() + 1)
            // Create RRule with dtstart set to the event date so occurrences are based on event time, not current time
            // Pass timezone to prevent DST-related time shifts throughout the year
            const rule = new RRule({
              ...RRule.parseString(finalRecurrent.descriptor),
              dtstart: fromDate,
              tzid: event.tz
            })

            const duration = event.endDate - event.date
            const futureOccurrences = rule.between(fromDate, toDate, false) // false = exclude start date
            const futureEvents = futureOccurrences.slice(1).map(dateObj => { // Skip first occurrence (it's the edited event)
              const date = new Date(dateObj).getTime()
              const eventId = new ObjectId()
              return {
                ...savedEvent,
                ...event,
                _id: eventId,
                recurrent: finalRecurrent,
                idempotencyKey: `${savedEvent.idempotencyKey.split('_').slice(0, 2).join('_')}_${date}_${savedEvent.seq}`,
                date,
                endDate: date + duration,
                seq: 0
              }
            })
            if (futureEvents.length > 0) {
              await this.events.insertMany(futureEvents, { session })
              // Create notifications for all re-materialized events in batch
              const notificationsModule = container.resolve(NotificationsModule)
              await notificationsModule.batchCreateNotificationsForUser(
                futureEvents.map(e => ({ eventId: e._id, date: e.date })),
                savedEvent.uid,
                session
              )
              // Track re-materialized events to emit after transaction
              materializedFutureEvents = futureEvents
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

    // Emit all deleted future event IDs as a batch (for update with udpateFutureRecurringEvents)
    if (deletedEventIds.length > 0) {
      this.deleteBatchSubject.next({ chatId, threadId, eventIds: deletedEventIds });
    }

    // Emit all materialized future events for recurring events as a batch
    if (materializedFutureEvents.length > 0) {
      this.updateBatchSubject.next({ chatId, threadId, events: materializedFutureEvents, type: 'create' });
    }

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
      let deletedEventIds: ObjectId[] = []
      try {
        await session.withTransaction(async () => {
          // Delete the main event
          await this.events.updateOne({ _id }, { $set: { deleted: true }, $inc: { seq: 1 } }, { session });
          // update notifications for main event
          await container.resolve(NotificationsModule).onEventDeleted(_id, session)

          // If deleting future recurring events
          if (deleteFutureRecurringEvents && event!.recurrent?.groupId) {
            const groupId = event!.recurrent.groupId
            const filter = {
              'recurrent.groupId': groupId,
              date: { $gt: event!.date },
              deleted: { $ne: true }
            }

            // Get IDs of events to delete
            deletedEventIds = await this.events.distinct('_id', filter, { session }) as ObjectId[]

            if (deletedEventIds.length > 0) {
              // Batch soft-delete all events and delete notifications in parallel
              await Promise.all([
                this.events.updateMany(
                  { _id: { $in: deletedEventIds } },
                  { $set: { deleted: true }, $inc: { seq: 1 } },
                  { session }
                ),
                container.resolve(NotificationsModule).onEventsDeleted(deletedEventIds, session)
              ])
            }

            // Clear recurrent field from all past events in the group
            // to prevent the cron job from materializing more events
            await this.events.updateMany(
              { 'recurrent.groupId': groupId, _id: { $ne: _id } },
              { $unset: { recurrent: '' }, $inc: { seq: 1 } },
              { session }
            )
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

      // notify about all future deleted event IDs as a batch
      if (deletedEventIds.length > 0) {
        this.deleteBatchSubject.next({ chatId, threadId, eventIds: deletedEventIds });
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
