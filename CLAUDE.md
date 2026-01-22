# TG Calendar (tg-clndr) - Codebase Documentation

A Telegram Mini App for managing shared calendars in chats with seamless integration to calendar apps on Android and iOS.

## Quick Reference

| Aspect | Details |
|--------|---------|
| Type | Full-stack Telegram Mini App |
| Frontend | React 18 + TypeScript |
| Backend | Express + Node.js + Socket.io |
| Database | MongoDB |
| Deployment | Heroku |
| Entry Points | Client: `src/index.tsx`, Server: `server/src/index.tsx` |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Telegram Mini App                           │
├─────────────────────────────────────────────────────────────────┤
│  Client (React)              │  Server (Express/Node.js)        │
│  ├── SessionModel (state)    │  ├── ClientAPI (WebSocket)       │
│  ├── EventsModule            │  ├── EventsModule                │
│  ├── UsersModule             │  ├── UserModule                  │
│  └── View Components         │  ├── NotificationsModule         │
│                              │  └── TelegramBot                 │
├─────────────────────────────────────────────────────────────────┤
│                     MongoDB Database                            │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
tg-clndr/
├── src/                          # Client-side React application
│   ├── model/                    # Client state management
│   │   ├── SessionModel.ts       # Main state container, socket management
│   │   ├── EventsModule.ts       # Event data management
│   │   └── UsersModule.ts        # User data management
│   ├── view/                     # UI components
│   │   ├── App.tsx               # Root component with routing
│   │   ├── MainScreen.tsx        # Calendar view (month/upcoming)
│   │   ├── EventScreen.tsx       # Event creation/editing
│   │   ├── settigns/             # Settings screens
│   │   ├── monthcal/             # Month calendar components
│   │   ├── uikit/                # UI components & Telegram integration
│   │   │   ├── kit.tsx           # Base UI components
│   │   │   └── tg/               # Telegram WebApp controllers
│   │   └── utils/                # Navigation, webapp helpers
│   ├── shared/                   # Shared types (client & server)
│   │   └── entity.ts             # Core data types
│   ├── utils/                    # Client utilities
│   │   ├── vm/VM.ts              # Value Model (reactive container)
│   │   └── deffered.ts           # Promise utility
│   └── index.tsx                 # Client entry point
├── server/                       # Backend application
│   └── src/
│       ├── index.tsx             # Server entry, Express setup, SSR
│       ├── api/
│       │   ├── ClientAPI.ts      # WebSocket API handler
│       │   ├── socket.ts         # Socket.io initialization
│       │   ├── Auth.ts           # Chat token authentication
│       │   └── tg/               # Telegram Bot integration
│       │       ├── tg.ts         # Bot implementation
│       │       ├── getTgAuth.ts  # Auth validation
│       │       ├── renderEvent.ts# Event message formatting
│       │       └── renderPin.ts  # Pin message formatting
│       ├── modules/              # Business logic
│       │   ├── eventsModule/     # Event CRUD
│       │   ├── userModule/       # User management
│       │   ├── notificationsModule/ # Notifications
│       │   ├── chatMetaModule/   # Chat configuration
│       │   ├── pinsModule/       # Pinned events
│       │   ├── icsModule/        # ICS calendar export
│       │   └── geoModule/        # Location/timezone
│       └── utils/
│           ├── MDB.ts            # MongoDB connection
│           └── subject.ts        # Event emitter
├── public/                       # Static assets
├── package.json                  # Client dependencies
├── server/package.json           # Server dependencies
└── example.env                   # Environment template
```

## Core Data Entities

### Event (`src/shared/entity.ts`)
```typescript
{
  id: string;
  uid: number;                    // Creator user ID
  date: number;                   // Timestamp
  tz: string;                     // Timezone
  title: string;
  description: string;
  seq: number;                    // Version number
  attendees: {
    yes: number[];                // User IDs
    no: number[];
    maybe: number[];
  };
  geo: { address: string; location: [lat, lng] } | null;
  imageURL?: string;
  notification?: { notifyBefore: DurationDescriptor } | null;
}
```

### User
```typescript
{
  id: number;                     // Telegram user ID
  name: string;
  lastname?: string;
  username?: string;
  imageUrl?: string;
  disabled: boolean;
  settings: {
    enableNotifications: boolean;
    notifyBefore: DurationDescriptor | null;
    timeZone: string;
  };
}
```

## Key Patterns

### State Management (VM - Value Model)
Custom reactive container in `src/utils/vm/VM.ts`:
```typescript
const vm = new VM<string>("initial");
vm.subscribe((value) => console.log(value));
vm.next("new value");  // Emits to subscribers
```
Used throughout the client for reactive state.

### WebSocket Communication
Client (`SessionModel.ts`) ↔ Server (`ClientAPI.ts`):
- **Client emits**: `command`, `status`, `update_*`
- **Server emits**: `update`, `state`, `user`, `settings`

### Dependency Injection (Server)
Uses TSyringe:
```typescript
@singleton()
export class EventsModule { ... }

const module = container.resolve(EventsModule);
```

## Main Flows

### 1. Initialization
```
Telegram opens /tg/ → Server SSR renders page
→ Client hydrates, creates SessionModel
→ Socket.io connects with initData
→ Server validates auth, sends state
→ Client renders calendar
```

### 2. Event Creation
```
User fills EventScreen form → commitCommand()
→ Socket emits "command" → Server EventsModule processes
→ MongoDB transaction → Server broadcasts "update"
→ All clients update → Telegram Bot notifies chat
```

### 3. Attendance Response
```
User clicks yes/no/maybe → updateStatus()
→ Server updates attendees → Broadcasts update
→ Notifications adjusted → UI updates
```

## API Routes

| Route | Purpose |
|-------|---------|
| `/tg/` | Main app (SSR) |
| `/ics/:key/cal.ics` | Calendar export |
| `/tgFile/:id` | File uploads |
| `/api/v1/assistant/*` | Assistant API |

## Environment Variables

```bash
MONGODB_URI=<MongoDB connection string>
TELEGRAM_BOT_TOKEN=<Bot token>
ACCESS_TOKEN_SECRET=<HMAC secret>
GEO_KEY=<Geolocation API key>
ASSISTANT_TOKEN=<Assistant API token>
```

## Development Commands

```bash
# Start React dev server (Terminal 1)
yarn start

# Build and start Node server (Terminal 2)
yarn buildServer && yarn startServer

# Full production build
yarn build

# Server only
yarn startServer
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/model/SessionModel.ts` | Main client state, socket management |
| `src/model/EventsModule.ts` | Client-side event handling |
| `src/shared/entity.ts` | Shared TypeScript types |
| `src/view/App.tsx` | React routing setup |
| `src/view/MainScreen.tsx` | Calendar views |
| `src/view/EventScreen.tsx` | Event editor |
| `server/src/index.tsx` | Server entry, Express config |
| `server/src/api/ClientAPI.ts` | WebSocket API |
| `server/src/api/tg/tg.ts` | Telegram Bot |
| `server/src/modules/eventsModule/` | Event business logic |
| `server/src/utils/MDB.ts` | MongoDB setup |

## MongoDB Collections & Indices

| Collection | Index | Type |
|------------|-------|------|
| `events` | `{chatId, threadId, idempotencyKey}` | Unique |
| `users` | `{id}` | Unique |
| `chat_meta` | `{chatId}` | Unique |
| `notifications` | `{userId, eventId}` | Unique |
| `latest_events` | `{chatId, threadId}` | Unique |

## Telegram Integration

- **WebApp API**: Native Mini App integration via `window.Telegram.WebApp`
- **Bot API**: Event notifications, chat messages via `node-telegram-bot-api`
- **Auth**: `initData` validation using Telegram's HMAC signature

## Important Notes

1. **Real-time sync**: All changes broadcast to connected clients via Socket.io
2. **SSR**: Initial page load is server-rendered for performance
3. **Notifications**: Cron job runs every minute to check pending notifications
4. **ICS Export**: Calendar subscriptions auto-update on schedule
5. **Error tracking**: Sentry integration for both client and server
