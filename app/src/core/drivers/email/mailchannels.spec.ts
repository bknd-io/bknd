import { describe, it, expect } from "bun:test";
import { mailchannelsEmail } from "./mailchannels";

const ALL_TESTS = !!process.env.ALL_TESTS;

describe.skipIf(ALL_TESTS)("mailchannels", () => {
   it("should throw on failed", async () => {
      const driver = mailchannelsEmail({ apiKey: "invalid" } as any);
      expect(driver.send("foo@bar.com", "Test", "Test")).rejects.toThrow();
   });

   it("should send an email", async () => {
      const driver = mailchannelsEmail({
         apiKey: process.env.MAILCHANNELS_API_KEY!,
         from: { email: "accounts@bknd.io", name: "Dennis Senn" },
      });
      const response = await driver.send("ds@bknd.io", "Test", "Test");
      expect(response).toBeDefined();
   });
});
