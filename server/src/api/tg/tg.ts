import TB from "node-telegram-bot-api";
import { PinsModule } from "../../modules/pinsModule/PinsModule";
import { renderPin } from "./renderPin";
import { container, singleton } from "tsyringe";
import { ChatMetaModule } from "../../modules/chatMetaModule/ChatMetaModule";
import { EventsModule } from "../../modules/eventsModule/EventsModule";
import { UserModule } from "../../modules/userModule/UserModule";
import { EVENTS, LATEST_EVENTS, SavedEvent } from "../../modules/eventsModule/eventStore";
import { MDBClient } from "../../utils/MDB";
import { CronJob } from "cron";
import { renderEvent } from "./renderEvent";
import { getChatToken } from "../Auth";
import { __DEV__ } from "../../utils/dev";
import { StatsModule } from "../../modules/statsModule/StatsModule";
import { getKey } from "./getKey";

const renderEventMessage = async (event: SavedEvent) => {
  const text = (await renderEvent(event));

  const key = getKey(event.chatId, event.threadId);

  const buttons: TB.InlineKeyboardButton[][] = [
    [
      { text: "✅", callback_data: "atnd/yes" },
      { text: "🤔", callback_data: "atnd/maybe" },
      { text: "🙅", callback_data: "atnd/no" }
    ], [
      {
        text: "Calendar",
        url: `https://t.me/clndrrrbot/clndr?startapp=${key}&startApp=${key}`,
      },
    ]
  ];
  return [text, buttons] as const
}

const nick = "clndrrrbot"

@singleton()
export class TelegramBot {
  private pinModule = container.resolve(PinsModule);
  private chatMetaModule = container.resolve(ChatMetaModule);
  private userModule = container.resolve(UserModule)
  private eventsModule = container.resolve(EventsModule)
  private stats = container.resolve(StatsModule)

  private token = process.env.TELEGRAM_BOT_TOKEN!;
  readonly bot = new TB(this.token, {
    polling: !__DEV__,
  });

  onCommand = (command: string, callback: (msg: TB.Message, match: RegExpExecArray | null) => void) => {
    return this.bot.onText(new RegExp(`^\/(${command}|${command}@${nick})$`), (msg, match) => {
      callback(msg, match)
      if (msg.from) {
        this.stats.onMessage(msg.from.id, msg.chat.id, command).catch(e => console.error('stat: failed to track tg message:', e))
      }
    })
  }

  sendEventMessage = async (event: SavedEvent) => {
    const [text, buttons] = await renderEventMessage(event)
    const message = await this.bot.sendMessage(event.chatId, text, {
      reply_markup: { inline_keyboard: buttons },
      parse_mode: "HTML",
      message_thread_id: event.threadId
    });
    await EVENTS().updateOne({ _id: event._id }, { $addToSet: { messages: message.message_id } })
  }

  updateEventMessages = async (event: SavedEvent) => {
    const [text, buttons] = await renderEventMessage(event)
    const meessages = (await EVENTS().findOne({ _id: event._id }))?.messages || []
    await Promise.all(meessages.map(mid =>
      this.bot.editMessageText(text, {
        chat_id: event.chatId,
        message_id: mid,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
      })))
  }

  sendNotification = async (event: SavedEvent, usrtId: number) => {
    const chatMeta = await this.chatMetaModule.getChatMeta(event.chatId)
    const text = (await renderEvent(event,
      {
        renderAttendees: false,
        atChat: chatMeta ? { id: chatMeta.chatId, name: chatMeta.name } : undefined,
        renderDate: event.date - Date.now() >= 1000 * 60 * 60 * 12,
      }));
    let key = [event.chatId, event.threadId].filter(Boolean).join('_');
    const token = getChatToken(event.chatId);
    key = [key, token].filter(Boolean).join('T');

    const buttons: TB.InlineKeyboardButton[][] = [
      [
        {
          text: `${event.chatId < 0 ? (chatMeta?.name ?? '') : ''} Calendar`.trim(),
          url: `https://t.me/clndrrrbot/clndr?startapp=${key}&startApp=${key}`,
        },
      ]
    ];
    await this.bot.sendMessage(usrtId, text, {
      reply_markup: { inline_keyboard: buttons },
      parse_mode: "HTML",
      message_thread_id: event.threadId
    });
  }

  private createPin = async (chatId: number, threadId: number | undefined) => {
    console.log("createPin", chatId);
    let message: TB.Message;
    const events = await this.eventsModule.getEvents(chatId, threadId)
    let { text, buttonsRows } = await renderPin(chatId, threadId, events);
    message = await this.bot.sendMessage(chatId, text, {
      reply_markup: { inline_keyboard: buttonsRows },
      parse_mode: "HTML",
      disable_web_page_preview: true,
      message_thread_id: threadId,
      disable_notification: true
    });

    const { message_id: messageId } = message
    const prevPin = await this.pinModule.updatePinMeta(chatId, threadId, { messageId })

    if (prevPin.value) {
      this.bot.deleteMessage(chatId, prevPin.value.messageId).catch(e => console.error(e.message))
    }

    let pinned = true
    try {
      await this.bot.pinChatMessage(chatId, messageId)
    } catch (e) {
      pinned = false
    }

    await this.bot.sendMessage(
      chatId,
      `Hi there! 
I'll help you manage this chat calendar. 
To start, add your first event using the "calendar" button. 
${pinned ? '' : "And don't forget to pin the message with the button, so you can always open the app."}`.trim(),
      {
        message_thread_id: threadId,
        disable_notification: true
      }
    );
  };

  udpatePin = async (chatId: number, threadId?: number) => {
    const pinned = await this.pinModule.getPinMeta(chatId, threadId);

    if (pinned) {
      const events = await this.eventsModule.getEvents(chatId, threadId)
      const { text, buttonsRows } = await renderPin(chatId, threadId, events);
      const inlineKeyboardDescriptor = JSON.stringify(buttonsRows)

      // do not edit if nothing changed
      if ((pinned.text !== text) || (pinned.inlineKeyboardDescriptor !== inlineKeyboardDescriptor)) {
        await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: pinned.messageId,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: buttonsRows },
        })
        await this.pinModule.updatePinMeta(chatId, threadId, { text, inlineKeyboardDescriptor })
      }
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
              await LATEST_EVENTS().updateMany({ chatId: fromId }, { $set: { chatId: toId } }, { session });
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


    this.bot.on("my_chat_member", async (upd) => {
      try {
        let botAdded = upd.new_chat_member.status === 'administrator' || upd.new_chat_member.status === 'member' || upd.new_chat_member.status === 'restricted'
        if (botAdded) {
          await this.chatMetaModule.updateChat(upd.chat.id, upd.chat.title ?? "");
          if (upd.chat.type !== 'private') {
            // pivate chats are initialized with /srart
            await this.createPin(upd.chat.id, undefined);
          }
        }
      } catch (e) {
        console.error(e)
      }
    })

    this.bot.on("new_chat_members", async (upd) => {
      try {
        console.log("new_chat_members", upd.new_chat_members);
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

    this.onCommand('start', async (upd) => {
      try {
        await this.chatMetaModule.updateChat(upd.chat.id, upd.chat.title ?? "");
        if (upd.chat.type === 'private') {
          await this.bot.sendMessage(
            upd.chat.id,
            'Hey👋\nThis bot is meant to work in groups with your friends, add me to any group to start.',
            { reply_markup: { inline_keyboard: [[{ text: 'Add to group', url: "https://telegram.me/clndrrrbot?startgroup=true&admin=post_messages+pin_messages" }]] } }
          );
        } else {
          await this.createPin(upd.chat.id, upd.message_thread_id)
        }
      } catch (e) {
        console.log(e);
      }
    });

    this.onCommand('pin', async (upd) => {
      try {
        let canCreatePin = false

        if (upd.chat.type === 'private') {
          canCreatePin = true
        } else if (upd.from) {
          const member = await this.bot.getChatMember(upd.chat.id, upd.from.id)
          if (member.status === 'administrator' || member.status === 'creator') {
            canCreatePin = true
          }
        }

        if (canCreatePin) {
          await this.chatMetaModule.updateChat(upd.chat.id, upd.chat.title ?? "");
          await this.createPin(upd.chat.id, upd.message_thread_id);
        } else {
          await this.bot.sendMessage(upd.chat.id, "Only admins can create a pin message")
        }

      } catch (e) {
        console.log(e);
      }
    });

    this.onCommand('buymeacoffee', async (upd) => {
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

    this.bot.on("callback_query", async q => {
      try {
        const { data: dataString, from, message } = q;
        if (message && dataString) {
          // save user before any actions
          const from = message.from
          if (from) {
            await this.userModule.updateUser(message.chat.id, message.message_thread_id, {
              id: from.id,
              name: from.first_name,
              lastname: from.last_name,
              username: from.username,
              disabled: false
            })
          }

          let data = dataString.split("/");
          if (data[0] === 'atnd') {
            const vote = data[1] as "yes" | "maybe" | "no"
            const event = await EVENTS().findOne({ chatId: message.chat.id, threadId: message.message_thread_id, messages: message.message_id })
            if (event) {
              await this.eventsModule.updateAtendeeStatus(message.chat.id, message.message_thread_id, event._id.toHexString(), q.from.id, vote)
            }
          }
          this.stats.onCallbackQuery(q.from.id, message.chat.id, data[0] ?? '').catch(e => console.error('stat: failed to track tg callback query:', e))
        }
        await this.bot.answerCallbackQuery(q.id);
      } catch (e) {
        console.error(e)
      }
    })

    this.eventsModule.upateSubject.subscribe(async (upd) => {
      try {
        await this.udpatePin(upd.chatId, upd.threadId)
        if (upd.type === 'create') {
          if ((await this.chatMetaModule.getChatMeta(upd.chatId))?.settings.enableEventMessages) {
            await this.sendEventMessage(upd.event)
          }
        } else {
          await this.updateEventMessages(upd.event)
        }
      } catch (e) {
        console.error(e)
      }
    })

    // clean up older events from pin as time goes
    // run every minute
    new CronJob('* * * * *', async () => {
      console.log('tg cron fire')
      try {
        // trigger render for older events to clean up pin in case of no events
        const freshEnough = Date.now() - 1000 * 60 * 60 * 5;

        let i = 0;
        await LATEST_EVENTS()
          .find({
            date: { $gte: freshEnough },
            // udpate window: 10m
            updated: { $not: { $gt: Date.now() - 1000 * 60 * 10 } }
          })
          // TODO: not all chats with future events should be updated tho - only ones with outdated events in pin
          // ~30 messages/sec each minute -> given 10m window problems after 18000 active chats
          .limit(29 * 60)
          .forEach((le) => {
            setTimeout(() => {
              this.udpatePin(le.chatId, le.threadId)
                .then(() => LATEST_EVENTS().updateOne({ _id: le._id }, { $set: { updated: Date.now() } }))
                .catch(e => {
                  console.error(e?.message)
                })
              // ~30 m/s
            }, i++ * 33)
          })

        console.log("pin updates scheduled: " + i)
      } catch (e: any) {
        console.error(e?.message)
      }
    }, null, !__DEV__);

  };

}
