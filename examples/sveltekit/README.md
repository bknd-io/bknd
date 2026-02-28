# bknd + SvelteKit Example

This example shows how to integrate bknd with SvelteKit.

## Setup

```bash
bun install
bun run dev
```

## How it works

1. **`bknd.config.ts`** - bknd configuration with database connection, schema, and seed data
2. **`src/hooks.server.ts`** - Routes `/api/*` requests to bknd
3. **`src/routes/+page.server.ts`** - Uses `getApp()` to fetch data server-side

## API Endpoints

- `GET /api/data/entity/todos` - List todos (requires auth)
- `POST /api/auth/password/login` - Login

## Test Credentials

- Email: `admin@example.com`
- Password: `password`
