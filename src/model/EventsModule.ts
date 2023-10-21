import { Event, User } from "../shared/entity";
import { VM } from "../utils/vm/VM";
import { SessionModel } from "./SessionModel";

export type EventsVM = VM<Map<string, VM<Event>>>

class DateModel {
    readonly events: EventsVM = new VM(new Map<string, VM<Event>>())

    date: Date
    constructor(time: number) {
        this.date = new Date(time)
    }

    onUpdated = (vm: VM<Event>) => {
        const nextMapEntries = [...this.events.val.entries(), [vm.val.id, vm] as const].sort((a, b) => a[1].val.date - b[1].val.date)
        const nextMap = new Map(nextMapEntries)
        // TODO: check span
        const eventDate = new Date(vm.val.date)
        if ((this.date.getFullYear() !== eventDate.getFullYear()) ||
            (this.date.getMonth() !== eventDate.getMonth()) ||
            (this.date.getDate() !== eventDate.getDate())) {
            nextMap.delete(vm.val.id)
            console.log('remove event', this.date, vm.val)

        } else {
            console.log('add event', this.date, vm.val)
        }

        this.events.next(nextMap)
    }
}
export class EventsModule {
    constructor(private model: SessionModel) { }

    private frehsEnough = Date.now() - 1000 * 60 * 60 * 4;
    readonly futureEvents: EventsVM = new VM(new Map<string, VM<Event>>())

    private datesModels = new Map<number, DateModel>

    private monthActivations = new Map<number, Promise<Event[]>>()

    readonly updateEventVM = (event: Event) => {
        let vm = this.futureEvents.val.get(event.id)
        if (!vm) {
            vm = new VM(event)
            this.futureEvents.val.set(event.id, vm)
        } else if (vm.val.seq > event.seq) {
            // skip outdated seq update
            return vm
        }
        const prevDate = vm.val.date
        // merge light and full version
        vm.next({ ...vm.val, ...event });

        const nextMapEntries = [...this.futureEvents.val.entries(), [event.id, vm] as const].sort((a, b) => a[1].val.date - b[1].val.date)
        const nextMap = new Map(nextMapEntries)
        if (vm.val.date <= this.frehsEnough) {
            nextMap.delete(vm.val.id)
        }

        this.futureEvents.next(nextMap)

        if (prevDate !== vm.val.date) {
            this.getDateModel(prevDate).onUpdated(vm)
        }
        this.getDateModel(vm.val.date).onUpdated(vm)


        return vm
    }

    acivateMonthOnce = (monthStart: number) => {
        let activation = this.monthActivations.get(monthStart)

        if (!activation) {
            console.log('acivateMonthOnce', new Date(monthStart).toLocaleDateString('en', { year: '2-digit', month: 'long' }))
            const date = new Date(monthStart)
            const nextMonthStart = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime()
            activation = this.model.getEventsRange(monthStart, nextMonthStart)
            this.monthActivations.set(monthStart, activation)
            activation.catch(e => {
                console.error(e)
                this.monthActivations.delete(monthStart)
            })
        }
    }

    // 
    //  Getters
    // 

    readonly getOperationOpt = <T = Event>(id: string): T | undefined => {
        return this.futureEvents.val.get(id)?.val as T
    }

    getEventVM = (id: string) => {
        return this.futureEvents.val.get(id)
    }

    getDateModel = (rawdate: number) => {
        const date = new Date(rawdate)
        const time = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
        let dateModel = this.datesModels.get(time)
        if (!dateModel) {
            dateModel = new DateModel(time)
            this.datesModels.set(time, dateModel)
        }
        return dateModel
    }

}