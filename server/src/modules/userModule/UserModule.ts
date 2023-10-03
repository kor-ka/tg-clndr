import { container, singleton } from "tsyringe";
import { User } from "../../../../src/shared/entity";
import { TelegramBot } from "../../api/tg/tg";
import { Subject } from "../../utils/subject";
import { SavedUser, USER } from "./userStore";
import * as fs from "fs";
import { appRoot } from "../..";
import * as https from "https";

@singleton()
export class UserModule {
  private db = USER();

  readonly userUpdated = new Subject<{ chatId: number, user: SavedUser }>();
  private usersCache = new Map<number, SavedUser[]>;

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

    let res = await this.db.updateOne(
      { id },
      {
        $set: {
          ...update,
        },
        $addToSet: { ...disabled ? { disabledChatIds: chatId } : {}, chatIds: chatId, threadFullIds: `${chatId}_${threadId}` },
        $pull: { ...disabled ? {} : { disabledChatIds: chatId } }
      },
      { upsert: true }
    );

    const userSaved = await this.getUser(id)

    if (userSaved) {
      this.userUpdated.next({ chatId, user: userSaved });
    }

    // TODO: better cahce update     
    await this.getUsers(chatId)

    // async photo update
    this.updateUserPhoto(chatId, id).catch(e => console.error(e));

    return res;
  };

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
    this.usersCache.set(chatId, res)
    return res
  };

  getUsersCached = async (chatId: number): Promise<SavedUser[]> => {
    let users = this.usersCache.get(chatId)
    if (!users) {
      users = await this.getUsers(chatId)
    }
    return users
  };
}
