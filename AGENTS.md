# Bachata App — Agent Instructions

Bachata dance video review platform using NestJS + PostgreSQL + OpenAI GPT-4o-mini. Users upload practice videos; AI produces timestamped feedback segments.

## Commands

```bash
npm run start:dev      # Dev server (watch mode)
npm run build          # Compile TypeScript
npm run test           # Unit tests (Jest)
npm run test:cov       # Coverage report
npm run test:e2e       # E2E tests
npm run lint           # ESLint fix-all
```

## Architecture

The project follows **Clean Architecture + DDD** with four distinct layers — do not mix concerns across layers:

| Layer | Path | Role |
|-------|------|------|
| Domain | `src/domain/` | Entities + repository interfaces (pure TypeScript, no framework) |
| Application | `src/application/use-cases/` | Orchestration, validation, error handling |
| Infrastructure | `src/infrastructure/` | Concrete repository implementations |
| Presentation | `src/presentation/controllers/` | HTTP controllers (NestJS) |
| Feature modules | `src/modules/videos/` | Self-contained video feature (own controller + service + repo) |
| Database | `src/database/entities/` | TypeORM entities (separate from domain entities) |

**Key rule**: `domain/` and `application/` must not import TypeORM or NestJS decorators.

## Conventions

- Entities: `UserEntity`, `VideoEntity` (TypeORM in `database/`)  vs `Lesson` (domain in `domain/entities/`)
- Repositories: interface in `domain/repositories/`, in-memory impl in `infrastructure/repositories/` (allows dev without DB)
- Use cases: one file per use case, tested with mocked repository
- All tests: `*.spec.ts` alongside source file
- Database status fields use TypeScript enums (`ReviewStatus`, `ProcessingJobStatus`, etc.)
- Soft delete via `visibility` field on videos

## Database

PostgreSQL (TypeORM 0.3). Requires `.env`:

```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=bachata_coach
DATABASE_USER=...
DATABASE_PASSWORD=...
```

In-memory implementations exist for all repositories — use them in tests to avoid DB dependency.

## Testing Patterns

```typescript
// Unit test pattern: mock the repository, test the use case
const mockRepo = { findById: jest.fn() };
const useCase = new GetLessonByIdUseCase(mockRepo as LessonRepository);
```

All 4 test suites pass. See [AUDIT_REPORT.md](AUDIT_REPORT.md) for full gap analysis.

## Requirements vs. Implementation Gaps

These features have database entities but **no implementation yet** — they are MVP requirements:

| Feature | Status | Key files |
|---------|--------|-----------|
| Three-chunk continuation gate | ❌ Missing | `ReviewChunkEntity`, `ReviewEntity.status` |
| Jack & Jill dancer selection | ❌ Missing | `ReviewEntity.type` |
| A-B looping + saved loops | ❌ Missing | `SavedLoopEntity` |
| Resume playback position | ❌ Missing | `VideoEntity.lastPlayedPosition` |
| Coach practice plans | ❌ Missing | `CoachPlanEntity` |
| Processing status state machine | ❌ Missing | `ProcessingJobEntity` |

When implementing these features: the entity already exists — add service logic + controller endpoint + unit test.

## Key Files

- [src/app.module.ts](src/app.module.ts) — root DI config, TypeORM setup
- [src/database/entities/index.ts](src/database/entities/index.ts) — all TypeORM entities barrel
- [src/modules/videos/video-review.service.ts](src/modules/videos/video-review.service.ts) — AI review + heuristic fallback
- [AUDIT_REPORT.md](AUDIT_REPORT.md) — detailed feature gap analysis
