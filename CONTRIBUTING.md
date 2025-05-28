# Contributing to bknd

Thanks for your interest in contributing to `bknd`.

This project is under active development, and contributions are welcome. To ensure consistent quality and prevent unnecessary work, we ask contributors to follow the guidelines below.

---

## Getting Started

```bash
bun install
cd app
bun run build:ci    # builds packages for alias resolution
bun run dev         # start dev server
```

For environment setup, see: `app/src/.env.example`.

---

## Directory Structure

- `app/` – Main backend app
- `docs/` – Documentation sources
- `examples/` – Integrations with frameworks (Next, Plasmic, etc.)
- `docker/` – Deployment setup
- `packages/` – External adapters (e.g. Postgres)

`app/src/` contains all core modules:
- `adapter/` – runtime-specific code (Node, Cloudflare, etc.)
- `auth/`, `core/`, `data/`, `flows/`, `media/`, `modules/` – system modules
- `cli/` – command-line tools (typegen, quick starters)
- `ui/` – Admin UI components (React)

---

## Imports & Aliases

Aliased absolute imports are used throughout the codebase to improve DX and reduce coupling:

```ts
import { App } from "bknd/App";
import { StorageLocalAdapter } from "bknd/adapter/node";
```

These are resolved through `tsconfig.json` and require `bun run build:ci` before starting development.

---

## Testing

Multiple test runners are used:

| Type        | Match                     | Command               |
|-------------|---------------------------|------------------------|
| Unit        | `*.spec.ts`, `*.test.ts`  | `bun run test`        |
| Node-only   | `*.native-spec.ts`        | `bun run test:node`   |
| E2E         | `e2e/**/*.e2e-spec.ts`     | `bun run test:e2e`    |


---

## Contribution Guidelines

1. **Start with an Issue**
   Open an Issue to describe what you’re planning to contribute. This avoids wasted work and helps align expectations.

2. **General-purpose only**
   Only general-purpose functionality will be merged. Everything else (e.g. feature-specific logic) should be designed as pluggable/injectable.

3. **Tests Required**
   Include relevant unit/e2e tests with your PR.

4. **Minimize dependencies**
   Avoid adding new packages unless absolutely necessary.

5. **Runtime and DB Compatibility**
   - Must run on limited environments (Cloudflare Workers, etc.)
   - Should work with SQLite, Postgres, and (eventually) MySQL
   - Prefer logic at the application layer over DB constraints

6. **Pluggability**
   If adding new functionality (e.g. auth strategies, media adapters), use registries similar to:

```ts
export const MediaAdapterRegistry = new Registry<...>()
  .register("s3", StorageS3Adapter)
  .register("cloudinary", StorageCloudinaryAdapter);
```

---

## Help or Questions?

Open an issue or a draft PR to start a discussion. Contributions of all sizes are welcome, but please follow the process above.

Thanks for contributing.

