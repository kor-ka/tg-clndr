import { ObjectId } from "mongodb";
import { singleton } from "tsyringe";
import { STATS } from "./statsStore";

@singleton()
export class StatsModule {
  private stats = STATS();
  onSessionStart = async (_id: ObjectId, userId: number, chatId: number) => {
    await this.stats.insertOne({ _id, type: 'ws_session', userId, chatId, start: Date.now() })
  }

  onSessionEnd = async (_id: ObjectId) => {
    const now = Date.now()
    await this.stats.updateOne({ _id }, [{ $set: { end: now, length: { $subtract: [now, '$start'] } } }])
  }

  onMessage = async (userId: number, chatId: number, command: string) => {
    await this.stats.insertOne({ type: 'tg_message', userId, chatId, command })
  }

  onCallbackQuery = async (userId: number, chatId: number, command: string) => {
    await this.stats.insertOne({ type: 'tg_callback_query', userId, chatId, command })
  }
}
