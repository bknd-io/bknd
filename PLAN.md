# Proactive Error Handling with errore in `run.ts`

Ref: https://errore.org/

## Goal

Replace scattered `process.exit()`, untyped `catch (e: any)`, and inline error handling in `run.ts` with errore's error-as-values pattern. Compile-time exhaustive error handling via `matchError` in a single top-level `action()`.

## Constraints

- `makeAppFromEnv` and `makeConfigApp` are exported — **do not change their return types**
- `platform.ts` (`startServer`, `serveStatic`, `getConfigPath`) — **unchanged this PR**
- Keep it simple: errors defined in `run.ts`, not a separate file

## Phase 1: Add errore dependency

- `app/package.json`: add `"errore"` to dependencies
- Run install

## Phase 2: Define tagged errors in `run.ts`

```ts
import errore from "errore"

class ConfigLoadError extends errore.createTaggedError({
  name: "ConfigLoadError",
  message: "Failed to load config: $reason",
}) {}

class NeedsBunError extends errore.createTaggedError({
  name: "NeedsBunError",
  message: "Config requires Bun runtime",
}) {}

class NeedsTypeStrippingError extends errore.createTaggedError({
  name: "NeedsTypeStrippingError",
  message: "Node $version needs --experimental-strip-types for .ts config",
}) {}

class ReexecFailedError extends errore.createTaggedError({
  name: "ReexecFailedError",
  message: "Re-exec failed: $reason",
}) {}
```

## Phase 3: Refactor internal functions to return errors

### `loadConfigFile` → `ConfigLoadError | NeedsBunError | NeedsTypeStrippingError | CliBkndConfig`
- Use `errore.tryAsync` to wrap `import()`
- On catch: detect Bun requirement → `NeedsBunError`
- On catch: other failure → `ConfigLoadError`
- Before import: check `needsTypeStripping()` → `NeedsTypeStrippingError`

### `reexecWithTypeStripping` / `reexecUnderBun` → `ReexecFailedError | never`
- Success: `process.exit(0)` (unavoidable — must stop parent after child completes)
- Failure: return `ReexecFailedError` instead of `process.exit(1)`
- Caller decides how to handle failure

### `makeAppFromEnv` internal flow (return type unchanged)
- Internally use error-as-values from `loadConfigFile`
- On `NeedsBunError` / `NeedsTypeStrippingError`: call re-exec, handle `ReexecFailedError`
- On `ConfigLoadError`: `console.error` + `process.exit(1)`
- Keep exported signature: `Promise<App>` (exits on unrecoverable errors)

### `action()` — cleaner top-level
- `makeAppFromEnv` handles its own error cases internally (since we can't change its return type)
- `action()` stays thin: call `makeAppFromEnv` → `startServer`

## Phase 4: Verify

- No behavior change for end users
- All `catch (e: any)` replaced with typed errore patterns
- `process.exit(1)` consolidated to fewer, explicit locations
- Re-exec failure paths return typed errors before exiting

## Files Changed

| File | Change |
|---|---|
| `app/package.json` | add `errore` dep |
| `app/src/cli/commands/run/run.ts` | tagged errors, refactored error flow |

## Commit Message
```
refactor(cli): use errore for typed error handling in run command

Replace untyped catch blocks and scattered process.exit() with
errore tagged errors and error-as-values pattern. Compile-time
safety for error handling paths.
```
