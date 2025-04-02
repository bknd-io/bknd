import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { makeApp } from "./modes/fresh";
import { makeConfig } from "./config";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";
import type { CloudflareBkndConfig } from "./cloudflare-workers.adapter";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("cf adapter", () => {
   const DB_URL = ":memory:";
   const $ctx = (env?: any, request?: Request, ctx?: ExecutionContext) => ({
      request: request ?? (null as any),
      env: env ?? { DB_URL },
      ctx: ctx ?? (null as any),
   });

   it("makes config", async () => {
      expect(
         makeConfig(
            {
               connection: { url: DB_URL },
            },
            {},
         ),
      ).toEqual({ connection: { url: DB_URL } });

      expect(
         makeConfig(
            {
               app: (env) => ({
                  connection: { url: env.DB_URL },
               }),
            },
            {
               DB_URL,
            },
         ),
      ).toEqual({ connection: { url: DB_URL } });
   });

   adapterTestSuite<CloudflareBkndConfig, object>(bunTestRunner, {
      makeApp,
      makeHandler: (c, a, o) => {
         return async (request: any) => {
            const app = await makeApp(
               // needs a fallback, otherwise tries to launch D1
               c ?? {
                  connection: { url: DB_URL },
               },
               a,
               o,
            );
            return app.fetch(request);
         };
      },
   });
});
