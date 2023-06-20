import { PINS } from "./pinsStore";
import { singleton } from "tsyringe";

@singleton()
export class PinsModule {
  private db = PINS();

  updatePinMeta = async (chatId: number, threadId: number | undefined, options: {
    messageId?: number, chatInstance?: string
  }) => {
    const { messageId, chatInstance } = options;
    return await this.db.updateOne(
      { chatId, threadId },
      {
        $set: {
          chatId,
          ...messageId ? { messageId } : {},
          ...chatInstance ? { chatInstance } : {}
        }
      },
      { upsert: true }
    );
  };

  getPinMeta = async (chatId: number, threadId: number | undefined) => {
    return await this.db.findOne({ chatId, threadId });
  };
}
