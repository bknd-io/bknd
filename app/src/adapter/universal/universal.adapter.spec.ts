import { afterAll, beforeAll, describe, test, expect } from "bun:test";
import { createBknd } from "./universal.adapter";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("universal adapter via createBknd", () => {
   adapterTestSuite(bunTestRunner, {
      makeApp: (options, args) => createBknd({ mode: "headless", options }, args).getApp(),
      makeHandler: (options, args) => createBknd({ mode: "headless", options: options ?? {} }, args).serve(),
   });

   // ------------------------ MODE HEADLESS ------------------------
   test("caches app instance", async () => {
      const bknd = createBknd({ mode: "headless", options: { connection: { url: ":memory:" } } });
      const app1 = await bknd.getApp();
      const app2 = await bknd.getApp();
      expect(app1).toBe(app2);
   });

   test("getApi returns api", async () => {
      const bknd = createBknd({ mode: "headless", options: { connection: { url: ":memory:" } } });
      const api = await bknd.getApi();
      expect(api).toBeDefined();
   });

   test("uses createFrameworkApp in headless mode", async () => {
      const bknd = createBknd({ mode: "headless", options: { connection: { url: ":memory:" } } });
      const app = await bknd.getApp();
      expect(app).toBeDefined();
      expect(app.isBuilt()).toBe(true);
   });

   test("serve returns a fetch handler", async () => {
      const bknd = createBknd({ mode: "headless", options: { connection: { url: ":memory:" } } });
      const handler = bknd.serve();
      const res = await handler(new Request("http://localhost:3000/api/system/config"));
      expect(res.status).toBe(200);
   });
});


// ------------------------ MODE ADMIN ------------------------
describe("universal adapter via createBknd in admin mode", () => {
   adapterTestSuite(bunTestRunner, {
      makeApp: (options, args) => createBknd({ mode: "admin", options }, args).getApp(),
      makeHandler: (options, args) => createBknd({ mode: "admin", options: options ?? {} }, args).serve(),
   });

   test("caches app instance", async () => {
      const bknd = createBknd({ mode: "admin", options: { connection: { url: ":memory:" } } });
      const app1 = await bknd.getApp();
      const app2 = await bknd.getApp();
      expect(app1).toBe(app2);
   });

   test("getApi returns api", async () => {
      const bknd = createBknd({ mode: "admin", options: { connection: { url: ":memory:" } } });
      const api = await bknd.getApi();
      expect(api).toBeDefined();
   });

   test("uses createRuntimeApp in admin mode", async () => {
      const bknd = createBknd({
         mode: "admin",
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
         mode: "admin",
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
         mode: "admin",
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
