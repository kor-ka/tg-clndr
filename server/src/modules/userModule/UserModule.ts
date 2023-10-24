import { container, singleton } from "tsyringe";
import { User, UserSettings } from "../../../../src/shared/entity";
import { TelegramBot } from "../../api/tg/tg";
import { Subject } from "../../utils/subject";
import { SavedUser, ServerUserSettings, USER } from "./userStore";
import * as fs from "fs";
import { appRoot } from "../..";
import * as https from "https";
import { beforeToMs, NotificationsModule } from "../notificationsModule/NotificationsModule";
import { MDBClient } from "../../utils/MDB";

@singleton()
export class UserModule {
  private db = USER();

  // constructor() {
  //   (async () => {
  //     await this.db.updateMany({}, { $unset: { 'settings.notifyBeforeMs': "" } })
  //     console.log('migrated')
  //   })()
  // }


  readonly userUpdated = new Subject<{ chatId: number, user: SavedUser }>();
  private chatUsersCache = new Map<number, Map<number, SavedUser>>;

  updateUser = async (
    chatId: number,
    threadId: number | undefined,
    user: User
  ) => {
    const { id, disabled, ...updateFields } = user
    let update = Object.entries(updateFields).reduce((update, [key, value]) => {
      update[key] = value;
      return update;
    }, {} as any);

    await this.db.updateOne(
      { id },
      {
        $set: {
          ...update,
        },
        $addToSet: { ...disabled ? { disabledChatIds: chatId } : {}, chatIds: chatId, threadFullIds: `${chatId}_${threadId}` },
        $pull: { ...disabled ? {} : { disabledChatIds: chatId } },
        $setOnInsert: {
          "settings.notifyBefore": null,
        }
      },
      { upsert: true }
    );

    const userSaved = await this.getUser(id)
    if (!userSaved) {
      throw new Error(`updateUser: user not found ${user.id}`)
    }

    this.userUpdated.next({ chatId, user: userSaved });

    this.udpateChatUserCache(userSaved)

    // async photo update
    this.updateUserPhoto(chatId, id).catch(e => console.error(e));

    return userSaved;
  };

  updateUserSettings = async (userId: number, settings: Partial<UserSettings>) => {
    await this.db.updateOne({ id: userId }, {
      $set: {
        ...settings.notifyBefore !== undefined ? { 'settings.notifyBefore': settings.notifyBefore } : {},
        ...settings.enableNotifications !== undefined ? { 'settings.enableNotifications': settings.enableNotifications } : {}
      }
    })

    const user = await this.db.findOne({ id: userId })
    if (!user) {
      throw new Error(`updateUserSettings: user not found ${userId}`)
    }
    return user
  }

  updateUserPhoto = async (
    chatId: number,
    userId: number) => {
    const bot = container.resolve(TelegramBot).bot;
    const photoFileId = (await bot.getUserProfilePhotos(userId)).photos[0]?.[0]?.file_id;
    if (photoFileId) {
      await this.db.updateOne(
        { id: userId },
        {
          $set: {
            imageUrl: `https://tg-clndr-4023e1d4419a.herokuapp.com/tgFile/${photoFileId}`
          }
        },
        { upsert: true }
      );
      const user = await this.getUser(userId);
      if (user) {
        this.userUpdated.next({ chatId, user });
      }
    }
  }

  private fileDlQ = new Map<string, Promise<string>>()
  dlFile = async (fileId: string) => {
    let promise = this.fileDlQ.get(fileId)
    if (!promise) {
      const bot = container.resolve(TelegramBot);

      const path = `${appRoot}/tgFile/${fileId}`;
      const dir = `${appRoot}/tgFile`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }

      promise = bot.bot.getFileLink(fileId).then(link => {
        const file = fs.createWriteStream(path);

        return new Promise<string>((resolve, reject) => {
          https.get(link, function (response) {
            response.on("error", reject);
            response.pipe(file);
            file.on("finish", () => {
              file.close();
              console.log(`${path} Download Completed`);
              resolve(path);
            });
          });
        });
      })




      this.fileDlQ.set(fileId, promise)
      promise.then(() => this.fileDlQ.delete(fileId))
    }
    return promise
  }

  getFile = async (fileId: string) => {
    const path = `${appRoot}/tgFile/${fileId}`;
    const filePath = await new Promise<string | undefined>((resolve) => {
      fs.access(path, (e) => {
        if (e) {
          console.error(e)
          resolve(undefined);
        } else {
          resolve(path);
        }
      });
    });
    if (filePath) {
      return filePath
    } else {
      return this.dlFile(fileId);
    }
  }

  getUser = async (uid: number): Promise<SavedUser | null> => {
    return this.db.findOne({ id: uid })
  };

  getUsers = async (chatId: number): Promise<SavedUser[]> => {
    const res = (await this.db.find({ chatIds: chatId }).toArray())
    res.forEach(this.udpateChatUserCache)
    return res
  };

  udpateChatUserCache = (user: SavedUser) => {
    if (user.chatIds) {
      for (let chatId of user.chatIds ?? []) {
        let cache = this.chatUsersCache.get(chatId)
        if (!cache) {
          cache = new Map()
          this.chatUsersCache.set(chatId, cache)
        }
        cache.set(user.id, user)
      }
    }
  }

  getUsersCached = async (chatId: number): Promise<{ users: SavedUser[], usersPromise: Promise<SavedUser[]> }> => {
    let users = [...this.chatUsersCache.get(chatId)?.values() ?? []]
    const usersPromise = this.getUsers(chatId).catch(e => {
      console.error(e)
      return []
    })
    if (!users) {
      users = await usersPromise
    }
    return { users, usersPromise }
  };
}
