# bknd starter: Cloudflare Vite Code-Only
A fullstack React + Vite application with bknd integration, showcasing **code-only mode** and Cloudflare Workers deployment.

## Key Features

This example demonstrates a minimal, code-first approach to building with bknd:

### 💻 Code-Only Mode
Define your entire backend **programmatically** using a Drizzle-like API. Your data structure, authentication, and configuration live directly in code with zero build-time tooling required. Perfect for developers who prefer traditional code-first workflows.

### 🎯 Minimal Boilerplate
Unlike the hybrid mode template, this example uses **no automatic type generation**, **no filesystem plugins**, and **no auto-synced configuration files**. This simulates a typical development environment where you manage types generation manually. If you prefer automatic type generation, you can easily add it using the [CLI](https://docs.bknd.io/usage/cli#generating-types-types) or [Vite plugin](https://docs.bknd.io/extending/plugins#synctypes).

### ⚡ Split Configuration Pattern
- **`config.ts`**: Main configuration that defines your schema and can be safely imported in your worker
- **`bknd.config.ts`**: Wraps the configuration with `withPlatformProxy` for CLI usage with Cloudflare bindings (should NOT be imported in your worker)

This pattern prevents bundling `wrangler` into your worker while still allowing CLI access to Cloudflare resources.

## Project Structure

Inside of your project, you'll see the following folders and files:

```text
/
├── src/
│   ├── app/              # React frontend application
│   │   ├── App.tsx
│   │   ├── routes/
│   │   │   ├── admin.tsx # bknd Admin UI route
│   │   │   └── home.tsx  # Example frontend route
│   │   └── main.tsx
│   └── worker/
│       └── index.ts      # Cloudflare Worker entry
├── config.ts             # bknd configuration with schema definition
├── bknd.config.ts        # CLI configuration with platform proxy
├── seed.ts               # Optional: seed data for development
├── vite.config.ts        # Standard Vite config (no bknd plugins)
├── package.json
└── wrangler.json         # Cloudflare Workers configuration
```

## Cloudflare Resources

- **D1:** `wrangler.json` declares a `DB` binding. In production, replace `database_id` with your own (`wrangler d1 create <name>`).
- **R2:** Optional `BUCKET` binding is pre-configured to show how to add additional services.
- **Environment awareness:** `ENVIRONMENT` variable determines whether to sync the database schema automatically (development only).
- **Static assets:** The Assets binding points to `dist/client`. Run `npm run build` before `wrangler deploy` to upload the client bundle alongside the worker.

## Admin UI & Frontend

- `/admin` mounts `<Admin />` from `bknd/ui` with `withProvider={{ user }}` so it respects the authenticated user returned by `useAuth`.
- `/` showcases `useEntityQuery("todos")`, mutation helpers, and authentication state — demonstrating how manually declared types flow into the React code.


## Configuration Files

### `config.ts`
The main configuration file that uses the `code()` mode helper:

```typescript
import type { CloudflareBkndConfig } from "bknd/adapter/cloudflare";
import { code } from "bknd/modes";
import { boolean, em, entity, text } from "bknd";

// define your schema using a Drizzle-like API
const schema = em({
   todos: entity("todos", {
      title: text(),
      done: boolean(),
   }),
});

// register your schema for type completion (optional)
// alternatively, you can use the CLI to auto-generate types
type Database = (typeof schema)["DB"];
declare module "bknd" {
   interface DB extends Database {}
}

export default code<CloudflareBkndConfig>({
   app: (env) => ({
      config: {
         // convert schema to JSON format
         data: schema.toJSON(),
         auth: {
            enabled: true,
            jwt: {
               // secrets are directly passed to the config
               secret: env.JWT_SECRET,
               issuer: "cloudflare-vite-code-example",
            },
         },
      },
      // disable the built-in admin controller (we render our own app)
      adminOptions: false,
      // determines whether the database should be automatically synced
      isProduction: env.ENVIRONMENT === "production",
   }),
});
```

Key differences from hybrid mode:
- **No auto-generated files**: No `bknd-config.json`, `bknd-types.d.ts`, or `.env.example`
- **Manual type declaration**: Types are declared inline using `declare module "bknd"`
- **Direct secret access**: Secrets come directly from `env` parameters
- **Simpler setup**: No filesystem plugins or readers/writers needed

If you prefer automatic type generation, you can add it later using:
- **CLI**: `npm run bknd -- types` (requires adding `typesFilePath` to config)
- **Plugin**: Import `syncTypes` plugin and configure it in your app

### `bknd.config.ts`
Wraps the configuration for CLI usage with Cloudflare bindings:

```typescript
import { withPlatformProxy } from "bknd/adapter/cloudflare/proxy";
import config from "./config.ts";

export default withPlatformProxy(config, {
   useProxy: true,
});
```

**Important**: Don't import this file in your worker, as it would bundle `wrangler` into your production code. This file is only used by the bknd CLI.

### `vite.config.ts`
Standard Vite configuration without bknd-specific plugins:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
   plugins: [react(), tailwindcss(), cloudflare()],
});
```

## Commands

All commands are run from the root of the project, from a terminal:

| Command            | Action                                                    |
|:-------------------|:----------------------------------------------------------|
| `npm install`      | Installs dependencies, generates types, and seeds database|
| `npm run dev`      | Starts local dev server with Vite at `localhost:5173`     |
| `npm run build`    | Builds the application for production                     |
| `npm run preview`  | Builds and previews the production build locally          |
| `npm run deploy`   | Builds, syncs the schema and deploys to Cloudflare Workers|
| `npm run bknd`     | Runs bknd CLI commands                                    |
| `npm run bknd:seed`| Seeds the database with example data                      |
| `npm run cf:types` | Generates Cloudflare Worker types from `wrangler.json`    |
| `npm run check`    | Type checks and does a dry-run deployment                 |

## Development Workflow

1. **Install dependencies:**
   ```sh
   npm install
   ```
   This will install dependencies, generate Cloudflare types, and seed the database.

2. **Start development server:**
   ```sh
   npm run dev
   ```

3. **Define your schema in code** (`config.ts`):
   ```typescript
   const schema = em({
      todos: entity("todos", {
         title: text(),
         done: boolean(),
      }),
   });
   ```

4. **Manually declare types** (optional, but recommended for IDE support):
   ```typescript
   type Database = (typeof schema)["DB"];
   declare module "bknd" {
      interface DB extends Database {}
   }
   ```

5. **Use the Admin UI** at `http://localhost:5173/admin` to:
   - View and manage your data
   - Monitor authentication
   - Access database tools
   
   Note: In code mode, you cannot edit the schema through the UI. All schema changes must be done in `config.ts`.

6. **Sync schema changes** to your database:
   ```sh
   # Local development (happens automatically on startup)
   npm run dev
   
   # Production database (safe operations only)
   CLOUDFLARE_ENV=production npm run bknd -- sync --force
   ```

## Before You Deploy

### 1. Create a D1 Database

Create a database in your Cloudflare account:

```sh
npx wrangler d1 create my-database
```

Update `wrangler.json` with your database ID:
```json
{
   "d1_databases": [
      {
         "binding": "DB",
         "database_name": "my-database",
         "database_id": "your-database-id-here"
      }
   ]
}
```

### 2. Set Required Secrets

Set your secrets in Cloudflare Workers:

```sh
# JWT secret (required for authentication)
npx wrangler secret put JWT_SECRET
```

You can generate a secure secret using:
```sh
# Using openssl
openssl rand -base64 64
```

## Deployment

Deploy to Cloudflare Workers:

```sh
npm run deploy
```

This will:
1. Set `ENVIRONMENT=production` to prevent automatic schema syncing
2. Build the Vite application
3. Sync the database schema (safe operations only)
4. Deploy to Cloudflare Workers using Wrangler

In production, bknd will:
- Use the configuration defined in `config.ts`
- Skip config validation for better performance
- Expect secrets to be provided via environment variables

## How Code Mode Works

1. **Define Schema:** Create entities and fields using the Drizzle-like API in `config.ts`
2. **Convert to JSON:** Use `schema.toJSON()` to convert your schema to bknd's configuration format
3. **Manual Types:** Optionally declare types inline for IDE support and type safety
4. **Deploy:** Same configuration runs in both development and production

### Code Mode vs Hybrid Mode

| Feature | Code Mode | Hybrid Mode |
|---------|-----------|-------------|
| Schema Definition | Code-only (`em`, `entity`, `text`) | Visual UI in dev, code in prod |
| Configuration Files | None (all in code) | Auto-generated `bknd-config.json` |
| Type Generation | Manual or opt-in | Automatic |
| Setup Complexity | Minimal | Requires plugins & filesystem access |
| Use Case | Traditional code-first workflows | Rapid prototyping, visual development |

## Type Generation (Optional)

This example intentionally **does not use automatic type generation** to simulate a typical development environment where types are managed manually. This approach:
- Reduces build complexity
- Eliminates dependency on build-time tooling
- Works in any environment without special plugins

However, if you prefer automatic type generation, you can easily add it:

### Option 1: Using the Vite Plugin and `code` helper presets
Add `typesFilePath` to your config:

```typescript
export default code({
   typesFilePath: "./bknd-types.d.ts",
   // ... rest of config
});
```

For Cloudflare Workers, you'll need the `devFsVitePlugin`:
```typescript
// vite.config.ts
import { devFsVitePlugin } from "bknd/adapter/cloudflare";

export default defineConfig({
   plugins: [
      // ...
      devFsVitePlugin({ configFile: "config.ts" })
   ],
});
```

Finally, add the generated types to your `tsconfig.json`:
```json
{
   "compilerOptions": {
      "types": ["./bknd-types.d.ts"]
   }
}
```

This provides filesystem access for auto-syncing types despite Cloudflare's `unenv` restrictions.

### Option 2: Using the CLI

You may also use the CLI to generate types:

```sh
npx bknd types --outfile ./bknd-types.d.ts
```

## Database Seeding

Unlike UI-only and hybrid modes where bknd can automatically detect an empty database (by attempting to fetch the configuration. A "table not found" error indicates a fresh database), **code mode requires manual seeding**. This is because in code mode, the configuration is always provided from code, so bknd can't determine if the database is empty without additional queries, which would impact performance.

This example includes a [`seed.ts`](./seed.ts) file that you can run manually. For Cloudflare, it uses `bknd.config.ts` (with `withPlatformProxy`) to access Cloudflare resources like D1 during CLI execution:

```sh
npm run bknd:seed
```

The seed script manually checks if the database is empty before inserting data. See the [seed.ts](./seed.ts) file for implementation details.

## Want to Learn More?

- [Cloudflare Integration Documentation](https://docs.bknd.io/integration/cloudflare)
- [Code Mode Guide](https://docs.bknd.io/usage/introduction#code-only-mode)
- [Mode Helpers Documentation](https://docs.bknd.io/usage/introduction#mode-helpers)
- [Data Structure & Schema API](https://docs.bknd.io/usage/database#data-structure)
- [Discord Community](https://discord.gg/952SFk8Tb8)

