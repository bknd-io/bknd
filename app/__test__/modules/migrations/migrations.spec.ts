import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { App, type InitialModuleConfigs, createApp } from "/";

import { type Kysely, sql } from "kysely";
import { getDummyConnection } from "../../helper";
import v7 from "./samples/v7.json";
import v8 from "./samples/v8.json";
import v8_2 from "./samples/v8-2.json";
import v9 from "./samples/v9.json";
import v10 from "./samples/v10.json";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";
import { CURRENT_VERSION } from "modules/db/migrations";

beforeAll(() => disableConsoleLog());
afterAll(enableConsoleLog);

// app expects migratable config to be present in database
async function createVersionedApp(
   config: InitialModuleConfigs | any,
   opts?: { beforeCreateApp?: (db: Kysely<any>) => Promise<void> },
) {
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

   if (opts?.beforeCreateApp) {
      await opts.beforeCreateApp(db);
   }

   const app = createApp({
      connection: dummyConnection,
   });
   await app.build();
   return app;
}

async function getRawConfig(
   app: App,
   opts?: { version?: number; types?: ("config" | "diff" | "backup" | "secrets")[] },
) {
   const db = app.em.connection.kysely;
   return await db
      .selectFrom("__bknd")
      .selectAll()
      .where("version", "=", opts?.version ?? CURRENT_VERSION)
      .$if((opts?.types?.length ?? 0) > 0, (qb) => qb.where("type", "in", opts?.types))
      .execute();
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

   test("migration from 9 to 10", async () => {
      expect(v9.version).toBe(9);

      const app = await createVersionedApp(v9);

      expect(app.version()).toBeGreaterThan(9);
      // @ts-expect-error
      expect(app.toJSON(true).media.adapter.config.secret_access_key).toBe(
         "^^s3.secret_access_key^^",
      );
      const [config, secrets] = (await getRawConfig(app, {
         types: ["config", "secrets"],
      })) as any;

      expect(config.json.auth.jwt.secret).toBe("");
      expect(config.json.media.adapter.config.access_key).toBe("");
      expect(config.json.media.adapter.config.secret_access_key).toBe("");

      expect(secrets.json["auth.jwt.secret"]).toBe("^^jwt.secret^^");
      expect(secrets.json["media.adapter.config.access_key"]).toBe("^^s3.access_key^^");
      expect(secrets.json["media.adapter.config.secret_access_key"]).toBe(
         "^^s3.secret_access_key^^",
      );
   });

   test("migration from 10 to 11", async () => {
      expect(v10.version).toBe(10);
      expect(v10.data.entities.test.fields.title.config.fillable).toEqual(["read", "update"]);

      const app = await createVersionedApp(v10);

      expect(app.version()).toBeGreaterThan(10);
      const [config] = (await getRawConfig(app, { types: ["config"] })) as any;
      expect(config.json.data.entities.test.fields.title.config.fillable).toEqual(true);
   });
});
