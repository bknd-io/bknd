## Relevant Files

- `/home/user/bknd/app/src/core/drivers/email/plunk.ts` - Main Plunk email driver implementation
- `/home/user/bknd/app/src/core/drivers/email/plunk.spec.ts` - Unit tests for Plunk email driver
- `/home/user/bknd/app/src/core/drivers/email/index.ts` - Email driver interface definition (reference)
- `/home/user/bknd/app/src/core/drivers/index.ts` - Main drivers export file (needs update to export plunkEmail)
- `/home/user/bknd/app/src/core/drivers/email/resend.ts` - Reference implementation to follow same pattern

### Notes

- Follow the same factory pattern used in `resend.ts` for consistency
- Use Bun's test framework (`bun:test`) for unit tests
- Tests require `PLUNK_API_KEY` environment variable for integration tests
- Plunk API endpoint: `https://api.useplunk.com/v1/send`
- Maximum 5 recipients per email (Plunk API limitation)
- Run tests with: `bun test app/src/core/drivers/email/plunk.spec.ts`

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Verify current branch (already on `claude/add-loops-email-driver-011CUxMpVqe8AT22gN2k5ZVm`)

- [x] 1.0 Implement Plunk email driver
  - [x] 1.1 Read `resend.ts` file to understand the factory pattern and implementation structure
  - [x] 1.2 Create `/home/user/bknd/app/src/core/drivers/email/plunk.ts` file
  - [x] 1.3 Define `PlunkEmailOptions` type with `apiKey`, `host?`, and `from?` fields
  - [x] 1.4 Define `PlunkEmailSendOptions` type with `to?`, `subscribed?`, `name?`, `from?`, `reply?`, and `headers?` fields
  - [x] 1.5 Define `PlunkEmailResponse` type matching Plunk's API response structure (`success`, `emails`, `timestamp`)
  - [x] 1.6 Implement `plunkEmail()` factory function that accepts config and returns `IEmailDriver` instance
  - [x] 1.7 Implement `send()` method with proper body handling (string vs `{ text, html }` object)
  - [x] 1.8 Add recipient validation to ensure max 5 recipients when `options.to` is an array
  - [x] 1.9 Add HTTP request implementation using `fetch()` with proper headers (Authorization, Content-Type)
  - [x] 1.10 Add error handling for failed API responses (check `res.ok` and throw with error text)
  - [x] 1.11 Implement proper payload construction with `to`, `subject`, `body`, and optional fields

- [x] 2.0 Create unit tests for Plunk driver
  - [x] 2.1 Read `resend.spec.ts` to understand test pattern and structure
  - [x] 2.2 Create `/home/user/bknd/app/src/core/drivers/email/plunk.spec.ts` file
  - [x] 2.3 Set up test structure with `describe.skipIf(ALL_TESTS)` wrapper
  - [x] 2.4 Write test: "should throw on failed" - test with invalid API key expecting error
  - [x] 2.5 Write test: "should send an email" - test successful email send (requires `PLUNK_API_KEY` env var)
  - [x] 2.6 Write test: "should send HTML email" - test with HTML string body
  - [x] 2.7 Write test: "should send with text and html" - test with `{ text, html }` body object
  - [x] 2.8 Write test: "should send to multiple recipients" - test with array of recipients in options

- [x] 3.0 Update driver exports
  - [x] 3.1 Read current `/home/user/bknd/app/src/core/drivers/index.ts` file
  - [x] 3.2 Add `export { plunkEmail } from "./email/plunk";` to `/home/user/bknd/app/src/core/drivers/index.ts`

- [x] 4.0 Verify implementation and run tests
  - [x] 4.1 Run Plunk driver tests with `bun test app/src/core/drivers/email/plunk.spec.ts`
  - [x] 4.2 Verify all tests pass (or only skip if `ALL_TESTS` is true and no `PLUNK_API_KEY`)
  - [x] 4.3 Review code for consistency with existing drivers (resend.ts pattern)
  - [x] 4.4 Verify TypeScript types are correctly defined and exported

- [x] 5.0 Commit and push changes
  - [x] 5.1 Stage all changed files (`plunk.ts`, `plunk.spec.ts`, `index.ts`)
  - [x] 5.2 Review git diff to ensure changes are correct
  - [x] 5.3 Create descriptive commit message following repository convention
  - [x] 5.4 Commit changes with proper message
  - [x] 5.5 Push to remote branch `claude/add-loops-email-driver-011CUxMpVqe8AT22gN2k5ZVm`
