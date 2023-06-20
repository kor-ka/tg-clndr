import { singleton } from "tsyringe";
import { User } from "../../../../src/shared/entity";
import { Subject } from "../../utils/subject";
import { SavedUser, USER } from "./userStore";

@singleton()
export class UserModule {
  private db = USER();

  readonly userUpdated = new Subject<{ chatId: number, user: User }>();
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
        $addToSet: { ...disabled ? { disabledChatIds: chatId } : {}, chatIds: chatId, threadIds: threadId },
        $pull: { ...disabled ? {} : { disabledChatIds: chatId } }
      },
      { upsert: true }
    );

    this.userUpdated.next({ chatId, user });

    // TODO: better cahce update     
    await this.getUsers(chatId)

    return res;
  };


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
