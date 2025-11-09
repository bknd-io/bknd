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

- [ ] 0.0 Create feature branch
- [ ] 1.0 Implement Plunk email driver
- [ ] 2.0 Create unit tests for Plunk driver
- [ ] 3.0 Update driver exports
- [ ] 4.0 Verify implementation and run tests
- [ ] 5.0 Commit and push changes
