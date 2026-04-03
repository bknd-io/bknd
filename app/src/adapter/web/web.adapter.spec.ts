import { afterAll, beforeAll, describe, test, expect } from "bun:test";
import { createBknd } from "./web.adapter";
import type { WebBkndConfig } from "./web.adapter";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("web adapter via createBknd", () => {
   adapterTestSuite(bunTestRunner, {
      makeApp: (config, args) => createBknd(config, args).getApp(),
      makeHandler: (config, args) => createBknd(config ?? {}, args).serve(),
   });

   test("caches app instance", async () => {
      const bknd = createBknd({ connection: { url: ":memory:" } });
      const app1 = await bknd.getApp();
      const app2 = await bknd.getApp();
      expect(app1).toBe(app2);
   });

   test("getApi returns api", async () => {
      const bknd = createBknd({ connection: { url: ":memory:" } });
      const api = await bknd.getApi();
      expect(api).toBeDefined();
   });

   test("serve returns a fetch handler", async () => {
      const bknd = createBknd({ connection: { url: ":memory:" } });
      const handler = bknd.serve();
      const res = await handler(new Request("http://localhost:3000/api/system/config"));
      expect(res.status).toBe(200);
   });

   test("uses createRuntimeApp when adminOptions provided", async () => {
      const bknd = createBknd({
         connection: { url: ":memory:" },
         adminOptions: { adminBasepath: "/admin" },
      });
      const app = await bknd.getApp();
      expect(app).toBeDefined();
      expect(app.isBuilt()).toBe(true);
   });

   test("uses createFrameworkApp when no adminOptions", async () => {
      const bknd = createBknd({ connection: { url: ":memory:" } });
      const app = await bknd.getApp();
      expect(app).toBeDefined();
      expect(app.isBuilt()).toBe(true);
   });
});
