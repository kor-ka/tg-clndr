export type User = {
    id: number;
    name: string;
    lastname?: string;
    username?: string;
    imageUrl?: string;
    disabled: boolean;
}

export const Duraion = {
    m: 1000 * 60,
    h: 1000 * 60 * 60,
    d: 1000 * 60 * 60 * 24,
    w: 1000 * 60 * 60 * 24 * 7
}

export type BeforePreset = `${number}${keyof typeof Duraion}`

export type UserSettings = {
    notifyBefore?: null | BeforePreset;
}

export type Notification = {
    notifyBefore: BeforePreset | null;
}

export type ChatSettings = {
    allowPublicEdit: boolean;
    enableEventMessages: boolean;
}

export type ChatContext = {
    isAdmin: boolean;
}

export type Event = {
    id: string;
    uid: number;
    date: number;
    tz: string;
    title: string;
    description: string;
    deleted?: boolean;
    seq: number;
    attendees: { yes: number[], no: number[], maybe: number[] }
    geo?: {
        address: string
        location: readonly [number, number]
    }
    notification?: Notification
}


type ClientApiEvent = Omit<Event, 'uid' | 'deleted' | 'seq' | 'attendees' | 'notification'>
export type ClientApiEventCreateCommand = {
    type: 'create';
    event: ClientApiEvent;
}

export type ClientApiEventUpdateCommand = {
    type: 'update';
    event: ClientApiEvent;
}

export type ClientApiEventDeleteCommand = {
    type: 'delete';
    id: string;
}

export type ClientApiEventUpsertCommand = ClientApiEventCreateCommand | ClientApiEventUpdateCommand;
export type ClientApiEventCommand = ClientApiEventUpsertCommand | ClientApiEventDeleteCommand;

export type EventUpdate = { event: Event, type: 'create' | 'update' | 'delete' }
