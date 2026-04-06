import { afterAll, beforeAll, describe, test, expect } from "bun:test";
import { createBknd } from "./web.adapter";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("web adapter via createBknd", () => {
   adapterTestSuite(bunTestRunner, {
      makeApp: (options, args) => createBknd({ mode: "api", options }, args).getApp(),
      makeHandler: (options, args) => createBknd({ mode: "api", options: options ?? {} }, args).serve(),
   });

   // ------------------------ MODE API ------------------------
   test("caches app instance", async () => {
      const bknd = createBknd({ mode: "api", options: { connection: { url: ":memory:" } } });
      const app1 = await bknd.getApp();
      const app2 = await bknd.getApp();
      expect(app1).toBe(app2);
   });

   test("getApi returns api", async () => {
      const bknd = createBknd({ mode: "api", options: { connection: { url: ":memory:" } } });
      const api = await bknd.getApi();
      expect(api).toBeDefined();
   });

   test("uses createFrameworkApp ", async () => {
      const bknd = createBknd({ mode: "api", options: { connection: { url: ":memory:" } } });
      const app = await bknd.getApp();
      expect(app).toBeDefined();
      expect(app.isBuilt()).toBe(true);
   });

   test("serve returns a fetch handler", async () => {
      const bknd = createBknd({ mode: "api", options: { connection: { url: ":memory:" } } });
      const handler = bknd.serve();
      const res = await handler(new Request("http://localhost:3000/api/system/config"));
      expect(res.status).toBe(200);
   });
});


// ------------------------ MODE STANDALONE ------------------------
describe("web adapter via createBknd in standalone mode", () => {
   adapterTestSuite(bunTestRunner, {
      makeApp: (options, args) => createBknd({ mode: "standalone", options }, args).getApp(),
      makeHandler: (options, args) => createBknd({ mode: "standalone", options: options ?? {} }, args).serve(),
   });

   test("caches app instance", async () => {
      const bknd = createBknd({ mode: "standalone", options: { connection: { url: ":memory:" } } });
      const app1 = await bknd.getApp();
      const app2 = await bknd.getApp();
      expect(app1).toBe(app2);
   });

   test("getApi returns api", async () => {
      const bknd = createBknd({ mode: "standalone", options: { connection: { url: ":memory:" } } });
      const api = await bknd.getApi();
      expect(api).toBeDefined();
   });

   test("uses createRuntimeApp", async () => {
      const bknd = createBknd({
         mode: "standalone",
         options: {
            connection: { url: ":memory:" },
            adminOptions: { adminBasepath: "/admin" },
         }
      });
      const app = await bknd.getApp();
      expect(app).toBeDefined();
      expect(app.isBuilt()).toBe(true);
   });

   test("serve returns a fetch handler", async () => {
      const bknd = createBknd({
         mode: "standalone",
         options: {
            connection: { url: ":memory:" },
            adminOptions: { adminBasepath: "/admin" },
         }
      });
      const handler = bknd.serve();
      const res = await handler(new Request("http://localhost:3000/api/system/config"));
      expect(res.status).toBe(200);
   });

   test("check admin route", async () => {
      const bknd = createBknd({
         mode: "standalone",
         options: {
            connection: { url: ":memory:" },
            adminOptions: { adminBasepath: "/admin" },
         }
      });
      const handler = bknd.serve();
      const res = await handler(new Request("http://localhost:3000/admin"));
      expect(res.status).toBe(200);
   });
});
