# Bachata App — Agent Instructions

Bachata dance video review platform using NestJS + PostgreSQL + OpenAI GPT-4o-mini. Users upload practice videos; AI produces timestamped feedback segments and can control the video player via chat.

## Commands

```bash
npm run start:dev      # Dev server (watch mode) — use this, not npm start
npm run build          # Compile TypeScript + copies src/public/ → dist/public/
npm run test           # Unit tests (Jest) — 53 tests, 4 suites
npm run test:cov       # Coverage report
npm run test:e2e       # E2E tests (no DB required — uses minimal test module)
npm run lint           # ESLint fix-all
```

**Critical**: after any backend change, restart the dev server — NestJS does not hot-reload route registration automatically when using `npm run start` (production).

## Architecture

The project follows **Clean Architecture + DDD** with four distinct layers — do not mix concerns across layers:

| Layer | Path | Role |
|-------|------|------|
| Domain | `src/domain/` | Entities + repository interfaces (pure TypeScript, no framework) |
| Application | `src/application/use-cases/` | Orchestration, validation, error handling |
| Infrastructure | `src/infrastructure/` | Concrete repository implementations |
| Presentation | `src/presentation/controllers/` | HTTP controllers (NestJS) |
| Feature modules | `src/modules/videos/` | Self-contained video feature |
| Database | `src/database/entities/` | TypeORM entities (separate from domain entities) |

**Key rule**: `domain/` and `application/` must not import TypeORM or NestJS decorators.

## Route Ordering Rule (critical)

NestJS/Express matches routes in declaration order. **Declare specific routes before parameterized ones** in `VideosController`. The current order in [src/modules/videos/videos.controller.ts](src/modules/videos/videos.controller.ts):

```
POST :id/review/start
POST :id/review/regenerate   ← must be before getChunk
POST :id/chat
GET  :id/chat/history
DELETE :id/chat/history
GET  :id/review/chunk/:chunkNumber
GET  :id/review
GET  :id/file
POST upload-from-url
POST (file upload)
DELETE :id
```

Placing a new `POST :id/review/X` route after `GET :id/review/chunk/:chunkNumber` will cause a 404.

## Conventions

- Entities: `UserEntity`, `VideoEntity` (TypeORM in `database/`)  vs `Lesson` (domain in `domain/entities/`)
- Repositories: interface in `domain/repositories/`, in-memory impl in `infrastructure/repositories/` (allows dev without DB)
- Use cases: one file per use case, tested with mocked repository
- All tests: `*.spec.ts` alongside source file
- Database status fields use TypeScript enums (`ReviewStatus`, `ProcessingJobStatus`, etc.)
- Soft delete via `visibility` field on videos
- **Videos** are stored in `InMemoryVideoRepository` (in-memory, no DB); **chat history** uses PostgreSQL via `ChatHistoryService`

## Database

PostgreSQL (TypeORM 0.3). Requires `.env`:

```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=bachata_coach
DATABASE_USER=...
DATABASE_PASSWORD=...
```

`synchronize: true` in non-production — new entity columns are auto-created.

## Testing Patterns

```typescript
// Controller unit test — mock all three constructor deps
const mockRepo = { getById: jest.fn(), list: jest.fn(), ... };
const mockReviewService = { reviewVideo: jest.fn(), chat: jest.fn().mockResolvedValue({ reply: 'ok', actions: [] }) };
const mockChatHistory = { getHistory: jest.fn().mockResolvedValue([]), saveMessage: jest.fn(), clearHistory: jest.fn() };
const controller = new VideosController(mockRepo, mockReviewService, mockChatHistory);
```

E2E tests in [test/app.e2e-spec.ts](test/app.e2e-spec.ts) build a minimal `TestingModule` without TypeORM — do not import `AppModule` in e2e tests.

## Frontend

Single-page app at [src/public/index.html](src/public/index.html) — no build step, plain HTML/CSS/JS served by NestJS.

- **Video player**: custom controls only — no `controls` attribute on `<video>`. Play/pause, seek bar, volume/mute, fullscreen are custom DOM elements. Do not add the `controls` attribute back.
- **Mirror**: toggles `.mirrored` CSS class on `#videoMirrorWrap` (wrapper div), NOT on the `<video>` element.
- **Speed shortcuts**: Shift+`<` / Shift+`>` step through `[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]`; handled in `document` keydown listener.
- **A-B loop UI**: drag-handle timeline fully implemented. Backend persistence (`SavedLoopEntity`) not yet wired up.
- **Chat**: `#chatPanel` is always in static HTML. `sendChatMessage()` builds context from player state and POSTs to `/videos/:id/chat`. The response `{ reply, actions[] }` is rendered as a bubble with action chips, then `executeActions()` dispatches each action to existing player functions.
- **`dist/public/`**: copied from `src/public/` by `nest build` (via `nest-cli.json` assets). `npm run start:dev` serves directly from `src/public/`.
- **Uploads**: `uploads/` is git-ignored — never commit video files.

## Chat / AI Tool-Calling

`VideoReviewService.chat()` returns `{ reply: string, actions: ChatAction[] }` where actions are structured commands the frontend executes. Available action types:

| Action | Effect |
|--------|--------|
| `{ type: 'regenerate', feedback? }` | Re-analyze current chunk with correction |
| `{ type: 'seek', time }` | Seek video to timestamp |
| `{ type: 'loop', start, end }` | Start A-B loop |
| `{ type: 'stopLoop' }` | Stop looping |
| `{ type: 'setSpeed', rate }` | Set playback speed |
| `{ type: 'mirror' }` | Toggle mirror |

Chat history (text + actions) is persisted in `chat_messages` (PostgreSQL via `ChatHistoryService`). Loaded on `selectVideo()`. The AI uses server-side history for context — do not pass client history in the request body.

## Requirements vs. Implementation Gaps

| Feature | Status | Key files |
|---------|--------|-----------|
| Three-chunk continuation gate | ❌ Missing | `ReviewChunkEntity`, `ReviewEntity.status` |
| Jack & Jill dancer selection | ❌ Missing | `ReviewEntity.type` |
| A-B loop persistence | ⚠️ UI done, API missing | `SavedLoopEntity` |
| Resume playback position | ❌ Missing | `VideoEntity.lastPlayedPosition` |
| Coach practice plans | ❌ Missing | `CoachPlanEntity` |
| Processing status state machine | ❌ Missing | `ProcessingJobEntity` |

When implementing: the entity already exists — add service logic + controller endpoint + unit test.

## Key Files

- [src/app.module.ts](src/app.module.ts) — root DI config, TypeORM + `ChatMessageEntity` registered
- [src/database/entities/index.ts](src/database/entities/index.ts) — all TypeORM entities barrel
- [src/modules/videos/videos.controller.ts](src/modules/videos/videos.controller.ts) — all video HTTP routes
- [src/modules/videos/video-review.service.ts](src/modules/videos/video-review.service.ts) — AI review + chat with tool-calling
- [src/modules/videos/chat-history.service.ts](src/modules/videos/chat-history.service.ts) — PostgreSQL-backed chat persistence
- [src/database/entities/chat-message.entity.ts](src/database/entities/chat-message.entity.ts) — chat history schema

