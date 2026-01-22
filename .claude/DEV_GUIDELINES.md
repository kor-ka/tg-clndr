# Development Guidelines

This document describes how to develop features, structure code, and follow workflows in the TG-CLNDR project.

## Getting Started

### Prerequisites
- Node.js 12+ (for backend)
- Yarn package manager
- MongoDB instance (local or Atlas)
- Telegram Bot Token (from @BotFather)

### Initial Setup
```bash
# Install frontend dependencies
yarn install

# Install server dependencies
cd server && yarn install && cd ..

# Copy environment template
cp example.env .env

# Edit .env with your credentials
# MONGODB_URI="mongodb://localhost:27017/tg-clndr"
# TELEGRAM_BOT_TOKEN="your_bot_token"
# ACCESS_TOKEN_SECRET="random_secret_string"
# GEO_KEY="optional_geo_api_key"
```

### Development Workflow
```bash
# Terminal 1: Run React development server (port 3000)
yarn start

# Terminal 2: Build and run Node.js server (port 5001)
yarn buildServer && yarn startServer

# Or separately:
yarn buildServer   # Compiles TypeScript in /server to /server/dist
yarn startServer   # Runs compiled server
```

### Production Build
```bash
# Full production build (frontend + backend + source maps)
yarn build

# This runs:
# 1. react-scripts build (creates /build)
# 2. cd server && yarn install (installs server deps)
# 3. yarn buildServer (compiles TypeScript)
# 4. yarn sentry:sourcemaps (uploads source maps to Sentry)
```

### Testing
```bash
# Run tests (when tests exist)
yarn test

# Note: No tests currently exist, but infrastructure is ready
```

## Project Structure & Module Organization

### Adding a New Server Module

**Location**: `/server/src/modules/<moduleName>/`

**Pattern**: Each module is a singleton class with dependency injection

**Template**:
```typescript
// /server/src/modules/exampleModule/ExampleModule.ts
import { singleton } from "tsyringe";
import { container } from "tsyringe";
import { MDBClient } from "../../utils/MDB";
import { EXAMPLE_COLLECTION } from "./exampleStore";

@singleton()
export class ExampleModule {
  // Inject dependencies
  private otherModule = container.resolve(OtherModule);

  // Get MongoDB collection
  private collection = EXAMPLE_COLLECTION();

  // Public methods
  async getExample(id: string) {
    return await this.collection.findOne({ _id: id });
  }

  async createExample(data: ExampleData) {
    const session = MDBClient.startSession();
    try {
      await session.withTransaction(async () => {
        await this.collection.insertOne(data, { session });
      });
    } finally {
      await session.endSession();
    }
  }
}
```

**Store File** (if using MongoDB):
```typescript
// /server/src/modules/exampleModule/exampleStore.ts
import { MDBClient } from "../../utils/MDB";

export interface ExampleData {
  id: string;
  name: string;
  createdAt: number;
}

export const EXAMPLE_COLLECTION = () =>
  MDBClient.db("tg-clndr").collection<ExampleData>("examples");

// Create indexes
EXAMPLE_COLLECTION().createIndex({ id: 1 }, { unique: true });
```

**Integration**:
```typescript
// In consuming code (e.g., server/src/api/ClientAPI.ts)
import { container } from "tsyringe";
import { ExampleModule } from "../modules/exampleModule/ExampleModule";

const exampleModule = container.resolve(ExampleModule);
const data = await exampleModule.getExample(id);
```

### Adding a New Client Module

**Location**: `/src/model/<ModuleName>.ts`

**Pattern**: Class with Value Models (VM) for reactive state

**Template**:
```typescript
// /src/model/ExampleModule.ts
import { VM } from "../utils/vm/VM";
import { Example } from "../shared/entity";

export class ExampleModule {
  private examples = new Map<string, VM<Example>>();

  getExample(id: string): VM<Example> | undefined {
    return this.examples.get(id);
  }

  updateExample(example: Example) {
    let vm = this.examples.get(example.id);
    if (!vm) {
      vm = new VM(example);
      this.examples.set(example.id, vm);
    } else {
      vm.next(example);
    }
  }

  useExample(id: string): Example | undefined {
    const vm = this.getExample(id);
    return useVMvalue(vm);  // React hook
  }
}
```

**Integration in SessionModel**:
```typescript
// /src/model/SessionModel.ts
export class SessionModel {
  readonly exampleModule: ExampleModule;

  constructor(params: InitParams) {
    this.exampleModule = new ExampleModule();

    // Subscribe to Socket.io updates
    this.socket.on("example_update", (example: Example) => {
      this.exampleModule.updateExample(example);
    });
  }
}
```

### Adding a New React Component

**Location**:
- Screens: `/src/view/<ScreenName>.tsx`
- UI Kit: `/src/view/uikit/<ComponentName>.tsx`
- Feature-specific: `/src/view/<feature>/<ComponentName>.tsx`

**Template**:
```typescript
// /src/view/ExampleScreen.tsx
import React from "react";
import { SessionModel } from "../model/SessionModel";
import { WithModel } from "./utils/withModelHOC";
import { useVMvalue } from "../utils/vm/useVM";
import { Card, Button, Page } from "./uikit/kit";
import { BackButtonController } from "./uikit/tg/BackButtonController";

const ExampleScreen = WithModel(({ model }: { model: SessionModel }) => {
  const example = useVMvalue(model.exampleModule.getExample('id'));
  const [title, setTitle] = React.useState('');

  const onTitleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);

  const onSave = React.useCallback(() => {
    // Call model method
    model.exampleModule.saveExample({ title });
  }, [model, title]);

  return (
    <Page>
      <BackButtonController />
      <Card>
        <input value={title} onChange={onTitleChange} />
      </Card>
      <Button onClick={onSave}>Save</Button>
    </Page>
  );
});

export default ExampleScreen;
```

**Add Route**:
```typescript
// /src/view/App.tsx
const ExampleScreen = lazyPreload(() => import("./ExampleScreen"));

const router = createBrowserRouter([
  // ... existing routes
  {
    path: "/tg/example",
    element: (
      <ErrorBoundry>
        <React.Suspense fallback={null}>
          <ExampleScreen />
        </React.Suspense>
      </ErrorBoundry>
    ),
  },
]);
```

### Adding Shared Types

**Location**: `/src/shared/entity.ts`

**Pattern**: Interfaces and types shared between client and server

```typescript
// /src/shared/entity.ts
export interface Example {
  id: string;
  title: string;
  description: string;
  createdAt: number;
}

export type ExampleStatus = 'active' | 'inactive' | 'deleted';

export interface ExampleCommand {
  type: 'create' | 'update' | 'delete';
  example: Partial<Example>;
}
```

## Socket.io Communication Pattern

### Client → Server Command
```typescript
// Client side (/src/model/SessionModel.ts)
saveExample = (example: Example): Promise<Example> => {
  const d = new Deffered<Example>();
  this.emit("save_example", example, (res: {
    saved: Example,
    error: never
  } | {
    error: string,
    saved: never
  }) => {
    if (res.saved) {
      this.exampleModule.updateExample(res.saved);
      d.resolve(res.saved);
    } else {
      d.reject(new Error(res.error));
    }
  });
  return d.promise;
};
```

### Server Side Handler
```typescript
// Server side (/server/src/api/ClientAPI.ts)
socket.on("save_example", async (example: Example, ack) => {
  try {
    const saved = await exampleModule.save(example);
    ack({ saved });

    // Broadcast to all clients in same chat
    broadcastToChat(chatId, "example_update", saved);
  } catch (error) {
    ack({ error: error.message });
  }
});
```

### Server → Client Broadcast
```typescript
// Server broadcasts update to all connected clients
exampleModule.onUpdate.subscribe((update) => {
  const { chatId, example } = update;
  io.to(`chat:${chatId}`).emit("example_update", example);
});
```

## Database Patterns

### MongoDB Transactions
Use transactions for multi-document operations:

```typescript
const session = MDBClient.startSession();
try {
  await session.withTransaction(async () => {
    // All operations must include { session }
    await this.events.insertOne(data, { session });
    await this.notifications.updateMany(filter, update, { session });
    await this.latestEvents.updateOne(filter, update, { upsert: true, session });
  });
} finally {
  await session.endSession();  // Always end session
}
```

### Optimistic Concurrency Control
Use sequence numbers to prevent lost updates:

```typescript
// 1. Read current document
const doc = await this.collection.findOne({ _id });

// 2. Update with seq check
const result = await this.collection.updateOne(
  { _id, seq: doc.seq },  // Only update if seq matches
  { $set: update, $inc: { seq: 1 } }  // Increment seq
);

// 3. Check if update succeeded
if (result.matchedCount === 0) {
  throw new Error("Document was modified by another operation");
}
```

### Soft Deletes
Never hard-delete user data:

```typescript
// ✅ Soft delete
await this.events.updateOne(
  { _id },
  { $set: { deleted: true }, $inc: { seq: 1 } }
);

// ✅ Query excluding deleted
const events = await this.events.find({ deleted: { $ne: true } }).toArray();
```

### Indexes
Define indexes in store files:

```typescript
// Create indexes immediately
EVENTS().createIndex({ chatId: 1, threadId: 1 });
EVENTS().createIndex({ chatId: 1, threadId: 1, idempotencyKey: 1 }, { unique: true });
EVENTS().createIndex({ date: 1 });
```

## Telegram Bot Integration

### Adding a New Bot Command
```typescript
// /server/src/api/tg/tg.ts
this.onCommand("mycommand", async (msg) => {
  const chatId = msg.chat.id;
  const isPrivate = msg.chat.id === msg.from?.id;

  try {
    // Your command logic
    await this.bot.sendMessage(chatId, "Command executed!");
  } catch (e) {
    console.error(e);
  }
});
```

### Adding Inline Button Handler
```typescript
// /server/src/api/tg/tg.ts
this.bot.on("callback_query", async (q) => {
  const { data: dataString, from, message } = q;
  if (message && dataString) {
    let data = dataString.split("/");

    if (data[0] === "myaction") {
      const param = data[1];
      // Handle button click
      await this.handleMyAction(message.chat.id, param);
    }

    await this.bot.answerCallbackQuery(q.id);
  }
});
```

### Sending Messages with Buttons
```typescript
const buttons: TB.InlineKeyboardButton[][] = [
  [
    { text: "Option 1", callback_data: "myaction/option1" },
    { text: "Option 2", callback_data: "myaction/option2" },
  ],
  [
    { text: "Open App", url: `https://t.me/clndrrrbot/clndr?startapp=...` },
  ],
];

await this.bot.sendMessage(chatId, "Choose an option:", {
  reply_markup: { inline_keyboard: buttons },
  parse_mode: "HTML",
  message_thread_id: threadId,
});
```

## React Patterns

### Using Value Models (VM)
```typescript
// Get VM from module
const eventVM = model.eventsModule.getEventVM(eventId);

// Use in component (subscribes automatically)
const event = useVMvalue(eventVM);

// Manual subscription (rare)
React.useEffect(() => {
  const unsubscribe = eventVM.subscribe((value) => {
    console.log("Event updated:", value);
  });
  return unsubscribe;  // Cleanup on unmount
}, [eventVM]);
```

### Navigation
```typescript
import { useGoBack, useGoHome } from "./utils/navigation/useGoHome";

const MyComponent = () => {
  const goBack = useGoBack();
  const goHome = useGoHome();

  const onCancel = () => goBack();
  const onComplete = () => goHome();
};
```

### Telegram WebApp Integration
```typescript
import { WebApp, showConfirm } from "./utils/webapp";

// Show confirmation dialog
showConfirm("Are you sure?", (confirmed) => {
  if (confirmed) {
    // User clicked OK
  }
});

// Open link
WebApp?.openLink("https://example.com");

// Open Telegram link
WebApp?.openTelegramLink("https://t.me/channel");

// Check if running in Telegram
const isTelegram = !!WebApp;
```

### Custom Hooks Pattern
```typescript
// /src/view/useHandleOperation.ts
export const useHandleOperation = (): [
  (operation: () => Promise<any>, onSuccess?: () => void) => void,
  boolean
] => {
  const [loading, setLoading] = React.useState(false);

  const handleOperation = React.useCallback(
    async (operation: () => Promise<any>, onSuccess?: () => void) => {
      setLoading(true);
      try {
        await operation();
        onSuccess?.();
      } catch (e) {
        WebApp?.showAlert((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return [handleOperation, loading];
};
```

## File Organization for New Features

### Feature: Add "Polls" to Events

**1. Add shared types**:
```
/src/shared/entity.ts
  - Add Poll interface
  - Add PollOption interface
  - Extend Event interface with poll?: Poll
```

**2. Create server module**:
```
/server/src/modules/pollsModule/
  ├── PollsModule.ts       # Business logic
  ├── pollStore.ts         # MongoDB collection & indexes
  └── pollTypes.ts         # Server-specific types (if needed)
```

**3. Create client module**:
```
/src/model/PollsModule.ts  # Client state management
```

**4. Update SessionModel**:
```typescript
// /src/model/SessionModel.ts
readonly pollsModule: PollsModule;

constructor() {
  this.pollsModule = new PollsModule();

  this.socket.on("poll_update", (poll: Poll) => {
    this.pollsModule.updatePoll(poll);
  });
}
```

**5. Add Socket.io handlers**:
```typescript
// /server/src/api/ClientAPI.ts
socket.on("vote_poll", async (pollId, optionId, ack) => {
  // Handle vote
});
```

**6. Create UI components**:
```
/src/view/poll/
  ├── PollComponent.tsx     # Display poll
  ├── PollEditor.tsx        # Create/edit poll
  └── PollResults.tsx       # Show results
```

**7. Integrate into EventScreen**:
```typescript
// /src/view/EventScreen.tsx
import { PollComponent } from "./poll/PollComponent";

// Add to render
{event.poll && <PollComponent poll={event.poll} />}
```

## Dependency Management

### Adding Frontend Dependencies
```bash
# Install as production dependency
yarn add <package-name>

# Install as dev dependency (types, build tools)
yarn add -D <package-name>

# Always install types for TypeScript libraries
yarn add -D @types/<package-name>
```

### Adding Backend Dependencies
```bash
cd server
yarn add <package-name>
yarn add -D @types/<package-name>
cd ..
```

### Updating Dependencies
```bash
# Check for outdated packages
yarn outdated

# Update specific package
yarn upgrade <package-name>@<version>

# Update all (careful!)
yarn upgrade
```

## Git Workflow

### Branch Naming
Based on the current branch pattern:
- `claude/<feature-name>-<id>` - Feature branches created by Claude

### Commit Messages
Follow existing patterns:
- `feat(<scope>): description` - New feature
- `fix(<scope>): description` - Bug fix
- `ref(<scope>): description` - Refactoring
- `chore: description` - Build, dependencies, etc.

Examples from git log:
```
feat(assistant): add buttonUrl to result
fix(assistant): parse ids
ref(assistant): button obj
fix(tg): do not render attendees for private
```

### Commit Workflow
```bash
# Check status
git status

# Add files
git add <files>

# Commit with descriptive message
git commit -m "feat(polls): add poll voting functionality"

# Push to feature branch
git push -u origin claude/<feature-name>-<id>
```

## Build & Deployment

### Local Build Testing
```bash
# Build everything
yarn build

# Check build output
ls -la build/
ls -la server/dist/

# Test production build locally
yarn startServer
# Access at http://localhost:5001/tg/
```

### Heroku Deployment
The project is configured for Heroku deployment via `Procfile`:

```bash
# Heroku will run:
web: yarn startServer

# After building with:
yarn build  # (configured in package.json scripts)
```

**Environment Variables** (set in Heroku dashboard or CLI):
```bash
heroku config:set MONGODB_URI="..."
heroku config:set TELEGRAM_BOT_TOKEN="..."
heroku config:set ACCESS_TOKEN_SECRET="..."
heroku config:set GEO_KEY="..."
```

### Sentry Source Maps
Source maps are automatically uploaded during build:
```bash
yarn sentry:sourcemaps
# Uploads to org: unaspace, project: cal
```

## Performance Considerations

### Client-Side
- ✅ Use `React.memo` for list items and frequently re-rendered components
- ✅ Use `React.useCallback` for event handlers to prevent re-renders
- ✅ Use `React.useMemo` for expensive computations
- ✅ Lazy load routes with `lazyPreload()`
- ✅ Debounce user input with `lodash.debounce`

### Server-Side
- ✅ Use in-memory caching for frequently accessed data (with expiration)
- ✅ Index MongoDB queries (check with `.explain()`)
- ✅ Batch updates when possible
- ✅ Use MongoDB connection pooling (configured with minPoolSize: 100)
- ✅ Non-blocking operations: fire-and-forget with `.catch(console.error)`

### Database
- ✅ Create indexes for all query filters
- ✅ Use projections to limit returned fields
- ✅ Limit query results (use `.limit()`)
- ✅ Use `$ne: true` for soft deletes (faster than `$exists`)

## Common Development Tasks

### Adding a New REST Endpoint
```typescript
// /server/src/index.tsx
app.get('/api/v1/myendpoint/:param', async (req, res) => {
  try {
    const { param } = req.params;
    const result = await myModule.doSomething(param);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Adding a Cron Job
```typescript
// /server/src/index.tsx or module file
import { CronJob } from "cron";

new CronJob(
  "0 * * * *",  // Every hour
  async () => {
    console.log("Cron job started");
    try {
      await myModule.doPeriodicTask();
    } catch (e) {
      console.error("Cron job failed:", e);
    }
  },
  null,
  true  // Start immediately
);
```

### Adding Environment Variables
```bash
# 1. Add to example.env
echo "MY_NEW_VAR=example_value" >> example.env

# 2. Add to your .env
echo "MY_NEW_VAR=actual_value" >> .env

# 3. Use in code
const myVar = process.env.MY_NEW_VAR;

# 4. Update Heroku
heroku config:set MY_NEW_VAR="production_value"
```

## Debugging

### Client-Side
- Use browser DevTools
- Check console for Socket.io events (all events are logged)
- Inspect Telegram WebApp API: `window.Telegram.WebApp`

### Server-Side
```typescript
// Add strategic console.log
console.log("Debug:", { variable1, variable2 });

// Check Sentry for errors
// https://sentry.io/organizations/unaspace/projects/cal/

// Monitor MongoDB operations
// Add .explain() to queries during development
const explained = await collection.find(query).explain();
console.log(explained);
```

### Socket.io Debugging
```typescript
// Client: All events are logged
this.socket.onAny((...e) => {
  console.log(e);  // Already implemented
});

// Server: Add logging
socket.onAny((eventName, ...args) => {
  console.log("Socket event:", eventName, args);
});
```

## Code Review Checklist

Before committing new code:
- [ ] TypeScript strict mode passes (no `any` escapes unless documented)
- [ ] Error handling with try-catch and console.error
- [ ] MongoDB transactions for multi-document operations
- [ ] React.memo for list components
- [ ] React.useCallback for event handlers
- [ ] Inline styles use Telegram CSS variables
- [ ] Socket.io events have acknowledgment callbacks
- [ ] Shared types defined in `/src/shared/entity.ts`
- [ ] Module uses dependency injection (@singleton decorator)
- [ ] No hardcoded values (use environment variables)
- [ ] Tested in both light and dark Telegram themes
- [ ] No console.log in production (use console.error for errors)
- [ ] Sentry captures critical errors
