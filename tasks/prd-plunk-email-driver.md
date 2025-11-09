# Product Requirements Document: Plunk Email Driver

## Introduction/Overview

This document outlines the requirements for implementing a new email driver for Plunk (https://useplunk.com) within the bknd framework. Plunk is an open-source email platform that provides a simple API for sending transactional emails. This driver will integrate Plunk's email service into bknd's existing driver ecosystem, allowing developers to send emails through Plunk using the same interface as other email providers (Resend, AWS SES, Mailchannels).

**Problem Statement:** bknd currently lacks support for Plunk as an email provider. Plunk offers a straightforward API and open-source platform that may be preferable for certain use cases.

**Goal:** Create a Plunk email driver that seamlessly integrates with bknd's existing `IEmailDriver` interface while supporting Plunk's specific features and limitations.

## Goals

1. Implement a fully functional Plunk email driver that adheres to bknd's `IEmailDriver` interface
2. Support single and multiple recipients (up to Plunk's 5-recipient limit)
3. Support common email features: custom sender (from), reply-to, sender name, and custom headers
4. Provide clear error handling and meaningful error messages
5. Include comprehensive unit tests following existing driver test patterns
6. Maintain consistency with existing email driver implementations (Resend, SES, Mailchannels)

## User Stories

1. **As a developer**, I want to configure Plunk as my email provider by passing my API key and optional configuration, so I can send emails through Plunk in my bknd application.

2. **As a developer**, I want to send emails to single or multiple recipients using the same interface, so I can easily switch between sending individual and bulk emails.

3. **As a developer**, I want to customize the sender name, email, and reply-to address, so I can control how my emails appear to recipients.

4. **As a developer**, I want to send HTML emails with automatic handling, so I don't have to worry about format conversion.

5. **As a developer**, I want clear error messages when email sending fails, so I can debug issues quickly.

## Functional Requirements

### 1. Driver Implementation

**FR-1.1:** The driver MUST be implemented as a factory function named `plunkEmail()` that accepts a configuration object and returns an `IEmailDriver` instance.

**FR-1.2:** The driver MUST implement the `IEmailDriver<PlunkEmailResponse, PlunkEmailSendOptions>` interface.

**FR-1.3:** The factory function MUST be exported from `/home/user/bknd/app/src/core/drivers/email/plunk.ts`.

**FR-1.4:** The driver MUST be re-exported from `/home/user/bknd/app/src/core/drivers/index.ts`.

### 2. Configuration

**FR-2.1:** The driver MUST accept a configuration object with the following type:
```typescript
type PlunkEmailOptions = {
   apiKey: string;          // Required: Plunk API key
   host?: string;           // Optional: API endpoint (default: "https://api.useplunk.com/v1/send")
   from?: string;           // Optional: Default sender email
}
```

**FR-2.2:** If `host` is not provided, the driver MUST default to `"https://api.useplunk.com/v1/send"`.

**FR-2.3:** If `from` is not provided in the config or send options, the driver MUST allow Plunk to use its default (verified email).

### 3. Send Method

**FR-3.1:** The `send()` method MUST accept the following parameters:
- `to: string` - Recipient email address (required)
- `subject: string` - Email subject (required)
- `body: string | { text: string; html: string }` - Email body (required)
- `options?: PlunkEmailSendOptions` - Additional send options (optional)

**FR-3.2:** When `body` is a string, it MUST be sent as-is to Plunk's `body` field.

**FR-3.3:** When `body` is an object with `{ text, html }`, the driver MUST send the `html` value to Plunk's `body` field (Plunk only supports a single body field).

**FR-3.4:** The method MUST return a `Promise<PlunkEmailResponse>`.

### 4. Send Options

**FR-4.1:** The driver MUST support the following send options:
```typescript
type PlunkEmailSendOptions = {
   to?: string | string[];       // Additional recipient(s) - overrides/extends main to parameter
   subscribed?: boolean;          // Add contact to audience (default: false)
   name?: string;                 // Override sender name
   from?: string;                 // Override sender email
   reply?: string;                // Reply-to address
   headers?: Record<string, string>; // Custom email headers
}
```

**FR-4.2:** If `options.to` is provided, it MUST override the main `to` parameter when constructing the API request.

**FR-4.3:** If `options.to` is a string, it MUST be converted to a single-element array for the API request.

**FR-4.4:** If `options.to` is an array, it MUST be validated to ensure it doesn't exceed 5 recipients (Plunk's limit).

**FR-4.5:** If `options.from` is provided, it MUST override the default `from` from configuration.

### 5. Response Handling

**FR-5.1:** The driver MUST define a response type matching Plunk's API response:
```typescript
type PlunkEmailResponse = {
   success: boolean;
   emails: Array<{
      contact: {
         id: string;
         email: string;
      };
      email: string;  // Email ID
   }>;
   timestamp: string;
}
```

**FR-5.2:** On successful API response (`res.ok === true`), the driver MUST parse and return the JSON response as `PlunkEmailResponse`.

**FR-5.3:** On failed API response (`res.ok === false`), the driver MUST throw an error with the response text.

### 6. HTTP Request

**FR-6.1:** The driver MUST use the `fetch()` API to make HTTP requests.

**FR-6.2:** The request MUST use the POST method.

**FR-6.3:** The request MUST include the following headers:
- `Content-Type: application/json`
- `Authorization: Bearer ${apiKey}`

**FR-6.4:** The request body MUST be a JSON-stringified object containing:
- Required: `to`, `subject`, `body`
- Optional: `subscribed`, `name`, `from`, `reply`, `headers` (when provided in options)

**FR-6.5:** When merging the payload with options, options MUST be spread after the base payload to allow overrides.

### 7. Testing

**FR-7.1:** Unit tests MUST be created in `/home/user/bknd/app/src/core/drivers/email/plunk.spec.ts`.

**FR-7.2:** Tests MUST follow the pattern established in `resend.spec.ts` (using `describe.skipIf(ALL_TESTS)`).

**FR-7.3:** Tests MUST include:
- Test for invalid API key (should throw error)
- Test for successful email send with valid credentials (requires `PLUNK_API_KEY` environment variable)
- Test for HTML email body
- Test for `{ text, html }` body object
- Test for multiple recipients

**FR-7.4:** Tests MUST use Bun's test framework (`bun:test`).

## Non-Goals (Out of Scope)

1. **File Attachments:** The initial implementation will NOT support file attachments. Plunk supports up to 5 attachments, but this will be deferred to a future iteration.

2. **CC/BCC Support:** Plunk's API does not support CC or BCC functionality. This will NOT be implemented.

3. **Template Support:** Plunk may support email templates, but this driver will only support direct body content. Template support is out of scope.

4. **Delayed/Scheduled Sending:** While Plunk may support scheduled emails, this is out of scope for the initial implementation.

5. **Email Tracking/Analytics:** Any tracking or analytics features are out of scope.

6. **Batch Sending:** While Plunk supports up to 5 recipients per call, this driver will not implement special batch optimization logic.

## Design Considerations

### File Structure
```
/home/user/bknd/app/src/core/drivers/email/
├── plunk.ts              # Main driver implementation
├── plunk.spec.ts         # Unit tests
└── index.ts              # Updated to export types (if needed)
```

### Code Pattern
The implementation should closely follow the pattern established in `resend.ts`:
- Factory function returning an object with `send()` method
- Configuration stored in closure
- Use of `fetch()` for HTTP requests
- Error handling via `res.ok` check and thrown errors
- Proper TypeScript typing throughout

### Integration
The driver must be exported from `/home/user/bknd/app/src/core/drivers/index.ts`:
```typescript
export { plunkEmail } from "./email/plunk";
```

## Technical Considerations

### Dependencies
- No additional npm packages required (uses built-in `fetch()`)
- Uses existing `IEmailDriver` interface

### API Endpoint
- Base URL: `https://api.useplunk.com/v1/send`
- Method: POST
- Authentication: Bearer token in Authorization header

### Recipient Limit
Plunk enforces a maximum of 5 recipients per API call. The driver should validate this:
```typescript
const recipients = Array.isArray(options?.to) ? options.to :
                   options?.to ? [options.to] : [to];
if (recipients.length > 5) {
   throw new Error("Plunk supports a maximum of 5 recipients per email");
}
```

### Body Field Handling
Since Plunk only accepts a single `body` field (not separate text/html):
- When `body` is a string → send as-is
- When `body` is `{ text, html }` → send `html` value (HTML emails degrade gracefully in most clients)

### Error Messages
Follow the pattern from other drivers:
```typescript
if (!res.ok) {
   throw new Error(`Plunk API error: ${await res.text()}`);
}
```

## Success Metrics

1. **Implementation Completeness:** All functional requirements are met and tested
2. **Test Coverage:** All critical paths have unit test coverage
3. **API Compatibility:** Successfully sends emails through Plunk API with 100% success rate in tests
4. **Code Quality:** Passes existing linting and formatting standards
5. **Documentation:** Code is well-commented and follows existing patterns

## Open Questions

1. **Environment Variable:** Should we follow the same pattern as Resend and expect `PLUNK_API_KEY` in environment variables for testing?
   - **Answer:** Yes, follow existing pattern

2. **Error Response Format:** What is the exact structure of Plunk's error responses? Should we parse JSON errors or use raw text?
   - **Action:** Test with invalid API key to determine error format

3. **Name Field Priority:** When both `config.from` and `options.name` are provided, which should take precedence for the sender name?
   - **Answer:** `options.name` should override (same pattern as other drivers)

4. **Multiple Recipients in Main Parameter:** Should we support passing an array to the main `to` parameter via the interface, or strictly enforce single string?
   - **Answer:** The interface signature is `to: string`, so arrays must go through `options.to`

5. **Headers Validation:** Does Plunk have restrictions on custom headers? Should we validate or just pass through?
   - **Answer:** Pass through - let Plunk API handle validation

---

**Document Version:** 1.0
**Created:** 2025-11-09
**Target Audience:** Junior to mid-level developers
**Estimated Implementation Time:** 2-4 hours
