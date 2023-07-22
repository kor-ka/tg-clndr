import { ServerEvent, SavedEvent, EVENTS, LATEST_EVENTS } from "./eventStore";
import { singleton } from "tsyringe";
import { MDBClient } from "../../utils/MDB";
import { ObjectId, WithId } from "mongodb";
import { Subject } from "../../utils/subject";
import { ClientApiUpsertCommand } from "../../../../src/shared/entity";

@singleton()
export class EventsModule {
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

  commitOperation = async (chatId: number, threadId: number | undefined, uid: number, command: ClientApiUpsertCommand) => {
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
          _id = (await this.events.insertOne({ ...eventData, seq: 0, idempotencyKey: `${uid}_${id}`, attendees: { yes: [uid], no: [], maybe: [] } }, { session })).insertedId
        } else if (type === 'update') {
          const { id, ...event } = command.event
          _id = new ObjectId(id)
          // update op
          const op = (await this.events.findOne({ _id, deleted: { $ne: true } }))
          if (!op) {
            throw new Error("Operation not found")
          }
          await this.events.updateOne({ _id, seq: op.seq }, { $set: event, $inc: { seq: 1 } }, { session })

          // keep latest date latest
          const latest = (await this.events.find({ chatId, threadId }).sort({ date: -1 }).limit(1).toArray())[0];
          latestDateCandidate = Math.max(latestDateCandidate, latest?.date)
        } else {
          throw new Error('Unknown operation modification type')
        }

        // bump latest index
        await this.eventsLatest.updateOne({ chatId, threadId }, { $max: { date: latestDateCandidate } }, { upsert: true });

      })

    } finally {
      await session.endSession();
    }

    // non-blocking cache update
    this.getEvents(chatId, threadId).catch((e) => console.error(e));

    const updatedEvent = await this.events.findOne({ _id });
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
      await this.events.updateOne({ _id }, { $set: { deleted: true }, $inc: { seq: 1 } });
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

  prevDayStart = () => {
    let date = new Date(new Date().getTime() - (1000 * 60 * 60 * 24) / 2);
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime();
  }

  updateAtendeeStatus = async (chatId: number, threadId: number | undefined, eventId: string, uid: number, status: 'yes' | 'no' | 'maybe') => {
    const _id = new ObjectId(eventId);
    const addTo = status
    const pullFrom = ['yes', 'no', 'maybe'].filter(s => s != addTo).map(k => `attendees.${k}`)
    await this.events.updateOne({ _id }, { $pull: { [pullFrom[0]]: uid, [pullFrom[1]]: uid }, $addToSet: { [`attendees.${addTo}`]: uid }, $inc: { seq: 1 } })

    // non-blocking cache update
    this.getEvents(chatId, threadId).catch((e) => console.error(e));

    const updatedEvent = await this.events.findOne({ _id });
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
    const prevDayStart = this.prevDayStart();
    let res = await this.events.find({ chatId, threadId, date: { $gt: prevDayStart }, deleted: { $ne: true } }, { limit, sort: { date: 1 } }).toArray();
    res = res.filter(e => e.date >= freshEnough);
    this.logCache.set(`${chatId}-${threadId ?? undefined}-${limit}-${prevDayStart}`, res)
    return res
  }

  getEventsCached = async (chatId: number, threadId: number | undefined, limit = 200) => {
    const now = new Date().getTime();
    const freshEnough = now - 1000 * 60 * 60 * 4;
    const prevDayStart = this.prevDayStart();

    let events = this.logCache.get(`${chatId}-${threadId ?? undefined}-${limit}-${prevDayStart}`)?.filter(e => e.date >= freshEnough)
    const eventsPromise = this.getEvents(chatId, threadId, limit)
    if (!events) {
      events = await eventsPromise
    }
    return { events, eventsPromise }
  }
}
