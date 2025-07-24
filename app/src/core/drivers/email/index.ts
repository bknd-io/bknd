export interface IEmailDriver<Data = unknown, Options = object> {
   send(
      to: string,
      subject: string,
      body: string | { text: string; html: string },
      options?: Options,
   ): Promise<Data>;
}

import type { BkndConfig } from "bknd";
import { resendEmail, memoryCache } from "bknd/core";

export default {
   onBuilt: async (app) => {
      app.server.get("/send-email", async (c) => {
         if (await app.drivers?.email?.send("test@test.com", "Test", "Test")) {
            return c.text("success");
         }
         return c.text("failed");
      });
   },
   options: {
      drivers: {
         email: resendEmail({ apiKey: "..." }),
         cache: memoryCache(),
      },
   },
} as const satisfies BkndConfig;
