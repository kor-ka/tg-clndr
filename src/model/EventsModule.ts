import { Event, User } from "../shared/entity";
import { VM } from "../utils/vm/VM";

export class EventsModule {
    readonly events = new VM(new Map<string, VM<Event>>())

    readonly updateEventVM = (event: Event) => {
        let vm = this.events.val.get(event.id)
        if (!vm) {
            vm = new VM(event)
            this.events.val.set(event.id, vm)
        } else if (vm.val.seq > event.seq) {
            // skip outdated seq update
            return vm
        }
        // merge light and full version
        vm.next({ ...vm.val, ...event });
        const nextMapEntries = [...this.events.val.entries(), [event.id, vm] as const].sort((a, b) => a[1].val.date - b[1].val.date)
        this.events.next(new Map(nextMapEntries))
        return vm
    }

    readonly getOperationOpt = <T = Event>(id: string): T | undefined => {
        return this.events.val.get(id)?.val as T
    }

    getEventVM = (id: string) => {
        return this.events.val.get(id)
    }

}