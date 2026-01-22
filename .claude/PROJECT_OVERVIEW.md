# TG-CLNDR Project Overview

## Purpose

**@clndrrrbot** is a Telegram Mini App (Web App) that enables shared calendar management directly within Telegram chats. It allows groups to:
- Create and manage calendar events within Telegram chat groups
- Track event attendance with yes/no/maybe responses
- Share calendars across chats with seamless integration to native iOS/Android calendar apps
- Set up event notifications with configurable timing
- Export calendars in ICS format for external calendar sync
- Use geolocation support for event locations
- Interact through both a web interface and Telegram bot commands

## Architecture

### High-Level Design

This is a **full-stack TypeScript monorepo** with clear separation between client and server:

```
Frontend (React SPA) <---> Socket.io <---> Backend (Node.js/Express) <---> MongoDB
                              ^
                              |
                      Telegram Bot API
```

**Key Architectural Patterns:**
- **Dependency Injection**: TSyringe container manages server-side module lifecycle
- **Observable Pattern**: Custom Value Model (VM) for reactive state management on client
- **Real-time Sync**: Socket.io bidirectional communication for instant updates
- **Module Pattern**: Encapsulated business logic in server modules with clear responsibilities
- **Server-Side Rendering (SSR)**: Initial page load rendered on server for performance
- **Event Sourcing**: Events stored with sequence numbers for optimistic concurrency control

### Directory Structure

```
/home/user/tg-clndr/
├── /src/                           # React Frontend (Client-side)
│   ├── /model/                     # Client state management
│   │   ├── SessionModel.ts         # Main session/connection manager
│   │   ├── EventsModule.ts         # Client-side events state
│   │   └── UsersModule.ts          # Client-side users state
│   ├── /view/                      # UI Components
│   │   ├── /uikit/                 # Reusable UI components & Telegram integrations
│   │   ├── /settigns/              # Settings screens (note: typo in dir name)
│   │   ├── /monthcal/              # Month calendar view
│   │   ├── /utils/                 # Client utilities (navigation, webApp detection)
│   │   ├── App.tsx                 # Main app component & routing
│   │   ├── MainScreen.tsx          # Home screen with event list
│   │   └── EventScreen.tsx         # Event creation/editing screen
│   ├── /shared/                    # Shared types & entities (used by both client & server)
│   ├── /utils/                     # Shared utilities
│   │   └── /vm/                    # Value Model pattern implementation
│   └── index.tsx                   # React entry point
│
├── /server/src/                    # Node.js Backend
│   ├── /api/                       # API Handlers
│   │   ├── /tg/                    # Telegram bot integration
│   │   │   ├── tg.ts               # Main bot logic & event handlers
│   │   │   ├── renderPin.ts        # Render pinned calendar message
│   │   │   └── renderEvent.ts      # Render event messages
│   │   ├── ClientAPI.ts            # WebSocket API for Telegram Web App
│   │   ├── socket.ts               # Socket.io server setup
│   │   └── Auth.ts                 # Authentication & authorization
│   ├── /modules/                   # Business Logic Modules
│   │   ├── /eventsModule/          # Event CRUD, attendance, storage
│   │   ├── /userModule/            # User profiles & metadata
│   │   ├── /notificationsModule/   # Event notification scheduling
│   │   ├── /icsModule/             # iCalendar export generation
│   │   ├── /geoModule/             # Geolocation & timezone services
│   │   ├── /pinsModule/            # Pinned message management
│   │   ├── /statsModule/           # Usage analytics
│   │   └── /chatMetaModule/        # Chat metadata & settings
│   ├── /utils/                     # Server utilities (MongoDB, performance)
│   ├── index.tsx                   # Express server entry point
│   └── instrument.js               # Sentry initialization
│
├── /public/                        # Static assets (favicon, manifest)
├── /build/                         # Production build output (generated)
├── package.json                    # Frontend dependencies & build scripts
├── server/package.json             # Backend dependencies
├── tsconfig.json                   # TypeScript configuration
├── example.env                     # Environment variables template
└── Procfile                        # Heroku deployment config
```

## Technology Stack

### Frontend
- **React 18.2** - UI framework
- **TypeScript 4.4** - Type safety
- **React Router DOM 6.11** - Client-side routing
- **Socket.io Client 4.6** - WebSocket communication
- **Linkify** - URL detection and rendering
- **Lodash Debounce** - Performance optimization
- **js-cookie** - Cookie management
- **Classnames** - Dynamic CSS classes
- **Sentry Client** - Error tracking

### Backend
- **Node.js + Express 4.17** - HTTP server
- **TypeScript 4.0** - Type safety
- **Socket.io 4.5** - WebSocket server
- **MongoDB 4.8** - NoSQL database
- **node-telegram-bot-api 0.61** - Telegram Bot API
- **TSyringe 4.7** - Dependency injection
- **JWT 9.0** - Token-based authentication
- **Cron 2.3** - Job scheduling
- **ICS 3.2** - iCalendar format generation
- **Axios 1.5** - HTTP client
- **Sentry Node** - Error tracking
- **React DOM Server** - SSR

### Build & Development
- **React Scripts 5.0** (Create React App) - Frontend build
- **TypeScript Compiler** - Backend compilation
- **Sentry CLI** - Source map management
- **Jest** - Testing framework (infrastructure exists, no tests yet)

### Infrastructure
- **MongoDB Atlas** - Database hosting
- **Heroku** - Application hosting
- **Sentry** - Error monitoring
- **Telegram Bot API** - Bot integration

## Main Technologies & Frameworks

### Custom Value Model (VM) Pattern
A lightweight reactive state management system (`src/utils/vm/VM.ts`):
- Observable pattern for reactive updates
- Private fields using # syntax
- Subscribe/unsubscribe mechanism
- Immediate or deferred notifications
- Used throughout the client for state management

### Dependency Injection with TSyringe
Server-side modules use constructor injection:
- `@singleton()` decorator for module lifecycle
- `container.resolve()` for dependency access
- Clear separation of concerns
- Easy testing and mocking

### Real-time Communication
Socket.io powers bidirectional updates:
- Client emits commands (create, update, delete events)
- Server broadcasts updates to all connected clients
- Acknowledgment callbacks for operation confirmation
- Automatic reconnection handling

### MongoDB with Transactions
- Collections: events, latest_events, users, notifications, stats, pins, chats
- ACID transactions for data consistency
- Optimistic concurrency control with sequence numbers
- Connection pooling (minPoolSize: 100)
- Indexes on chatId, threadId, idempotencyKey

## Key Design Decisions

### 1. Monorepo Structure
**Why**: Shared TypeScript types between client and server, single deployment pipeline, easier refactoring.

### 2. Custom VM Pattern vs. Redux/MobX
**Why**: Lightweight, minimal bundle size, no external dependencies, perfectly suited for small-medium complexity.

### 3. Socket.io vs. REST for State Sync
**Why**: Real-time updates across all clients, instant feedback, reduced polling overhead.

### 4. MongoDB vs. PostgreSQL
**Why**: Flexible schema for evolving features, native JSON support, horizontal scaling for chat-based data.

### 5. Server-Side Rendering
**Why**: Faster initial load for Telegram Web App, better perceived performance, SEO not required but nice-to-have.

### 6. Telegram Mini App vs. Native Bot
**Why**: Rich UI capabilities, complex interactions, better UX than inline keyboards, cross-platform without app stores.

### 7. Inline Styles with CSS Variables
**Why**: Telegram theme integration, dynamic theming, no CSS modules complexity, component-scoped styling.

## Unique Aspects

### Telegram Integration
- **Mini App (Web App)**: Runs inside Telegram using `window.Telegram.WebApp` API
- **Bot Commands**: Parallel bot interface with `/start`, `/pin`, etc.
- **Deep Linking**: `startapp` parameter for chat/thread routing
- **Inline Keyboards**: Attendance buttons on event messages
- **Theme Awareness**: Uses Telegram CSS variables for native look

### Dual Interface
1. **Web App Interface**: Full calendar view, event editing, settings
2. **Bot Interface**: Pinned messages, notifications, quick actions

### Privacy & Authentication
- Telegram's `initData` for authentication (cryptographically signed)
- JWT tokens for private chat access
- Admin-only operations verified via Telegram API
- Chat-based permissions model

### Event Management
- **Idempotency Keys**: Prevent duplicate events (`${uid}_${localId}`)
- **Sequence Numbers**: Optimistic concurrency control
- **Soft Deletes**: Events marked as deleted, not removed
- **Attendance Tracking**: Atomic operations for yes/no/maybe responses
- **Notifications**: Configurable alerts before events

### Performance Optimizations
- In-memory cache for recent events (`logCache`)
- React.memo for component memoization
- Debounced user interactions
- Lazy loading of routes
- SSR for initial render
- Connection pooling for MongoDB

## Environment Configuration

Required environment variables (see `example.env`):
- `MONGODB_URI` - MongoDB connection string
- `TELEGRAM_BOT_TOKEN` - Bot API token from @BotFather
- `ACCESS_TOKEN_SECRET` - JWT signing secret
- `GEO_KEY` - Geolocation API key (optional)

## Entry Points

### Frontend
- **Path**: `/tg/`
- **File**: `src/index.tsx`
- **Initialization**: Waits for `window.Telegram.WebApp.ready()`, creates SessionModel, renders App

### Backend
- **Port**: 5001 (dev) or `process.env.PORT` (production)
- **File**: `server/src/index.tsx`
- **Routes**:
  - `/tg/*` - SSR for initial load
  - `/api/v1/assistant/*` - Assistant API endpoints
  - `/ics/:key/cal.ics` - Calendar export
  - `/enabledInChat/:chatId` - Feature availability check
  - WebSocket endpoint for Socket.io

### Deployment
- **Platform**: Heroku
- **Process**: `web: yarn startServer` (from Procfile)
- **Build**: `yarn build` → React build + server compilation + Sentry source maps

## External Services

- **Telegram Bot API**: Bot updates, message sending, user info
- **Sentry**: Error tracking and performance monitoring (org: unaspace, project: cal)
- **Geolocation Service**: Timezone and location lookup (GEO_KEY)
- **tg-split**: External service integration (https://tg-split.herokuapp.com)

## Code Statistics

- **Total Lines**: ~2,139 (excluding node_modules)
- **Languages**: TypeScript (95%), JavaScript (5%)
- **Architecture**: Modular, event-driven, real-time
- **Type Safety**: Full TypeScript with strict mode enabled
