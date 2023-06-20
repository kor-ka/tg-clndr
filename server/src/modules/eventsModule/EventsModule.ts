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

  commitOperation = async (chatId: number, threadId: number | undefined, uid: number, command: ClientApiUpsertCommand) => {
    const { type, event } = command;
    const session = MDBClient.startSession()
    let _id: ObjectId | undefined
    try {
      await session.withTransaction(async () => {
        // Write op
        if (command.type === 'create') {
          const { id, ...event } = command.event
          const eventData = { ...event, uid, chatId, threadId };
          // create new event
          _id = (await this.events.insertOne({ ...eventData, seq: 0, idempotencyKey: `${uid}_${id}` }, { session })).insertedId
          // bump latest index
          await this.eventsLatest.updateOne({ chatId, threadId }, { $max: { date: event.date } }, { upsert: true });
        } else if (type === 'update') {
          const { id, ...event } = command.event
          _id = new ObjectId(id)
          // update op
          const op = (await this.events.findOne({ _id, deleted: { $ne: true } }))
          if (!op) {
            throw new Error("Operation not found")
          }
          await this.events.updateOne({ _id, seq: op.seq }, { $set: event, $inc: { seq: 1 } }, { session })
          // revert balance
        } else {
          throw new Error('Unknown operation modification type')
        }

      })

      // non-blocking cache update
      this.getEvents(chatId, threadId).catch((e) => console.error(e))

      const event = await this.events.findOne({ _id })
      if (!event) {
        throw new Error("operation lost during " + type)
      }

      // notify all
      this.upateSubject.next({ chatId, threadId, event, type })
      return event

    } finally {
      await session.endSession()
    }
  };

  // TODO: merge with commit? - two signatures for this function?
  deleteEvent = async (id: string) => {
    const _id = new ObjectId(id);
    const event = await this.events.findOne({ _id });
    if (!event) {
      throw new Error("Operation not found")
    }
    const { chatId, threadId } = event;
    if (event?.deleted) {
      // already deleted - just return 
      return event;
    } else {
      await this.events.updateOne({ _id }, { $set: { deleted: true }, $inc: { seq: 1 } });

      // non-blocking cache update
      this.getEvents(chatId, threadId).catch((e) => console.error(e))

      // notify all
      this.upateSubject.next({ chatId, threadId, event: event, type: 'delete' })

      return event;
    }
  }

  prevDayStart = () => {
    let date = new Date(new Date().getTime() - (1000 * 60 * 60 * 24) / 2);
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime();
  }

  logCache = new Map<string, SavedEvent[]>();
  getEvents = async (chatId: number, threadId: number | undefined, limit = 200): Promise<SavedEvent[]> => {
    const now = new Date().getTime()
    const prevDayStart = this.prevDayStart()
    let res = await this.events.find({ chatId, threadId, date: { $gt: prevDayStart }, deleted: { $ne: true } }, { limit, sort: { date: 1 } }).toArray();
    res = res.filter(e => e.date >= now);
    this.logCache.set(`${chatId}-${threadId ?? undefined}-${limit}-${prevDayStart}`, res)
    return res
  }

  getEventsCached = async (chatId: number, threadId: number | undefined, limit = 200) => {
    const now = new Date().getTime()
    const prevDayStart = this.prevDayStart()

    let events = this.logCache.get(`${chatId}-${threadId ?? undefined}-${limit}-${prevDayStart}`)?.filter(e => e.date >= now)
    const eventsPromise = this.getEvents(chatId, threadId, limit)
    if (!events) {
      events = await eventsPromise
    }
    return { events, eventsPromise }
  }
}