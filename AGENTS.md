# Bachata Coach Agent Guide

NestJS 11 application for uploading bachata practice videos and generating AI-assisted reviews. Run commands from this directory.

## Build And Validate

- Install dependencies with `npm install`. If the macOS global npm cache returns `EPERM`, use `npm install --cache .npm-cache`.
- Use `npm run start:dev` for local development; the frontend and API are served together.
- Run `npm run build` after implementation changes.
- Run focused Jest specs while iterating, then `npm test -- --runInBand` for the unit suite.
- Run `npm run test:e2e` for HTTP-level changes.
- `npm run lint` applies fixes; inspect its changes and do not mix unrelated formatting into the task.

## Architecture

- `src/domain/` contains framework-free entities and repository contracts.
- `src/application/use-cases/` orchestrates domain behavior. Domain and application code must not import NestJS or TypeORM decorators.
- `src/infrastructure/` contains repository implementations for domain contracts.
- `src/presentation/controllers/` exposes the lesson and health HTTP endpoints.
- `src/modules/practice-review/` owns practice-video upload, review, saved-review, and AI chat behavior.
- `src/modules/users/` owns registration, sessions, and user settings.
- `src/database/entities/` contains TypeORM persistence models; these are distinct from domain and feature-level entities.
- `src/app.module.ts` is the composition root. Register new controllers, providers, repositories, and TypeORM entities there.

`PracticeVideoEntity` in `src/modules/practice-review/` is stored by `InMemoryVideoRepository`. `VideoEntity` in `src/database/entities/` is a separate TypeORM model. Do not substitute one for the other without changing the owning repository and tests.

## Runtime And Data

- Copy `.env.example` to `.env`; never commit credentials from `.env`.
- `DATABASE_TYPE=sqljs` is the zero-setup local default. PostgreSQL is opt-in with `DATABASE_TYPE=postgres` and the `DATABASE_*` variables.
- sqljs always synchronizes its in-memory schema; PostgreSQL synchronizes only outside production. The project does not yet use migrations, so treat entity changes as schema changes and test startup.
- The browser app is plain HTML/CSS/JavaScript in `src/public/index.html`; Nest copies it into `dist/public` during builds.

## Change Boundaries

- Keep `*.spec.ts` beside source files and mock constructor dependencies at the service/controller boundary.
- Prefer string-union status types already used by persistence entities; do not introduce enums solely for database fields.
- Do not edit generated or runtime data in `dist/`, `coverage/`, `.npm-cache/`, `.temp/`, `.tmp/`, or `uploads/`.
- Follow the scoped instructions in `.github/instructions/` when changing persistence entities, practice-review code, or the frontend.