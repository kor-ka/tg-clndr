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

        // Check if this calendar date falls within the event's date range (multi-day support)
        const calendarDay = new Date(this.date.getFullYear(), this.date.getMonth(), this.date.getDate()).getTime()

        const eventStartDate = new Date(vm.val.date)
        const eventStartDay = new Date(eventStartDate.getFullYear(), eventStartDate.getMonth(), eventStartDate.getDate()).getTime()

        const eventEndDate = new Date(vm.val.endDate)
        const eventEndDay = new Date(eventEndDate.getFullYear(), eventEndDate.getMonth(), eventEndDate.getDate()).getTime()

        // Event should appear on this calendar date if the date is within the event's span
        if (calendarDay < eventStartDay || calendarDay > eventEndDay) {
            nextMap.delete(vm.val.id)
            console.log('date model delete', this.date, vm)
        }

        this.events.next(nextMap)
    }
}
export class EventsModule {
    constructor(private model: SessionModel) { }

    private allEvents = new Map<string, VM<Event>>()
    readonly futureEvents: EventsVM = new VM(new Map<string, VM<Event>>())

    private datesModels = new Map<number, DateModel>();

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
        const prevEndDate = vm.val.endDate
        // merge light and full version
        vm.next({ ...vm.val, ...event });

        const nextFutureMapEntries = [...this.futureEvents.val.entries(), [event.id, vm] as const].sort((a, b) => a[1].val.date - b[1].val.date)
        const nextFutureMap = new Map(nextFutureMapEntries)
        // Only show events that haven't ended yet (ongoing or future events)
        if (vm.val.endDate < Date.now()) {
            nextFutureMap.delete(vm.val.id)
        }
        this.futureEvents.next(nextFutureMap)

        // Update all date models affected by the event (all days in old or new date range)
        const minDate = Math.min(prevDate, vm.val.date)
        const maxDate = Math.max(prevEndDate, vm.val.endDate)

        const minDay = new Date(new Date(minDate).setHours(0, 0, 0, 0)).getTime()
        const maxDay = new Date(new Date(maxDate).setHours(0, 0, 0, 0)).getTime()

        for (let day = minDay; day <= maxDay; day += 24 * 60 * 60 * 1000) {
            this.getDateModel(day).onUpdated(vm)
        }


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
    private pendinEvents = new Map<string, Deffered<Event>>();
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