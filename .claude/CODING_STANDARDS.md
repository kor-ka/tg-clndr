# Coding Standards & Conventions

This document describes the actual coding patterns, styles, and conventions used in the TG-CLNDR codebase.

## TypeScript Configuration

### Compiler Settings
- **Target**: ES6
- **Strict Mode**: Enabled (strict: true)
- **Module System**: ESNext with Node resolution
- **JSX**: react-jsx (new JSX transform)
- **Source Maps**: Enabled with inline sources for Sentry
- **Source Root**: "/" (strips build path for better Sentry grouping)
- **Force Consistent Casing**: Enabled
- **No Fallthrough Cases**: Enabled

### Type Safety Practices
```typescript
// ✅ Use strict typing for function parameters and returns
updateAtendeeStatus = async (
  chatId: number,
  threadId: number | undefined,
  eventId: string,
  uid: number,
  status: 'yes' | 'no' | 'maybe'
) => { ... }

// ✅ Define explicit union types for limited options
type AttendanceStatus = 'yes' | 'no' | 'maybe';

// ✅ Use type guards with undefined/null checks
const threadId = chat_descriptor?.split('_').map(Number) ?? []

// ✅ Prefer interfaces for object shapes in shared/entity.ts
export interface Event {
  id: string;
  title: string;
  description: string;
  date: number;
  tz: string;
  attendees: Attendees;
  notification?: Notification;
}
```

## Naming Conventions

### Files & Directories
- **React Components**: PascalCase with `.tsx` extension
  - `EventScreen.tsx`, `MainScreen.tsx`, `SessionModel.ts`
- **Utilities**: camelCase with `.ts` extension
  - `renderEvent.ts`, `useGoHome.ts`, `metaParser.ts`
- **Directories**: camelCase
  - `eventsModule/`, `notificationsModule/`, `monthcal/`
  - **Note**: One typo exists: `/settigns/` should be `/settings/` (preserved for compatibility)

### Variables & Functions
- **Variables**: camelCase
  - `chatId`, `threadId`, `eventId`, `latestDateCandidate`
- **Constants**: UPPER_SNAKE_CASE for module-level constants
  - `EVENTS()`, `LATEST_EVENTS()`, `SPLIT_DOMAIN`
- **Private Fields**: # prefix (ES2022 private fields)
  ```typescript
  export class VM<T> {
    #val: T;
    get val() {
      return this.#val
    }
  }
  ```
- **Boolean Variables**: Prefix with `is`, `has`, `can`, `should`
  - `isPrivate`, `canEdit`, `imageLoadError`
- **Event Handlers**: Prefix with `on`
  - `onTitleInputChange`, `onDateInputChange`, `onClick`

### Classes & Components
- **Classes**: PascalCase
  - `SessionModel`, `EventsModule`, `TelegramBot`
- **React Components**: PascalCase, often arrow functions exported as default
  ```typescript
  const EventScreen = WithModel(({ model }: { model: SessionModel }) => {
    // component logic
  })

  export default EventScreen
  ```
- **Higher-Order Components**: PascalCase
  - `WithModel`, `BackButtonController`

### TypeScript Types & Interfaces
- **Interfaces**: PascalCase
  - `Event`, `User`, `ChatSettings`, `Notification`
- **Type Aliases**: PascalCase
  - `TgWebAppInitData`, `SavedEvent`, `ClientApiEventCommand`
- **Generic Parameters**: Single uppercase letter or PascalCase
  - `VM<T>`, `Subject<UpdateType>`

## Code Style

### Function Definitions

**Class Methods**: Use arrow functions to bind `this` automatically
```typescript
// ✅ Preferred: Arrow functions as class properties
export class SessionModel {
  private emit = (ev: string, ...args: any[]) => {
    console.log(ev, args);
    this.socket.emit(ev, ...args);
  };

  nextId = () => this.localOprationId++

  private addEvent = (event: Event) => {
    this.eventsModule.updateEventVM(event)
  }
}

// ❌ Avoid: Regular methods (require manual binding)
export class Example {
  public doSomething() {  // Not used in this codebase
    this.something();
  }
}
```

**Standalone Functions**: Regular function or const arrow
```typescript
// ✅ Both styles used
const renderEventMessage = async (event: SavedEvent, renderAttendees: boolean) => {
  // implementation
}

function getKey(chatId: number, threadId: number | undefined) {
  return [chatId, threadId].filter(Boolean).join("_");
}
```

### React Patterns

**Functional Components with Hooks**
```typescript
// ✅ Standard pattern: Arrow function with typed props
const EventScreen = WithModel(({ model }: { model: SessionModel }) => {
  const [title, setTitle] = React.useState('');
  const chatSettings = useVMvalue(model.chatSettings);

  const onClick = React.useCallback(() => {
    // logic
  }, [dependencies]);

  return <Page>...</Page>
})

export default EventScreen
```

**Memoization**
```typescript
// ✅ Use React.memo for performance-critical components
export const ListItem = React.memo(({ title, subtitle, right }: Props) => {
  return <div>...</div>
})

// ✅ Use React.useMemo for expensive computations
const crazyDateFormat = React.useMemo(() => {
  var tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(date.getTime() - tzoffset)).toISOString().slice(0, -8);
}, [date]);

// ✅ Use React.useCallback for event handlers
const onTitleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  setTitle(e.target.value);
  setEdited(true);
}, []);
```

**Context Usage**
```typescript
// ✅ Create contexts at module level
export const UserContext = React.createContext<number | undefined>(undefined);

// ✅ Use context in components
const uid = React.useContext(UserContext);
const usersModule = React.useContext(UsersProviderContext);
```

**Higher-Order Components**
```typescript
// ✅ WithModel HOC pattern for injecting SessionModel
const EventScreen = WithModel(({ model }: { model: SessionModel }) => {
  // component has access to model
})
```

### Dependency Injection (Server-side)

**Module Definition**
```typescript
// ✅ Use @singleton() decorator from TSyringe
@singleton()
export class EventsModule {
  // ✅ Inject dependencies via container.resolve()
  private geo = container.resolve(GeoModule)
  private notifications = container.resolve(NotificationsModule)

  // module implementation
}
```

**Resolving Dependencies**
```typescript
// ✅ Resolve in consuming code
const eventsModule = container.resolve(EventsModule);
```

### Async/Await & Promises

**Prefer async/await over .then()**
```typescript
// ✅ Preferred
const events = await this.events.find({ chatId, threadId }).toArray();

// ❌ Rarely used (.then() exists but avoid for new code)
```

**Promise Returns**
```typescript
// ✅ Return promises from methods
commitCommand = (operation: ClientApiEventCommand): Promise<Event> => {
  const d = new Deffered<Event>()
  this.emit("command", operation, (res) => {
    if (res.patch) {
      d.resolve(res.patch.event)
    } else {
      d.reject(new Error(res.error))
    }
  });
  return d.promise
};
```

**Non-blocking Operations**
```typescript
// ✅ Pattern: Fire-and-forget with error logging
this.geo.getTzLocation(tz).catch((e) => {
  console.error(e)
})

// ✅ Non-blocking cache updates
this.getEvents(chatId, threadId).catch((e) => console.error(e));
```

## Error Handling

### Pattern: Try-Catch with Console.error
```typescript
// ✅ Standard pattern: Try-catch with console.error
this.bot.on("my_chat_member", async (upd) => {
  try {
    // main logic
    await this.chatMetaModule.updateChat(upd.chat.id, upd.chat.title ?? "");
    await this.createPin(upd.chat.id, undefined, !isPrivate);
  } catch (e) {
    console.error(e);
  }
});

// ✅ Catch errors on promises
this.udpatePin(upd.chatId, upd.threadId, !isPrivate).catch((e) =>
  console.error(e)
);
```

### Error Messages
```typescript
// ✅ Throw descriptive errors
if (!savedEvent) {
  throw new Error("Operation not found")
}

if (!updatedEvent) {
  throw new Error("operation lost during " + type);
}
```

### No Explicit Error Types
- ❌ No custom error classes in codebase
- ✅ Use generic Error with descriptive messages
- ✅ Sentry captures all errors automatically

## MongoDB Patterns

### Transactions
```typescript
// ✅ Standard transaction pattern
const session = MDBClient.startSession()
try {
  await session.withTransaction(async () => {
    // all database operations with { session }
    await this.events.updateOne({ _id }, { $set: update }, { session })
    await this.notifications.updateMany(filter, update, { session })
  })
} finally {
  await session.endSession();
}
```

### Optimistic Concurrency
```typescript
// ✅ Use sequence numbers for optimistic locking
const savedEvent = await this.events.findOne({ _id, deleted: { $ne: true } })
await this.events.updateOne(
  { _id, seq: savedEvent.seq },  // Match current seq
  { $set: event, $inc: { seq: 1 } }  // Increment seq
)
```

### Query Patterns
```typescript
// ✅ Use $ne for soft deletes
{ deleted: { $ne: true } }

// ✅ Use $gt/$lt for range queries
{ date: { $gte: from, $lt: to } }

// ✅ Use $max for updates
{ $max: { date: latestDateCandidate } }

// ✅ Use $addToSet for arrays (no duplicates)
{ $addToSet: { messages: message.message_id } }

// ✅ Use $pull for array removal
{ $pull: { 'attendees.yes': uid, 'attendees.no': uid } }
```

## Logging & Comments

### Console Logging
```typescript
// ✅ Log important events
console.log("on_State", { events, users })
console.log("migrate_from_chat_id >>>", fromId, toId);
console.log("pin updates scheduled: " + i);

// ✅ Log errors
console.error(e);
console.error(e?.message);
console.error("stat: failed to track tg message:", e);
```

### Comments
```typescript
// ✅ Comments for clarification and TODOs
// happens on reconnect and cache update
// since some event may be deleted in between, rewrite whole event
// TODO: detect deletions?

// ✅ Explain non-obvious logic
// yep, concurrent ops/corrections can get lost, whatever

// ✅ Mark disabled features
// geo - can return unexpected results, disable until the way of removing implemented

// ❌ No JSDoc comments used in codebase (rely on TypeScript types)
```

## Styling & UI

### Inline Styles with Telegram Variables
```typescript
// ✅ Use inline styles with Telegram CSS variables
<div style={{
  backgroundColor: "var(--tg-theme-secondary-bg-color)",
  color: "var(--tg-theme-text-color)",
  borderRadius: 16,
  padding: '8px 0'
}}>

// ✅ Common Telegram variables:
// --tg-theme-bg-color
// --tg-theme-secondary-bg-color
// --tg-theme-text-color
// --tg-theme-hint-color
// --tg-theme-button-color
// --tg-theme-button-text-color
// --text-destructive-color
// --color-user-1 through --color-user-8
```

### Component Props Pattern
```typescript
// ✅ Inline type definitions for props (not separate interfaces)
export const Card = ({
  children,
  style,
  onClick
}: {
  children: any,
  style?: any,
  onClick?: React.MouseEventHandler<HTMLDivElement>
}) => {
  return <div style={{ ...defaultStyles, ...style }}>{children}</div>
}
```

### Conditional Rendering
```typescript
// ✅ Use && for conditional rendering
{editEv && <Card>...</Card>}
{!!title && <div>{title}</div>}

// ✅ Use ternary for if-else
{status === 'yes' ? '✅' : status === 'no' ? '🙅' : '🤔'}
```

## Testing

### Current State
- ❌ No test files exist (*.test.ts, *.test.tsx)
- ✅ Testing infrastructure installed: Jest, React Testing Library
- ✅ Test scripts configured: `yarn test`

### If Writing Tests (Future)
```typescript
// Follow standard Jest + React Testing Library patterns
import { render, screen } from '@testing-library/react';
import { EventScreen } from './EventScreen';

test('renders event title', () => {
  render(<EventScreen />);
  expect(screen.getByPlaceholderText('Title')).toBeInTheDocument();
});
```

## ESLint Configuration

### Rules
- Extends: `react-app`, `react-app/jest`
- ❌ No custom rules defined
- ❌ No Prettier configuration

### Style Consistency
Since no autoformatting is configured, follow these observed patterns:
- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings, double quotes for JSX attributes
- **Semicolons**: Used consistently (automatic semicolon insertion not relied upon)
- **Trailing Commas**: Not used in object/array literals
- **Line Length**: No strict limit, but keep lines readable (~120 chars max observed)

## Import Organization

### Order
```typescript
// 1. External libraries
import React from "react";
import { useSearchParams } from "react-router-dom";
import TB from "node-telegram-bot-api";

// 2. Internal modules (absolute paths from src/ or server/src/)
import { SessionModel } from "../model/SessionModel";
import { Event, Notification } from "../shared/entity";

// 3. Utilities
import { useVMvalue } from "../utils/vm/useVM";

// 4. Components
import { Card, Button, Page } from "./uikit/kit";

// 5. Types (if separate)
import { SavedEvent } from "./eventStore";
```

### Import Aliases
- ✅ Relative imports used exclusively (`../`, `./`)
- ❌ No path aliases configured (@/, ~/src/, etc.)

## Security Practices

### Environment Variables
```typescript
// ✅ Never commit .env files (in .gitignore)
// ✅ Use example.env as template
// ✅ Access via process.env
const token = process.env.TELEGRAM_BOT_TOKEN!;
const mongoUri = process.env.MONGODB_URI!;
```

### Authentication
```typescript
// ✅ Validate Telegram initData (cryptographic signature)
// ✅ Use JWT for private chat access tokens
// ✅ Verify admin status via Telegram API
const member = await this.bot.getChatMember(chatId, userId);
if (member.status === "administrator" || member.status === "creator") {
  canCreatePin = true;
}
```

### Input Validation
```typescript
// ✅ Trim user input
title: title.trim(),
description: description.trim(),

// ✅ Use undefined coalescing for optional values
threadId: threadId ?? undefined

// ❌ No explicit input sanitization (rely on MongoDB driver escaping)
```

## Performance Patterns

### Caching
```typescript
// ✅ In-memory cache with expiration logic
logCache = new Map<string, SavedEvent[]>();
getEvents = async (chatId: number, threadId: number | undefined) => {
  const freshEnough = now - 1000 * 60 * 60 * 4;  // 4 hours
  let res = await this.events.find({ date: { $gt: freshEnough } }).toArray();
  this.logCache.set(`${chatId}-${threadId}`, res)
  return res
}
```

### Debouncing
```typescript
// ✅ Use lodash.debounce for expensive operations
import debounce from 'lodash.debounce';
const debouncedSearch = debounce(searchFunction, 300);
```

### Lazy Loading
```typescript
// ✅ Lazy load routes
const SettingsScreen = lazyPreload(() => import("./settigns/SettingsScreen"));

// ✅ React.Suspense for fallback
<React.Suspense fallback={null}>
  <EventScreen />
</React.Suspense>
```

## Common Gotchas

1. **Directory Typo**: `/src/view/settigns/` is intentionally misspelled (legacy)
2. **Typos in Code**: `imidiate` instead of `immediate`, `Deffered` instead of `Deferred` (preserved for consistency)
3. **Private Fields**: Use `#` syntax (ES2022), not TypeScript `private` keyword
4. **Socket.io Callbacks**: Always provide error handling in callbacks
5. **MongoDB Sessions**: Always end session in `finally` block
6. **Telegram Variables**: Test theme variables in both light and dark modes
7. **No Tests**: Write integration tests when adding critical features
