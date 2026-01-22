export type User = {
  id: number;
  name: string;
  lastname?: string;
  username?: string;
  imageUrl?: string;
  disabled: boolean;
};

export const Duraion = {
  m: 1000 * 60,
  h: 1000 * 60 * 60,
  d: 1000 * 60 * 60 * 24,
  w: 1000 * 60 * 60 * 24 * 7,
};

export type DurationDscrpitor = `${number}${keyof typeof Duraion}`;

export const NotifyBeforeOptions: DurationDscrpitor[] = [
  "1m",
  "5m",
  "10m",
  "15m",
  "30m",
  "1h",
  "2h",
  "1d",
  "2d",
  "1w",
];

export type UserSettings = {
  enableNotifications?: boolean;
  notifyBefore: null | DurationDscrpitor;
  timeZone?: string;
};

export type Notification = {
  notifyBefore: DurationDscrpitor | null;
};

export type ChatSettings = {
  allowPublicEdit: boolean;
  enableEventMessages: boolean;
};

export type ChatContext = {
  isAdmin: boolean;
  isPrivate: boolean;
};

export type Event = {
  id: string;
  uid: number;
  date: number;
  endDate: number;
  tz: string;
  title: string;
  description: string;
  deleted?: boolean;
  seq: number;
  attendees: { yes: number[]; no: number[]; maybe: number[] };
  geo: {
    address: string;
    location: readonly [number, number];
  } | null;
  imageURL?: string;
  notification?: Notification | null;
};

type ClientApiEvent = Omit<
  Event,
  "uid" | "deleted" | "seq" | "attendees" | "geo" | "notification" | "endDate"
>;
export type ClientApiEventCreateCommand = {
  type: "create";
  event: ClientApiEvent;
};

export type ClientApiEventUpdateCommand = {
  type: "update";
  event: ClientApiEvent;
};

export type ClientApiEventDeleteCommand = {
  type: "delete";
  id: string;
};

export type ClientApiEventUpsertCommand =
  | ClientApiEventCreateCommand
  | ClientApiEventUpdateCommand;
export type ClientApiEventCommand =
  | ClientApiEventUpsertCommand
  | ClientApiEventDeleteCommand;

export type EventUpdate = {
  event: Event;
  type: "create" | "update" | "delete";
};
