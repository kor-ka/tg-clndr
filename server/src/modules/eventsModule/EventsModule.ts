import { ServerEvent, SavedEvent, EVENTS, LATEST_EVENTS, RECURRING_GROUPS, RecurringGroupMeta } from "./eventStore";
import { container, singleton } from "tsyringe";
import { MDBClient } from "../../utils/MDB";
import { ClientSession, ObjectId, WithId } from "mongodb";
import { Subject } from "../../utils/subject";
import { ClientApiEventUpsertCommand, ClientApiEventDeleteCommand, Duraion } from "../../../../src/shared/entity";
import { GeoModule } from "../geoModule/GeoModule";
import { NotificationsModule } from "../notificationsModule/NotificationsModule";
import * as linkify from 'linkifyjs';
import { parseMeta as getMeta } from "./metaParser";
import {
  materializeRecurringEvents,
  generateRecurringGroupId,
  getMaterializationHorizon,
  validateRRule,
  needsMaterialization
} from "./recurringUtils";
import { CronJob } from "cron";
import { __DEV__ } from "../../utils/dev";

@singleton()
export class EventsModule {
  private geo = container.resolve(GeoModule)

  private events = EVENTS();
  private eventsLatest = LATEST_EVENTS();
  private recurringGroups = RECURRING_GROUPS();

  readonly upateSubject = new Subject<{ chatId: number, threadId: number | undefined, event: SavedEvent, type: 'create' | 'update' | 'delete' }>;

  constructor() {
    // Run materialization extension every hour
    new CronJob('0 * * * *', async () => {
      console.log('recurring events materialization cron fire');
      try {
        const count = await this.extendRecurringMaterialization(50);
        if (count > 0) {
          console.log(`Materialized ${count} recurring events`);
        }
      } catch (e: any) {
        console.error('Recurring materialization error:', e?.message);
      }
    }, null, !__DEV__);
  }

  commitOperation = async (chatId: number, threadId: number | undefined, uid: number, command: ClientApiEventUpsertCommand) => {
    const { type, event } = command;
    const session = MDBClient.startSession()
    let _id: ObjectId | undefined
    let materializedEvents: SavedEvent[] = [];

    let latestDateCandidate = event.date;
    let latestEndDateCandidate = event.endDate ?? event.date + Duraion.h;
    try {
      await session.withTransaction(async () => {
        // Write op
        if (command.type === 'create') {
          const { id, rrule, ...eventRest } = command.event
          const eventData = { ...eventRest, endDate: eventRest.endDate ?? eventRest.date + Duraion.h, uid, chatId, threadId };

          // Validate rrule if provided
          if (rrule) {
            const validation = validateRRule(rrule);
            if (!validation.valid) {
              throw new Error(`Invalid RRule: ${validation.error}`);
            }
          }

          // create new event (template for recurring)
          const recurringGroupId = rrule ? generateRecurringGroupId() : undefined;
          const baseEventData: ServerEvent = {
            ...eventData,
            seq: 0,
            idempotencyKey: `${uid}_${id}`,
            attendees: { yes: [uid], no: [], maybe: [] },
            geo: null,
            rrule,
            recurringGroupId,
            recurringEventId: undefined, // Template event doesn't have a parent
          };

          _id = (await this.events.insertOne(baseEventData, { session })).insertedId;
          await container.resolve(NotificationsModule).updateNotificationOnAttend(_id, eventData.date, true, uid, session);

          // Materialize recurring events if rrule is provided
          if (rrule && recurringGroupId) {
            const horizon = getMaterializationHorizon();
            const materializedData = materializeRecurringEvents(
              { date: eventData.date, endDate: eventData.endDate, rrule },
              recurringGroupId,
              _id.toHexString()
            );

            if (materializedData.length > 0) {
              const eventsToInsert: ServerEvent[] = materializedData.map((m, idx) => ({
                ...eventData,
                date: m.date,
                endDate: m.endDate,
                seq: 0,
                idempotencyKey: `${uid}_${id}_recur_${idx}`,
                attendees: { yes: [uid], no: [], maybe: [] },
                geo: null,
                rrule: undefined, // Only template has rrule
                recurringGroupId: m.recurringGroupId,
                recurringEventId: m.recurringEventId,
              }));

              const insertResult = await this.events.insertMany(eventsToInsert, { session });

              // Create notifications for all materialized events
              const notificationsModule = container.resolve(NotificationsModule);
              for (let i = 0; i < eventsToInsert.length; i++) {
                const insertedId = insertResult.insertedIds[i];
                await notificationsModule.updateNotificationOnAttend(insertedId, eventsToInsert[i].date, true, uid, session);
              }

              // Update latest date candidate
              const lastMaterialized = eventsToInsert[eventsToInsert.length - 1];
              latestDateCandidate = Math.max(latestDateCandidate, lastMaterialized.date);
              latestEndDateCandidate = Math.max(latestEndDateCandidate, lastMaterialized.endDate);
            }

            // Create recurring group metadata for continuous materialization
            const groupMeta: RecurringGroupMeta = {
              groupId: recurringGroupId,
              chatId,
              threadId,
              rrule,
              templateEventId: _id.toHexString(),
              materializationHorizon: horizon,
            };
            await this.recurringGroups.insertOne(groupMeta, { session });
          }

        } else if (type === 'update') {
          const { id, rrule, ...eventRest } = command.event;
          const recurringMode = command.recurringMode;
          _id = new ObjectId(id);

          const savedEvent = await this.events.findOne({ _id, deleted: { $ne: true } }, { session });
          if (!savedEvent) {
            throw new Error("Operation not found");
          }

          const eventWithEndDate = { ...eventRest, endDate: eventRest.endDate ?? eventRest.date + Duraion.h };

          if (savedEvent.recurringGroupId && recurringMode === 'thisAndFuture') {
            // Edit this and all future recurring events
            // Delete all future events in the group (including this one)
            await this.deleteFutureRecurringEvents(savedEvent.recurringGroupId, savedEvent.date, uid, session);

            // Mark the old recurring group as deleted
            await this.recurringGroups.updateOne(
              { groupId: savedEvent.recurringGroupId },
              { $set: { deleted: true } },
              { session }
            );

            // Create new recurring group with updated event data
            const newGroupId = generateRecurringGroupId();
            const newRRule = rrule || savedEvent.rrule;

            if (newRRule) {
              const validation = validateRRule(newRRule);
              if (!validation.valid) {
                throw new Error(`Invalid RRule: ${validation.error}`);
              }
            }

            // Create new template event
            const newTemplateData: ServerEvent = {
              ...savedEvent,
              ...eventWithEndDate,
              rrule: newRRule,
              recurringGroupId: newGroupId,
              recurringEventId: undefined,
              seq: 0,
              idempotencyKey: `${uid}_${id}_regen_${Date.now()}`,
            };
            delete (newTemplateData as any)._id;

            const newTemplateResult = await this.events.insertOne(newTemplateData, { session });
            _id = newTemplateResult.insertedId;

            await container.resolve(NotificationsModule).updateNotificationOnAttend(_id, eventWithEndDate.date, true, uid, session);

            // Materialize new recurring events
            if (newRRule) {
              const horizon = getMaterializationHorizon();
              const materializedData = materializeRecurringEvents(
                { date: eventWithEndDate.date, endDate: eventWithEndDate.endDate, rrule: newRRule },
                newGroupId,
                _id.toHexString()
              );

              if (materializedData.length > 0) {
                const eventsToInsert: ServerEvent[] = materializedData.map((m, idx) => ({
                  ...newTemplateData,
                  date: m.date,
                  endDate: m.endDate,
                  seq: 0,
                  idempotencyKey: `${uid}_${id}_recur_regen_${Date.now()}_${idx}`,
                  rrule: undefined,
                  recurringGroupId: m.recurringGroupId,
                  recurringEventId: m.recurringEventId,
                }));
                delete (eventsToInsert as any)._id;

                const insertResult = await this.events.insertMany(eventsToInsert, { session });

                const notificationsModule = container.resolve(NotificationsModule);
                for (let i = 0; i < eventsToInsert.length; i++) {
                  const insertedId = insertResult.insertedIds[i];
                  await notificationsModule.updateNotificationOnAttend(insertedId, eventsToInsert[i].date, true, uid, session);
                }

                const lastMaterialized = eventsToInsert[eventsToInsert.length - 1];
                latestDateCandidate = Math.max(latestDateCandidate, lastMaterialized.date);
                latestEndDateCandidate = Math.max(latestEndDateCandidate, lastMaterialized.endDate);
              }

              // Create new recurring group metadata
              const groupMeta: RecurringGroupMeta = {
                groupId: newGroupId,
                chatId,
                threadId,
                rrule: newRRule,
                templateEventId: _id.toHexString(),
                materializationHorizon: horizon,
              };
              await this.recurringGroups.insertOne(groupMeta, { session });
            }

          } else {
            // Single event update (or non-recurring event)
            // If it's a recurring event instance being edited as single, exclude it from group
            const updateData: any = { ...eventWithEndDate };
            if (savedEvent.recurringGroupId && recurringMode === 'single') {
              updateData.excludedFromGroup = true;
              // Remove from recurring group
              updateData.recurringGroupId = undefined;
              updateData.recurringEventId = undefined;
            }

            await this.events.updateOne(
              { _id, seq: savedEvent.seq },
              { $set: updateData, $inc: { seq: 1 } },
              { session }
            );

            await container.resolve(NotificationsModule).onEventUpdated(_id, eventRest.date, session);
          }

          // keep latest date latest
          const latest = (await this.events.find({ chatId, threadId }, { session }).sort({ date: -1 }).limit(1).toArray())[0];
          latestDateCandidate = Math.max(latestDateCandidate, latest?.date);
          latestEndDateCandidate = latest?.endDate ?? (latest?.date + Duraion.h);

        } else {
          throw new Error('Unknown operation modification type');
        }

        // bump latest index
        await this.eventsLatest.updateOne({ chatId, threadId }, { $max: { date: latestDateCandidate, endDate: latestEndDateCandidate } }, { upsert: true, session });

      });

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

  /**
   * Delete all future events in a recurring group (including the event at the given date)
   */
  private deleteFutureRecurringEvents = async (
    recurringGroupId: string,
    fromDate: number,
    uid: number,
    session: ClientSession
  ): Promise<SavedEvent[]> => {
    const futureEvents = await this.events.find({
      recurringGroupId,
      date: { $gte: fromDate },
      deleted: { $ne: true }
    }, { session }).toArray();

    if (futureEvents.length > 0) {
      await this.events.updateMany(
        { recurringGroupId, date: { $gte: fromDate }, deleted: { $ne: true } },
        { $set: { deleted: true }, $inc: { seq: 1 } },
        { session }
      );

      // Delete notifications for all these events
      const notificationsModule = container.resolve(NotificationsModule);
      for (const event of futureEvents) {
        await notificationsModule.onEventDeleted(event._id, session);
      }
    }

    return futureEvents;
  };

  // TODO: merge with commit? - two signatures for this function?
  deleteEvent = async (id: string, recurringMode?: 'single' | 'thisAndFuture') => {
    const _id = new ObjectId(id);
    let event = await this.events.findOne({ _id });
    if (!event) {
      throw new Error("Operation not found")
    }
    const { chatId, threadId } = event;
    if (event?.deleted) {
      // already deleted - just return
      return event;
    }

    const deletedEvents: SavedEvent[] = [];

    const session = MDBClient.startSession()
    try {
      await session.withTransaction(async () => {
        if (event!.recurringGroupId && recurringMode === 'thisAndFuture') {
          // Delete this and all future events in the recurring group
          const futureEvents = await this.deleteFutureRecurringEvents(
            event!.recurringGroupId,
            event!.date,
            event!.uid,
            session
          );
          deletedEvents.push(...futureEvents);

          // Mark the recurring group as deleted
          await this.recurringGroups.updateOne(
            { groupId: event!.recurringGroupId },
            { $set: { deleted: true } },
            { session }
          );
        } else {
          // Single event delete
          await this.events.updateOne({ _id }, { $set: { deleted: true }, $inc: { seq: 1 } }, { session });
          await container.resolve(NotificationsModule).onEventDeleted(_id, session);
          deletedEvents.push(event!);
        }
      })
    } finally {
      await session.endSession();
    }

    // Reload the primary event
    event = await this.events.findOne({ _id })
    if (!event) {
      throw new Error("event lost during delete")
    }

    // non-blocking cache update
    this.getEvents(chatId, threadId).catch((e) => console.error(e));

    // notify all about deleted events
    for (const deletedEvent of deletedEvents) {
      const updatedEvent = await this.events.findOne({ _id: deletedEvent._id });
      if (updatedEvent) {
        this.upateSubject.next({ chatId, threadId, event: updatedEvent, type: 'delete' });
      }
    }

    return event;
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

  /**
   * Extend materialization horizon for recurring groups that need it.
   * Called by the scheduler to ensure recurring events are always materialized ahead.
   */
  extendRecurringMaterialization = async (limit = 100): Promise<number> => {
    const thirtyDaysFromNow = Date.now() + 30 * 24 * 60 * 60 * 1000;

    // Find recurring groups that need materialization
    const groupsToExtend = await this.recurringGroups.find({
      deleted: { $ne: true },
      materializationHorizon: { $lt: thirtyDaysFromNow }
    }).limit(limit).toArray();

    let totalMaterialized = 0;

    for (const group of groupsToExtend) {
      try {
        const templateEvent = await this.events.findOne({
          _id: new ObjectId(group.templateEventId),
          deleted: { $ne: true }
        });

        if (!templateEvent || !templateEvent.rrule) {
          // Template was deleted or no longer has rrule, mark group as deleted
          await this.recurringGroups.updateOne(
            { groupId: group.groupId },
            { $set: { deleted: true } }
          );
          continue;
        }

        const newHorizon = getMaterializationHorizon();
        const eventDuration = templateEvent.endDate - templateEvent.date;

        // Generate new occurrences from current horizon to new horizon
        const materializedData = materializeRecurringEvents(
          { date: templateEvent.date, endDate: templateEvent.endDate, rrule: templateEvent.rrule },
          group.groupId,
          group.templateEventId,
          group.materializationHorizon,
          newHorizon
        );

        if (materializedData.length > 0) {
          const session = MDBClient.startSession();
          try {
            await session.withTransaction(async () => {
              const eventsToInsert: ServerEvent[] = materializedData.map((m, idx) => ({
                ...templateEvent,
                date: m.date,
                endDate: m.endDate,
                seq: 0,
                idempotencyKey: `${templateEvent.uid}_${group.groupId}_extend_${Date.now()}_${idx}`,
                attendees: { ...templateEvent.attendees },
                geo: templateEvent.geo,
                rrule: undefined,
                recurringGroupId: m.recurringGroupId,
                recurringEventId: m.recurringEventId,
              }));
              // Remove _id from template copy
              eventsToInsert.forEach(e => delete (e as any)._id);

              const insertResult = await this.events.insertMany(eventsToInsert, { session });

              // Create notifications for attending users
              const notificationsModule = container.resolve(NotificationsModule);
              for (let i = 0; i < eventsToInsert.length; i++) {
                const insertedId = insertResult.insertedIds[i];
                const event = eventsToInsert[i];
                // Create notifications for all users who said yes
                for (const uid of event.attendees.yes) {
                  await notificationsModule.updateNotificationOnAttend(insertedId, event.date, true, uid, session);
                }
              }

              // Update latest events if needed
              const lastEvent = eventsToInsert[eventsToInsert.length - 1];
              await this.eventsLatest.updateOne(
                { chatId: group.chatId, threadId: group.threadId },
                { $max: { date: lastEvent.date, endDate: lastEvent.endDate } },
                { upsert: true, session }
              );

              // Update the materialization horizon
              await this.recurringGroups.updateOne(
                { groupId: group.groupId },
                { $set: { materializationHorizon: newHorizon } },
                { session }
              );

              totalMaterialized += eventsToInsert.length;
            });
          } finally {
            await session.endSession();
          }

          // Invalidate cache for this chat
          this.getEvents(group.chatId, group.threadId).catch(e => console.error(e));
        } else {
          // No new events to materialize, just update horizon
          await this.recurringGroups.updateOne(
            { groupId: group.groupId },
            { $set: { materializationHorizon: newHorizon } }
          );
        }
      } catch (e) {
        console.error(`Failed to extend materialization for group ${group.groupId}:`, e);
      }
    }

    return totalMaterialized;
  }

  /**
   * Get recurring group info for an event
   */
  getRecurringGroupInfo = async (eventId: string): Promise<RecurringGroupMeta | null> => {
    const event = await this.events.findOne({ _id: new ObjectId(eventId) });
    if (!event?.recurringGroupId) {
      return null;
    }
    return this.recurringGroups.findOne({ groupId: event.recurringGroupId, deleted: { $ne: true } });
  }
}
