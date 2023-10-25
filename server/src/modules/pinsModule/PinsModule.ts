import { PINS } from "./pinsStore";
import { singleton } from "tsyringe";

@singleton()
export class PinsModule {
  private db = PINS();

  updatePinMeta = async (chatId: number, threadId: number | undefined, options: {
    messageId?: number, chatInstance?: string, text?: string, inlineKeyboardDescriptor?: string
  }) => {
    const { messageId, chatInstance, text, inlineKeyboardDescriptor } = options;
    return await this.db.findOneAndUpdate(
      { chatId, threadId },
      {
        $set: {
          chatId,
          ...messageId ? { messageId } : {},
          ...chatInstance ? { chatInstance } : {},
          ...text ? { text } : {},
          ...inlineKeyboardDescriptor ? { inlineKeyboardDescriptor } : {},
        }
      },
      { upsert: true, returnDocument: 'before' }
    );
  };

  getPinMeta = async (chatId: number, threadId: number | undefined) => {
    return await this.db.findOne({ chatId, threadId });
  };
}
