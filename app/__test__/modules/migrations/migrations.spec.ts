import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type InitialModuleConfigs, createApp } from "../../../src";

import { type Kysely, sql } from "kysely";
import { getDummyConnection } from "../../helper";
import v7 from "./samples/v7.json";
import v8 from "./samples/v8.json";
import v8_2 from "./samples/v8-2.json";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

beforeAll(() => disableConsoleLog());
afterAll(enableConsoleLog);

// app expects migratable config to be present in database
async function createVersionedApp(config: InitialModuleConfigs | any) {
   const { dummyConnection } = getDummyConnection();

   if (!("version" in config)) throw new Error("config must have a version");
   const { version, ...rest } = config;

   const db = dummyConnection.kysely as Kysely<any>;
   await sql`CREATE TABLE "__bknd" (
       "id"         integer not null primary key autoincrement,
       "version"    integer,
       "type"       text,
       "json"       text,
       "created_at" datetime,
       "updated_at" datetime
    )`.execute(db);

   await db
      .insertInto("__bknd")
      .values({
         version,
         type: "config",
         created_at: new Date().toISOString(),
         json: JSON.stringify(rest),
      })
      .execute();

   const app = createApp({
      connection: dummyConnection,
   });
   await app.build();
   return app;
}

describe("Migrations", () => {
   /**
    * updated auth strategies to have "enabled" prop
    * by default, migration should make all available strategies enabled
    */
   test("migration from 7 to 8", async () => {
      expect(v7.version).toBe(7);

      const app = await createVersionedApp(v7);

      expect(app.version()).toBeGreaterThan(7);
      expect(app.toJSON(true).auth.strategies?.password?.enabled).toBe(true);

      const req = await app.server.request("/api/auth/password/register", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({
            email: "test@test.com",
            password: "12345678",
         }),
      });
      expect(req.ok).toBe(true);
      const res = (await req.json()) as any;
      expect(res.user.email).toBe("test@test.com");
   });

   test("migration from 8 to 9", async () => {
      expect(v8.version).toBe(8);

      const app = await createVersionedApp(v8);

      expect(app.version()).toBeGreaterThan(8);
      // @ts-expect-error
      expect(app.toJSON(true).server.admin).toBeUndefined();
   });
});
