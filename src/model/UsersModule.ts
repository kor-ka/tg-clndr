import { User } from "../shared/entity";
import { VM } from "../utils/vm/VM";

export type UserClient = Partial<User> & Pick<User, 'id'> & { fullName: string, name: string }
export class UsersModule {

    constructor(private userId?: number) {

    }

    readonly users = new Map<number, VM<UserClient>>;

    readonly getUser = (id: number) => {
        let vm = this.users.get(id)
        if (!vm) {
            vm = new VM({ id, fullName: "Loading user...", name: "Loading user..." })
            if (!Number.isNaN(id)) {
                this.users.set(id, vm)
            }
        }
        return vm
    }

    readonly updateUser = (user: User) => {
        user.name = user.id === this.userId ? "You" : user.name.replaceAll(" ", " ")
        user.lastname = user.lastname?.replaceAll(" ", " ")
        const fullName = user.id === this.userId ? "You" : [user.name, user.lastname].filter(Boolean).join(' ')
        this.getUser(user.id).next({ ...user, fullName })
    }
}
