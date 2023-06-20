import { randomBytes } from "crypto";
import { ObjectId } from "mongodb";
import { singleton } from "tsyringe";
import { Subject } from "../../utils/subject";
import { CHATMETA } from "./chatMetaStore";
import { ChatMeta } from "./chatMetaStore";

@singleton()
export class ChatMetaModule {
  private db = CHATMETA();

  metaSubject = new Subject<ChatMeta>();

  private onMetaUpdated = (chatId: number) => {
    this.db.findOne({ chatId }).then((meta) => {
      if (meta) {
        this.metaSubject.next(meta);
      }
    });
  };

  updateChat = async (chatId: number, name: string) => {
    let res = await this.db.updateOne(
      { chatId },
      { $set: { chatId, name }, $setOnInsert: { token: randomBytes(16).toString('hex') } },
      { upsert: true }
    );
    this.onMetaUpdated(chatId);
    return res;
  };

  getChatMeta = async (chatId: number) => {
    return await this.db.findOne({ chatId });
  };
}
