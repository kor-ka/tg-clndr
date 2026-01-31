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

// Recurrence patterns using RRule format
export const RecurrenceOptions = {
  none: '',
  daily: 'FREQ=DAILY',
  weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  weekends: 'FREQ=WEEKLY;BYDAY=SA,SU',
  weekly: 'FREQ=WEEKLY',
  biweekly: 'FREQ=WEEKLY;INTERVAL=2',
  monthly: 'FREQ=MONTHLY',
  yearly: 'FREQ=YEARLY',
} as const;

export type RecurrenceType = keyof typeof RecurrenceOptions;

export const recurrenceToLabel = (recurrence: string | undefined): string => {
  if (!recurrence) return 'Never';
  if (recurrence.includes('FREQ=DAILY')) return 'Daily';
  if (recurrence.includes('BYDAY=MO,TU,WE,TH,FR')) return 'Weekdays';
  if (recurrence.includes('BYDAY=SA,SU')) return 'Weekends';
  if (recurrence.includes('INTERVAL=2') && recurrence.includes('FREQ=WEEKLY')) return 'Every 2 weeks';
  if (recurrence.includes('FREQ=WEEKLY')) return 'Weekly';
  if (recurrence.includes('FREQ=MONTHLY')) return 'Monthly';
  if (recurrence.includes('FREQ=YEARLY')) return 'Yearly';
  return 'Custom';
};

export type UserSettings = {
  enableNotifications?: boolean;
  notifyBefore: null | DurationDscrpitor;
  timeZone?: string;
  experimentalFeatures?: boolean;
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
  recurrent?: string
};

type ClientApiEvent = Omit<
  Event,
  "uid" | "deleted" | "seq" | "attendees" | "geo" | "notification"
>;
export type ClientApiEventCreateCommand = {
  type: "create";
  event: ClientApiEvent;
};

export type ClientApiEventUpdateCommand = {
  type: "update";
  event: ClientApiEvent & { udpateFutureRecurringEvents?: boolean };
};

export type ClientApiEventDeleteCommand = {
  type: "delete";
  id: string;
  deleteFutureRecurringEvents?: boolean
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
