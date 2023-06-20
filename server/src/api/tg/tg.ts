import TB from "node-telegram-bot-api";
import { PinsModule } from "../../modules/pinsModule/PinsModule";
import { renderPin } from "./renderPin";
import { container } from "tsyringe";
import { ChatMetaModule } from "../../modules/chatMetaModule/ChatMetaModule";
import { EventsModule } from "../../modules/eventsModule/EventsModule";
import { UserModule } from "../../modules/userModule/UserModule";
import { EVENTS, LATEST_EVENTS } from "../../modules/eventsModule/eventStore";
import { MDBClient } from "../../utils/MDB";
import { CronJob } from "cron";
export class TelegramBot {
  private pinModule = container.resolve(PinsModule);
  private chatMetaModule = container.resolve(ChatMetaModule);
  private userModule = container.resolve(UserModule)
  private eventsModule = container.resolve(EventsModule)

  private token = process.env.TELEGRAM_BOT_TOKEN!;
  private bot = new TB(this.token, {
    polling: true,
  });

  private createPin = async (chatId: number, threadId: number | undefined) => {
    console.log("createPin", chatId);
    let message: TB.Message;
    const events = await this.eventsModule.getEvents(chatId, threadId)
    let { text, buttonsRows } = await renderPin(chatId, threadId, events);
    message = await this.bot.sendMessage(chatId, text, {
      reply_markup: { inline_keyboard: buttonsRows },
      parse_mode: "HTML",
      message_thread_id: threadId
    });

    const { message_id: messageId } = message
    this.pinModule.updatePinMeta(chatId, threadId, { messageId }).catch(((e) => console.log(e)));
    await this.bot.sendMessage(
      chatId,
      `Hi there! 
I'll help you manage this groups calandar. 
To start, add your first event using the "calendar" button. 
And don't forget to pin the message with the button, so everyone can open the app.`,
      { message_thread_id: threadId }
    );
  };

  udpatePin = async (chatId: number, threadId?: number) => {
    const pinned = await this.pinModule.getPinMeta(chatId, threadId);

    if (pinned) {
      const events = await this.eventsModule.getEvents(chatId, threadId)
      const { text, buttonsRows } = await renderPin(chatId, threadId, events);

      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: pinned.messageId,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttonsRows },
      });

    }
  }

  init = () => {
    this.bot.on("group_chat_created", async (upd) => {
      try {
        await this.chatMetaModule.updateChat(upd.chat.id, upd.chat.title ?? '');
        await this.createPin(upd.chat.id, upd.message_thread_id)

      } catch (e) {
        console.error(e)
      }
    })

    this.bot.on("migrate_from_chat_id", async (upd) => {
      try {
        const fromId = upd.migrate_from_chat_id;
        const toId = upd.chat.id;

        if (fromId !== undefined) {
          console.log("migrate_from_chat_id >>>", fromId, toId)
          // yep, concurrent ops/corrections can get lost, whatever
          const session = MDBClient.startSession();
          try {
            await session.withTransaction(async () => {
              await EVENTS().updateMany({ chatId: fromId }, { $set: { chatId: toId } }, { session });
            });
          } finally {
            await session.endSession();
          }
          await this.chatMetaModule.updateChat(toId, upd.chat.title ?? "");
          await this.createPin(toId, undefined)

          console.log("migrate_from_chat_id <<<", fromId, toId)

        }
      } catch (e) {
        console.error(e);
      }
    })

    this.bot.on("new_chat_members", async (upd) => {
      try {
        console.log("new_chat_members", upd.new_chat_members);
        let botAdded = upd.new_chat_members?.find(
          (u) => u.id === 6289269904
        );
        if (botAdded) {
          await this.chatMetaModule.updateChat(upd.chat.id, upd.chat.title ?? "");
          await this.createPin(upd.chat.id, undefined)

        }

        upd.new_chat_members?.filter(u => !u.is_bot || (upd.chat.title?.endsWith("__DEV__"))).forEach(u => {
          this.userModule.updateUser(upd.chat.id, undefined, {
            id: u.id,
            name: u.first_name,
            lastname: u.last_name,
            username: u.username,
            disabled: false
          }).catch(e => console.error(e))
        })

      } catch (e) {
        console.log(e);
      }
    });

    this.bot.on("left_chat_member", async (upd) => {
      try {
        const left = upd.left_chat_member;
        if (left && (!left.is_bot || (upd.chat.title?.endsWith("__DEV__")))) {
          await this.userModule.updateUser(upd.chat.id, undefined, {
            id: left.id,
            name: left.first_name,
            lastname: left.last_name,
            username: left.username,
            disabled: true
          });
        }
      } catch (e) {
        console.log(e);
      }
    });

    this.bot.onText(/\/pin/, async (upd) => {
      try {
        await this.chatMetaModule.updateChat(upd.chat.id, upd.chat.title ?? "");
        await this.createPin(upd.chat.id, upd.message_thread_id);
      } catch (e) {
        console.log(e);
      }
    });

    this.bot.onText(/\/buymeacoffee/, async (upd) => {
      try {
        await this.bot.sendMessage(
          upd.chat.id,
          "https://bmc.link/korrrka",
          { message_thread_id: upd.message_thread_id }
        );
      } catch (e) {
        console.log(e);
      }
    });

    this.bot.on("message", async (message) => {
      try {
        if (message.from && (!message.from.is_bot || (message.chat.title?.endsWith("__DEV__")))) {
          await this.userModule.updateUser(message.chat.id, message.message_thread_id, {
            id: message.from.id,
            name: message.from.first_name,
            lastname: message.from.last_name,
            username: message.from.username,
            disabled: false
          })
        }

        if (message.entities) {
          for (let e of message.entities) {
            const user = e.user;
            if (user && (!user.is_bot || (message.chat.title?.endsWith("__DEV__")))) {
              await this.userModule.updateUser(message.chat.id, message.message_thread_id, {
                id: user.id,
                name: user.first_name,
                lastname: user.last_name,
                username: user.username,
                disabled: false
              });
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    });

    this.eventsModule.upateSubject.subscribe(async (upd) => {
      try {
        await this.udpatePin(upd.chatId, upd.threadId)
      } catch (e) {
        console.error(e)
      }
    })

    new CronJob('0 * * * *', async () => {
      console.log('cron fire')
      try {
        const now = Date.now()
        LATEST_EVENTS()
          .find({ date: { $gte: now } })
          .forEach(le => {
            console.log('udpate', JSON.stringify(le, undefined, 4))
            this.udpatePin(le.chatId, le.threadId).catch(e => {
              console.error(e)
            })
          }).catch(e => {
            console.error(e)
          })
      } catch (e) {
        console.error(e)
      }
    })

  };

}
