import { ServerEvent, SavedEvent, EVENTS, LATEST_EVENTS } from "./eventStore";
import { container, singleton } from "tsyringe";
import { MDBClient } from "../../utils/MDB";
import { ObjectId, WithId } from "mongodb";
import { Subject } from "../../utils/subject";
import { ClientApiEventUpsertCommand } from "../../../../src/shared/entity";
import { GeoModule } from "../geoModule/GeoModule";
import { NotificationsModule } from "../notificationsModule/NotificationsModule";
import * as linkify from 'linkifyjs';
import { parseMeta as getMeta } from "./metaParser";
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
    try {
      await session.withTransaction(async () => {
        // Write op
        if (command.type === 'create') {
          const { id, ...event } = command.event
          const eventData = { ...event, uid, chatId, threadId };
          // create new event
          _id = (await this.events.insertOne({ ...eventData, seq: 0, idempotencyKey: `${uid}_${id}`, attendees: { yes: [uid], no: [], maybe: [] }, geo: null }, { session })).insertedId
          await container.resolve(NotificationsModule).updateNotificationOnAttend(_id, event.date, true, uid, session)
        } else if (type === 'update') {
          const { id, ...event } = command.event
          _id = new ObjectId(id)
          // update event
          const savedEvent = (await this.events.findOne({ _id, deleted: { $ne: true } }, { session }))
          if (!savedEvent) {
            throw new Error("Operation not found")
          }
          await this.events.updateOne({ _id, seq: savedEvent.seq }, { $set: event, $inc: { seq: 1 } }, { session })

          // update notifications
          await container.resolve(NotificationsModule).onEventUpdated(_id, event.date, session)

          // keep latest date latest
          const latest = (await this.events.find({ chatId, threadId }, { session }).sort({ date: -1 }).limit(1).toArray())[0];
          latestDateCandidate = Math.max(latestDateCandidate, latest?.date)
        } else {
          throw new Error('Unknown operation modification type')
        }

        // bump latest index
        await this.eventsLatest.updateOne({ chatId, threadId }, { $max: { date: latestDateCandidate } }, { upsert: true, session });

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
      // geo
      if (command.event.description) {
        this.geo.geocode(command.event.description)
          // never wait 3d party APIs
          .then(geo => this.events.updateOne({ _id }, { $set: { geo } }))
          .catch(e => console.error(e));
      } else {
        syncActions.push(
          this.events.updateOne({ _id }, { $set: { geo: undefined } })
            .catch(e => console.error(e))
        );
      }

      // meta images
      let clearMeta = !command.event.description;
      if (command.event.description) {
        const url = linkify.find(event.description, 'url').find(u => u.isLink)?.href;
        clearMeta = clearMeta || !url;
        if (url) {
          getMeta(url)
            // never wait 3d party APIs
            .then((meta) => meta && this.events.updateOne({ _id }, { $set: { imageURL: meta.og.image || meta.images?.[0].src } }))
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
  deleteEvent = async (id: string) => {
    const _id = new ObjectId(id);
    let event = await this.events.findOne({ _id });
    if (!event) {
      throw new Error("Operation not found")
    }
    const { chatId, threadId } = event;
    if (event?.deleted) {
      // already deleted - just return 
      return event;
    } else {
      const session = MDBClient.startSession()
      try {
        await session.withTransaction(async () => {
          await this.events.updateOne({ _id }, { $set: { deleted: true }, $inc: { seq: 1 } }, { session });
          // update notifications
          await container.resolve(NotificationsModule).onEventDeleted(_id, session)
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

      // notify all
      this.upateSubject.next({ chatId, threadId, event, type: 'delete' });

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
    const freshEnough = now - 1000 * 60 * 60 * 4;
    let res = await this.events.find({ chatId, threadId, date: { $gt: freshEnough }, deleted: { $ne: true } }, { limit, sort: { date: 1 } }).toArray();
    this.logCache.set(`${chatId}-${threadId ?? undefined}-${limit}`, res)
    return res
  }

  getEventsDateRange = async (from: number, to: number, chatId: number, threadId: number | null): Promise<SavedEvent[]> => {
    return await this.events.find({ chatId, threadId: threadId ?? undefined, date: { $gte: from, $lt: to }, deleted: { $ne: true } }, { sort: { date: 1 } }).toArray();
  }

  getEventsCached = async (chatId: number, threadId: number | undefined, limit = 200) => {
    const now = new Date().getTime();
    const freshEnough = now - 1000 * 60 * 60 * 4;

    let events = this.logCache.get(`${chatId}-${threadId ?? undefined}-${limit}`)?.filter(e => e.date >= freshEnough)
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
