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

  private onMetaUpdated = async (chatId: number) => {
    const meta = await this.db.findOne({ chatId })
    if (meta) {
      this.metaSubject.next(meta);
    } else {
      throw new Error("chat meta lost during udpate")
    }
    return meta
  };

  updateChat = async (chatId: number, name: string) => {
    let res = (await this.db.findOneAndUpdate(
      { chatId },
      { $set: { chatId, name }, $setOnInsert: { "settings.allowPublicEdit": chatId <= 0, "settings.enableEventMessages": chatId <= 0 } },
      { upsert: true, returnDocument: 'after' }
    )).value;
    this.onMetaUpdated(chatId).catch(e => console.error(e));
    if (!res) {
      throw new Error(`updateChat: chat not found ${chatId}`)
    }
    return res;
  };

  updateChatSetings = async (chatId: number, settings: Partial<ChatMeta['settings']>) => {
    const upd = {
      ...settings.allowPublicEdit !== undefined ? { 'settings.allowPublicEdit': settings.allowPublicEdit } : {},
      ...settings.enableEventMessages !== undefined ? { 'settings.enableEventMessages': settings.enableEventMessages } : {},
    }
    await this.db.updateOne(
      { chatId },
      { $set: upd },
    );
    return this.onMetaUpdated(chatId);
  }

  getChatMeta = async (chatId: number) => {
    return await this.db.findOne({ chatId });
  };
}
