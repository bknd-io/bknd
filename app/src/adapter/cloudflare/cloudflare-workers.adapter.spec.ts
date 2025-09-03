import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { makeConfig, type CloudflareContext } from "./config";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";
import { type CloudflareBkndConfig, createApp } from "./cloudflare-workers.adapter";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("cf adapter", () => {
   const DB_URL = ":memory:";
   const $ctx = (env?: any, request?: Request, ctx?: ExecutionContext) => ({
      request: request ?? (null as any),
      env: env ?? { url: DB_URL },
      ctx: ctx ?? (null as any),
   });

   it("makes config", async () => {
      const staticConfig = await makeConfig(
         {
            connection: { url: DB_URL },
            initialConfig: { data: { basepath: DB_URL } },
         },
         $ctx({ DB_URL }),
      );
      expect(staticConfig.initialConfig).toEqual({ data: { basepath: DB_URL } });
      expect(staticConfig.connection).toBeDefined();

      const dynamicConfig = await makeConfig(
         {
            app: (env) => ({
               initialConfig: { data: { basepath: env.DB_URL } },
               connection: { url: env.DB_URL },
            }),
         },
         $ctx({ DB_URL }),
      );
      expect(dynamicConfig.initialConfig).toEqual({ data: { basepath: DB_URL } });
      expect(dynamicConfig.connection).toBeDefined();
   });

   adapterTestSuite<CloudflareBkndConfig, CloudflareContext<any>>(bunTestRunner, {
      makeApp: async (c, a, o) => {
         return await createApp(c, { env: a } as any, o);
      },
      makeHandler: (c, a, o) => {
         console.log("args", a);
         return async (request: any) => {
            const app = await createApp(
               // needs a fallback, otherwise tries to launch D1
               c ?? {
                  connection: { url: DB_URL },
               },
               a as any,
               o,
            );
            return app.fetch(request);
         };
      },
   });
});
