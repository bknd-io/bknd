# bknd + Tanstack Start Example

This is a minimal example to shows how to integrate bknd with Tanstack Start.

## Setup

```bash
bun install
bun run dev
```

## How it works

1. **`bknd.config.ts`** - bknd configuration with database connection, schema, and seed data
2. **`src/routes/api.$.ts`** - Handles `/api/*` requests for bknd
3. **`src/routes/index.tsx`** - Using `getApp()` to fetch data in loader
3. **`src/routes/ssr.tsx`** - Server Side example with `getApp()` to fetch data on server

## API Endpoints

- `GET /admin` - for Admin Dashboard
- `GET /api/data/entity/todos` - List todos (requires auth)
- `POST /api/auth/password/login` - Login

## Test Credentials

- Email: `test@bknd.io`
- Password: `12345678`
