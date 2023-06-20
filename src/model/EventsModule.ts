import { Event, User } from "../shared/entity";
import { VM } from "../utils/vm/VM";

export class EventsModule {
    readonly events = new VM(new Map<string, VM<Event>>())

    readonly updateEventVM = (operation: Event) => {
        let vm = this.events.val.get(operation.id)
        if (!vm) {
            vm = new VM(operation)
            this.events.val.set(operation.id, vm)
        }
        vm.next(operation);
        const nextMapEntries = [...this.events.val.entries(), [operation.id, vm] as const].sort((a, b) => a[1].val.date - b[1].val.date)
        this.events.next(new Map(nextMapEntries))
        return vm
    }

    readonly getOperationOpt = <T = Event>(id: string): T | undefined => {
        return this.events.val.get(id)?.val as T
    }

}