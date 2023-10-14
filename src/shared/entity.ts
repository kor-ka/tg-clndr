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
    notifyBefore: null | BeforePreset;
}

export type Notification = {
    beforePreset: BeforePreset | null;
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
}


type ClientCommandEvent = Omit<Event, 'uid' | 'deleted' | 'seq' | 'attendees'>
export type ClientApiCreateEventCommand = {
    type: 'create';
    event: ClientCommandEvent;
}

export type ClientApiUpdateEventCommand = {
    type: 'update';
    event: ClientCommandEvent;
}

export type ClientApiDeleteEventCommand = {
    type: 'delete';
    id: string;
}

export type ClientApiUpsertCommand = ClientApiCreateEventCommand | ClientApiUpdateEventCommand;
export type ClientApiCommand = ClientApiUpsertCommand | ClientApiDeleteEventCommand;

export type EventUpdate = { event: Event, type: 'create' | 'update' | 'delete' }
