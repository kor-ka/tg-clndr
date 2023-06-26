// 
// Abstract 
// 
export type User = {
    id: number;
    name: string;
    lastname?: string;
    username?: string;
    imageUrl?: string;
    disabled: boolean;
}

export type Event = {
    id: string;
    uid: number;
    date: number;
    tz: string;
    title: string;
    description: string;
    deleted?: boolean;
    seq: number
}


type ClientCommandEvent = Omit<Event, 'uid' | 'deleted' | 'seq'>
export type ClientApiCreateEventCommand = {
    type: 'create';
    event: ClientCommandEvent
}

export type ClientApiUpdateEventCommand = {
    type: 'update';
    event: ClientCommandEvent
}

export type ClientApiDeleteEventCommand = {
    type: 'delete';
    id: string
}

export type ClientApiUpsertCommand = ClientApiCreateEventCommand | ClientApiUpdateEventCommand;
export type ClientApiCommand = ClientApiUpsertCommand | ClientApiDeleteEventCommand;

export type EventUpdate = { event: Event, type: 'create' | 'update' | 'delete' }
