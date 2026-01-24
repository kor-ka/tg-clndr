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
  // Recurring event fields
  rrule?: string; // RRule string (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR")
  recurringGroupId?: string; // Shared ID for all instances of a recurring event
  recurringEventId?: string; // Reference to the original template event
  excludedFromGroup?: boolean; // True if this instance was excluded from recurring series
};

type ClientApiEvent = Omit<
  Event,
  "uid" | "deleted" | "seq" | "attendees" | "geo" | "notification" | "recurringGroupId" | "recurringEventId" | "excludedFromGroup"
>;
export type ClientApiEventCreateCommand = {
  type: "create";
  event: ClientApiEvent;
};

export type ClientApiEventUpdateCommand = {
  type: "update";
  event: ClientApiEvent;
  recurringMode?: "single" | "thisAndFuture"; // How to handle recurring event updates
};

export type ClientApiEventDeleteCommand = {
  type: "delete";
  id: string;
  recurringMode?: "single" | "thisAndFuture"; // How to handle recurring event deletion
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
