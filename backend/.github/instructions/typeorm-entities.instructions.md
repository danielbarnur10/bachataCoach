---
name: "TypeORM Entity Portability"
description: "Use when adding or changing TypeORM entities, columns, relations, JSON fields, defaults, or database configuration for sqljs and PostgreSQL."
applyTo: "src/database/entities/**/*.ts"
---
# TypeORM Entity Portability

- Keep entities compatible with both `DATABASE_TYPE=sqljs` and `DATABASE_TYPE=postgres`; validate the touched schema against each driver when practical.
- Give nullable union properties explicit column metadata. TypeScript decorator reflection can otherwise report them as `Object` and TypeORM will reject the schema.
- For portable structured values, follow the existing `simple-json` pattern with SQL constant string defaults such as `default: '{}'` or `default: '[]'`.
- Do not use `jsonb`, object/array defaults (`default: {}` or `default: []`), or `simple-array` with an empty-array default; sqljs either rejects these or generates invalid `DEFAULT ()` SQL.
- Date column types differ between the drivers. Verify both drivers before adding an explicit `timestamp` or `datetime` type.
- Export new entities from `src/database/entities/index.ts` and register them in the entity list and relevant `TypeOrmModule.forFeature` call in `src/app.module.ts`.
- After a schema edit, run `npm run build`, the related test, and start the app once with sqljs to force schema initialization.