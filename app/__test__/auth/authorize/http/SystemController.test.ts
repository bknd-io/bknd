import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createAuthTestApp } from "./shared";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("SystemController (auth)", () => {
   test("reading info", async () => {
      const { request } = await createAuthTestApp({
         permission: ["system.access.api", "system.info"],
         request: new Request("http://localhost/api/system/info"),
      });
      expect((await request.guest()).status).toBe(403);
      expect((await request.member()).status).toBe(403);
      expect((await request.authorized()).status).toBe(200);
      expect((await request.admin()).status).toBe(200);
   });

   test("reading permissions", async () => {
      const { request } = await createAuthTestApp({
         permission: ["system.access.api", "system.schema.read"],
         request: new Request("http://localhost/api/system/permissions"),
      });
      expect((await request.guest()).status).toBe(403);
      expect((await request.member()).status).toBe(403);
      expect((await request.authorized()).status).toBe(200);
      expect((await request.admin()).status).toBe(200);
   });

   test("access openapi", async () => {
      const { request } = await createAuthTestApp({
         permission: ["system.access.api", "system.openapi"],
         request: new Request("http://localhost/api/system/openapi.json"),
      });
      expect((await request.guest()).status).toBe(403);
      expect((await request.member()).status).toBe(403);
      expect((await request.authorized()).status).toBe(200);
      expect((await request.admin()).status).toBe(200);
   });
});
