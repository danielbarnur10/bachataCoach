# Bachata Coach

The project is split into two independent applications:

- `backend/` — NestJS API, TypeORM, authentication, video uploads, reviews, and learning libraries.
- `frontend/` — React + TypeScript + Tailwind UI.

## Run locally

Terminal 1:

```bash
cd backend
npm install
npm run start:dev
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The frontend calls `http://localhost:3000` by default. Set `VITE_API_URL` in `frontend/.env` when the API runs elsewhere.

For production, build each project independently with `npm run build`.
