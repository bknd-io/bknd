# Contributing to bknd

Hi there! 👋
Thanks for your interest in contributing to **bknd** — a lightweight, framework-agnostic backend platform built on Web Standards.

Whether it's a bug fix, new feature, or idea — you're welcome. This guide helps you get started quickly and understand the project's structure and philosophy.

---

## 🚀 Getting Started

```bash
bun install
cd app
bun run build:ci   # required for proper alias resolution
bun run dev         # start dev server
```

You can configure the environment via: `app/src/.env.example`.

---

## 📁 Directory Structure

- `app/` – Main backend app
- `docs/` – Documentation sources
- `examples/` – Integrations with frameworks (Next, Plasmic, etc.)
- `docker/` – Deployment setup
- `packages/` – External adapters (e.g. Postgres)
- `app/src/*` – Source modules:
  - `adapter/` – runtime-specific code (Node, Cloudflare, Next.js, etc.)
  - `auth/`, `core/`, `data/`, `flows/`, `media/`, `modules/` – core systems
  - `cli/` – command-line tools (e.g. type generation, quick starters)
  - `ui/` – Admin UI (React)

---

## 🧪 Tests

There are multiple test strategies used depending on environment:

| Type        | Match                     | Command               |
|-------------|---------------------------|------------------------|
| **Unit**    | `*.spec.ts`, `*.test.ts`  | `bun run test`        |
| **Node**    | `*.native-spec.ts`        | `bun run test:node`   |
| **E2E**     | `e2e/**/*.e2e-spec.ts`     | `bun run test:e2e`    |

> ℹ️ `vitest` is set up but not actively used yet.

---

## 📦 Imports & Aliases

The project uses **aliased imports** for better DX and refactorability:

```ts
import { App } from "bknd/App"
import { StorageLocalAdapter } from "bknd/adapter/node"
```

These are resolved through `tsconfig.json` and require a CI build step (`build:ci`) before starting the dev server. This avoids monorepo complexity.

---

## 📐 Philosophy & Contribution Rules

- ✅ **Runtime-first**: Features must work in [Cloudflare Workers](https://developers.cloudflare.com/workers/) and similar limited environments.
- ✅ **DB Compatibility**: Use SQLite as baseline. Features should also work with Postgres and (eventually) MySQL.
- ✅ **Application-first logic**: Validate fields (nullable, length, etc.) in app code, not in database.
- ✅ **Minimal dependencies**: Avoid adding third-party packages unless necessary.
- ✅ **Adapters are isolated**: They should not leak into the main application logic.

---

## 💬 Need Help?

Feel free to open an issue or reach out if you’re unsure where to begin. If you’re working on something significant (e.g. a new adapter, strategy, or system), please open a draft PR early so we can align on design.

---

Thanks for contributing 🙌
— The bknd team

