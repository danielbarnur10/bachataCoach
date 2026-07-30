# Bachata App V2

This project is a small NestJS API that demonstrates clean architecture and onion-style layering for a learning application about bachata dance lessons.

## What this app teaches

- NestJS controllers, services, and dependency injection
- Domain-driven design with entities and repository abstractions
- Application use cases for business logic
- A simple infrastructure layer with an in-memory repository
- Test-driven development with unit tests

## Project structure

- src/domain: business entities and repository contracts
- src/application: use cases that orchestrate business logic
- src/infrastructure: concrete implementations such as repositories
- src/presentation: controllers that expose the API

## Run locally

```bash
npm install
npm run start:dev
```

Then open:

- http://localhost:3000/ for the welcome endpoint
- http://localhost:3000/health for health check
- http://localhost:3000/lessons for the lessons list
- http://localhost:3000/lessons/lesson-1 for a single lesson

## Run tests

```bash
npm test -- --runInBand
```
