# Contributing to bknd

Thank you for your interest in contributing to bknd. This guide will help you get started, understand the codebase, and submit contributions that align with the project's direction.

## Table of Contents

- [Before You Start](#before-you-start)
- [Important Resources](#important-resources)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Understanding the Codebase](#understanding-the-codebase)
- [Running Tests](#running-tests)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)
- [AI-Generated Code](#ai-generated-code)
- [Contributing to Documentation](#contributing-to-documentation)
- [Reporting Bugs](#reporting-bugs)
- [Getting Help](#getting-help)
- [Contributors](#contributors)
- [Maintainers](#maintainers)

## Before You Start

**Open a GitHub Issue before writing code.** This is the preferred way to propose any change. It lets maintainers and the community align on the approach before time is spent on implementation. If you have discussed a contribution in the [Discord server](https://discord.com/invite/952SFk8Tb8) instead, include a link to the relevant Discord thread in your pull request. Pull requests submitted without a corresponding issue or Discord discussion may be closed.

**Unsolicited architectural changes will be closed.** The internal architecture of bknd is intentional. Refactors, restructuring, or changes to core patterns must be discussed and approved before any code is written.

Contributions that are generally welcome (after opening an issue):

- Bug fixes
- New adapters, strategies, or storage backends
- Documentation improvements
- New examples
- Test coverage improvements

**A note on versioning**: bknd is pre-1.0 and under active development. Full backward compatibility is not guaranteed before v1.0.0. Contributors should be aware that APIs and internal interfaces may change between releases.

## Important Resources

- **Documentation**: https://docs.bknd.io
- **Issue Tracker**: https://github.com/bknd-io/bknd/issues
- **Discord**: https://discord.com/invite/952SFk8Tb8
- **FAQ / Search**: https://www.answeroverflow.com/c/1308395750564302952

## Development Setup

### Prerequisites

- Node.js 22.13 or higher
- Bun 1.3.3

### Getting Started

1. Fork the repository and clone your fork.

2. Install dependencies from the repo root:

   ```bash
   bun install
   ```

3. Navigate to the main app package:

   ```bash
   cd app
   ```

4. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

   The default `.env.example` includes a file-based SQLite database (`file:.db/dev.db`). You can change `VITE_DB_URL` to `:memory:` for an in-memory database instead.

5. Start the dev server:

   ```bash
   bun run dev
   ```

   The dev server runs on `http://localhost:28623` using Vite with Hono.

## Project Structure

This is a Bun monorepo using workspaces. The vast majority of the code lives in `app/`.

```
bknd/
  app/                    # Main "bknd" npm package (this is where most work happens)
    src/
      adapter/            # Runtime/framework adapters (node, bun, cloudflare, nextjs, astro, etc.)
      auth/               # Authentication module (strategies, sessions, user pool)
      cli/                # CLI commands
      core/               # Shared utilities, event system, drivers, server helpers
      data/               # Data module (entities, fields, relations, queries, schema)
      flows/              # Workflow engine and tasks
      media/              # Media module (storage adapters, uploads)
      modes/              # Configuration modes (code, hybrid, db)
      modules/            # Module system, MCP server, permissions framework
      plugins/            # Built-in plugins (auth, data, cloudflare, dev)
      ui/                 # All frontend code
        client/           # TypeScript SDK and React hooks (exported as bknd/client)
        elements/         # React components for auth/media (exported as bknd/elements)
        (everything else) # Admin UI (exported as bknd/ui)
      App.ts              # Central application orchestrator
      index.ts            # Main package exports
    __test__/             # Unit tests (mirrors src/ structure)
    e2e/                  # End-to-end tests (Playwright)
    build.ts              # Build script (tsup/esbuild)
    build.cli.ts          # CLI build script
  packages/               # Small satellite packages
    cli/                  # Standalone CLI package (bknd-cli)
    plasmic/              # Plasmic integration
    postgres/             # Postgres helper
    sqlocal/              # SQLocal helper
  docs/                   # Documentation site (Next.js + Fumadocs, deployed to docs.bknd.io)
  examples/               # Example projects across runtimes and frameworks
  docker/                 # Docker configuration
```

## Understanding the Codebase

### Path Aliases

The project uses TypeScript path aliases defined in `app/tsconfig.json`. Imports like `core/utils`, `data/connection`, or `auth/authenticate` resolve to directories under `app/src/`. When reading source code, keep this in mind -- an import like `import { Connection } from "data/connection"` refers to `app/src/data/connection`, not an external package.

### Module System

bknd is built around four core modules, each with its own schema, API routes, and permissions:

- **Data** -- entity definitions, field types, relations, queries (backed by Kysely)
- **Auth** -- authentication strategies, sessions, user management
- **Media** -- file storage with pluggable adapters (S3, Cloudinary, local filesystem, etc.)
- **Flows** -- workflow automation and task execution

These modules are managed by the `ModuleManager` (in `app/src/modules/`), which handles configuration, building, and lifecycle.

### Adapter Pattern

Adapters in `app/src/adapter/` allow bknd to run on different runtimes and frameworks. Each adapter provides the glue between bknd's Hono-based server and a specific environment (Node, Bun, Cloudflare Workers, Next.js, Astro, etc.).

### Plugin System

Plugins (in `app/src/plugins/`) hook into the app lifecycle via callbacks like `beforeBuild`, `onBuilt`, `onServerInit`, and `schema`. They can add entities, register routes, and extend behavior.

### Build System

The build is handled by a custom `app/build.ts` script using tsup (esbuild under the hood). It builds four targets in parallel:

- **API** -- the core backend
- **UI** -- the admin interface
- **Elements** -- standalone React components
- **Adapters** -- all runtime/framework adapters

## Running Tests

All test commands run from the `app/` directory.

| Command | Runner | What it runs |
|---|---|---|
| `bun run test` | Bun test | Unit tests (`*.spec.ts` files) |
| `bun run test:node` | Vitest | Node-specific tests (`*.vi-test.ts`, `*.vitest.ts`) |
| `bun run test:e2e` | Playwright | End-to-end tests (`*.e2e-spec.ts` in `e2e/`) |
| `bun run types` | TypeScript | Type checking (no emit) |

CI runs both Bun and Node tests, with a Postgres 17 service for database integration tests.

## Code Style

The project uses **Biome** for formatting and linting.

- 3-space indentation for JavaScript/TypeScript
- 100-character line width
- Spaces (not tabs)

To format and lint, run from the repo root:

```bash
bunx biome format --write ./app
bunx biome lint --changed --write ./app
```

Run both before submitting a PR. CI will catch style issues, but it is better to fix them locally first.

## Submitting Changes

1. Open a GitHub Issue describing your proposed change, or link to a Discord thread where it was discussed. Wait for feedback before writing code.
2. Fork the repo and create a branch from `main`.
3. Keep changes focused and minimal. One PR per issue.
4. Add or update tests if applicable.
5. Run the test suite and linter before pushing.
6. Open a pull request against `main`. Reference the issue number in the PR description.

Expect a response from maintainers, but be patient -- this is an actively developed project and review may take some time.

## AI-Generated Code

If you use AI tools to write or assist with your code, you must:

- **Fully review all AI-generated code yourself** before submitting. You are responsible for understanding and standing behind every line in your PR.
- **Include the prompts used** in the PR description. This gives maintainers additional context for reviewing the code.

Pull requests with unreviewed AI-generated code will be closed.

## Contributing to Documentation

The documentation site lives in the `docs/` directory and is a **separate Next.js application** built with [Fumadocs](https://fumadocs.dev). It uses **npm** (not Bun) as its package manager.

### Docs Setup

```bash
cd docs
npm install
npm run dev
```

The docs dev server runs on `http://localhost:3000`.

### Where Documentation Lives

Documentation content is written in MDX and located in `docs/content/docs/`. The directory is organized into:

- `(documentation)/` -- core documentation pages
- `guide/` -- guides and tutorials
- `api-reference/` -- API reference (partially auto-generated from OpenAPI)

To add or edit a page, create or modify an `.mdx` file in the appropriate directory. Page metadata is defined via frontmatter at the top of each file. Navigation order is controlled by `meta.json` files in each directory.

### Building the Docs

```bash
npm run build
```

This generates the OpenAPI and MCP reference pages before building the Next.js site. Make sure the build succeeds locally before submitting a docs PR.

## Reporting Bugs

Open a GitHub Issue with:

- A clear title describing the problem.
- Steps to reproduce the bug.
- Expected behavior vs. actual behavior.
- Your environment (runtime, database, adapter, bknd version).
- Any relevant error messages or logs.

## Getting Help

- **Discord**: https://discord.com/invite/952SFk8Tb8
- **FAQ / Search**: https://www.answeroverflow.com/c/1308395750564302952
- **GitHub Issues**: https://github.com/bknd-io/bknd/issues

## Contributors

Thank you to everyone who has contributed to bknd.

<a href="https://github.com/bknd-io/bknd/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=bknd-io/bknd" />
</a>

Made with [contrib.rocks](https://contrib.rocks).

## Maintainers

- **Dennis** ([@dswbx](https://github.com/dswbx)) -- Creator and maintainer of bknd
- **Cameron Pak** ([@cameronapak](https://github.com/cameronapak)) -- Maintainer of bknd docs
