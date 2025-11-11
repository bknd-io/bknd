import { describe, expect, mock, test, beforeAll, afterAll } from "bun:test";
import { createApp as internalCreateApp, type CreateAppConfig } from "bknd";
import { getDummyConnection } from "../../__test__/helper";
import { ModuleManager } from "modules/ModuleManager";
import { em, entity, text } from "data/prototype";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

async function createApp(config: CreateAppConfig = {}) {
   const app = internalCreateApp({
      connection: getDummyConnection().dummyConnection,
      ...config,
      options: {
         ...config.options,
         mode: "code",
      },
   });
   await app.build();
   return app;
}

describe("code-only", () => {
   test("should create app with correct manager", async () => {
      const app = await createApp();
      await app.build();

      expect(app.version()).toBeDefined();
      expect(app.modules).toBeInstanceOf(ModuleManager);
   });

   test("should not perform database syncs", async () => {
      const app = await createApp({
         config: {
            data: em({
               test: entity("test", {
                  name: text(),
               }),
            }).toJSON(),
         },
      });
      expect(app.em.entities.map((e) => e.name)).toEqual(["test"]);
      expect(
         await app.em.connection.kysely
            .selectFrom("sqlite_master")
            .where("type", "=", "table")
            .selectAll()
            .execute(),
      ).toEqual([]);

      // only perform when explicitly forced
      await app.em.schema().sync({ force: true });
      expect(
         await app.em.connection.kysely
            .selectFrom("sqlite_master")
            .where("type", "=", "table")
            .selectAll()
            .execute()
            .then((r) => r.map((r) => r.name)),
      ).toEqual(["test", "sqlite_sequence"]);
   });

   test("should not perform seeding", async () => {
      const called = mock(() => null);
      const app = await createApp({
         config: {
            data: em({
               test: entity("test", {
                  name: text(),
               }),
            }).toJSON(),
         },
         options: {
            seed: async (ctx) => {
               called();
               await ctx.em.mutator("test").insertOne({ name: "test" });
            },
         },
      });
      await app.em.schema().sync({ force: true });
      expect(called).not.toHaveBeenCalled();
      expect(
         await app.em
            .repo("test")
            .findMany({})
            .then((r) => r.data),
      ).toEqual([]);
   });

   test("should sync and perform seeding", async () => {
      const called = mock(() => null);
      const app = await createApp({
         config: {
            data: em({
               test: entity("test", {
                  name: text(),
               }),
            }).toJSON(),
         },
         options: {
            seed: async (ctx) => {
               called();
               await ctx.em.mutator("test").insertOne({ name: "test" });
            },
         },
      });

      await app.em.schema().sync({ force: true });
      await app.options?.seed?.({
         ...app.modules.ctx(),
         app: app,
      });
      expect(called).toHaveBeenCalled();
      expect(
         await app.em
            .repo("test")
            .findMany({})
            .then((r) => r.data),
      ).toEqual([{ id: 1, name: "test" }]);
   });

   test("should not allow to modify config", async () => {
      const app = await createApp();
      // biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
      expect(app.modules.hasOwnProperty("mutateConfigSafe")).toBe(false);
      expect(() => {
         app.modules.configs().auth.enabled = true;
      }).toThrow();
   });
});
