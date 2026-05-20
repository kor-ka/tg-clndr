import { singleton } from "tsyringe";
import { Subject } from "../../utils/subject";
import { TOPICS } from "./topicsStore";

@singleton()
export class TopicsModule {
  private db = TOPICS();

  topicUpdated = new Subject<{ chatId: number, threadId: number, name: string }>();

  upsertTopic = async (chatId: number, threadId: number, name: string) => {
    await this.db.updateOne(
      { chatId, threadId },
      { $set: { chatId, threadId, name } },
      { upsert: true },
    );
    this.topicUpdated.next({ chatId, threadId, name });
  };

  getTopics = async (chatId: number): Promise<Map<number, string>> => {
    const docs = await this.db.find({ chatId }).toArray();
    return new Map(docs.map(d => [d.threadId, d.name]));
  };
}
