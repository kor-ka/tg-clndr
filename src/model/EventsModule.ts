import { Event, User } from "../shared/entity";
import { Deffered } from "../utils/deffered";
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
            console.log('date model delete', this.date, vm)
        }

        this.events.next(nextMap)
    }
}
export class EventsModule {
    constructor(private model: SessionModel) { }

    private frehsEnough = Date.now() - 1000 * 60 * 60 * 4;
    private allEvents = new Map<string, VM<Event>>()
    readonly futureEvents: EventsVM = new VM(new Map<string, VM<Event>>())

    private datesModels = new Map<number, DateModel>

    private monthActivations = new Map<number, Promise<Event[]>>()

    readonly updateEventVM = (event: Event) => {
        let vm = this.allEvents.get(event.id)
        if (!vm) {
            vm = new VM(event);
            this.allEvents.set(event.id, vm);
        } else if (vm.val.seq > event.seq) {
            // skip outdated seq update
            return vm
        }
        const prevDate = vm.val.date
        // merge light and full version
        vm.next({ ...vm.val, ...event });

        const nextFutureMapEntries = [...this.futureEvents.val.entries(), [event.id, vm] as const].sort((a, b) => a[1].val.date - b[1].val.date)
        const nextFutureMap = new Map(nextFutureMapEntries)
        if (vm.val.date <= this.frehsEnough) {
            nextFutureMap.delete(vm.val.id)
        }
        this.futureEvents.next(nextFutureMap)

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

    readonly getEventOpt = <T = Event>(id: string): T | undefined => {
        return this.allEvents.get(id)?.val as T
    }

    // TODO: extract generic data hook
    private pendinEvents = new Map<string, Deffered<Event>>
    readonly useEvent = (id: string) => {
        const event = this.getEventOpt(id);
        if (!event) {
            let pendinEvent = this.pendinEvents.get(id);
            if (!pendinEvent) {
                pendinEvent = new Deffered();
                this.model.getEvent(id)
                    .then(pendinEvent.resolve)
                    .catch(pendinEvent.reject);
                this.pendinEvents.set(id, pendinEvent)
            }

            if (pendinEvent.result) {
                if (pendinEvent.result.error) {
                    throw pendinEvent.result.error
                } else {
                    return pendinEvent.result.val
                }
            } else {
                throw pendinEvent.promise
            }
        } else {
            return event
        }
    }

    getEventVM = (id: string) => {
        return this.allEvents.get(id)
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