import { describe, it, expect } from "bun:test";
import { resendEmail } from "./resend";

const ALL_TESTS = !!process.env.ALL_TESTS;

describe.skipIf(ALL_TESTS)("resend", () => {
   it.only("should throw on failed", async () => {
      const driver = resendEmail({ apiKey: "invalid" } as any);
      expect(driver.send("foo@bar.com", "Test", "Test")).rejects.toThrow();
   });

   it("should send an email", async () => {
      const driver = resendEmail({
         apiKey: process.env.RESEND_API_KEY!,
         from: "BKND <help@bknd.io>",
      });
      const response = await driver.send("help@bknd.io", "Test", "Test");
      expect(response).toBeDefined();
      expect(response.id).toBeDefined();
   });
});
