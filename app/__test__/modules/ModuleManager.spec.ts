import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { disableConsoleLog, enableConsoleLog, stripMark } from "../../src/core/utils";
import { Type } from "@sinclair/typebox";
import { entity, text } from "../../src/data";
import { Module } from "../../src/modules/Module";
import { ModuleManager, getDefaultConfig } from "../../src/modules/ModuleManager";
import { CURRENT_VERSION, TABLE_NAME } from "../../src/modules/migrations";
import { getDummyConnection } from "../helper";

describe("ModuleManager", async () => {
   test("s1: no config, no build", async () => {
      const { dummyConnection } = getDummyConnection();

      const mm = new ModuleManager(dummyConnection);

      // that is because no module is built
      expect(mm.toJSON()).toEqual({ version: 0 } as any);
   });

   test("s2: no config, build", async () => {
      const { dummyConnection } = getDummyConnection();

      const mm = new ModuleManager(dummyConnection);
      await mm.build();

      expect(mm.version()).toBe(CURRENT_VERSION);
      expect(mm.built()).toBe(true);
   });

   test("s3: config given, table exists, version matches", async () => {
      const c = getDummyConnection();
      const mm = new ModuleManager(c.dummyConnection);
      await mm.build();
      const version = mm.version();
      const configs = mm.configs();
      const json = stripMark({
         ...configs,
         data: {
            ...configs.data,
            basepath: "/api/data2",
            entities: {
               test: entity("test", {
                  content: text(),
               }).toJSON(),
            },
         },
      }) as any;
      //const { version, ...json } = mm.toJSON() as any;

      const c2 = getDummyConnection();
      const db = c2.dummyConnection.kysely;
      const mm2 = new ModuleManager(c2.dummyConnection, { initial: { version, ...json } });
      await mm2.syncConfigTable();
      await db
         .insertInto(TABLE_NAME)
         .values({ type: "config", json: JSON.stringify(json), version: CURRENT_VERSION })
         .execute();

      await mm2.build();

      expect(json).toEqual(stripMark(mm2.configs()));
   });

   test("s3.1: (fetch) config given, table exists, version matches", async () => {
      const configs = getDefaultConfig();
      const json = {
         ...configs,
         data: {
            ...configs.data,
            basepath: "/api/data2",
            entities: {
               test: entity("test", {
                  content: text(),
               }).toJSON(),
            },
         },
      } as any;
      //const { version, ...json } = mm.toJSON() as any;

      const { dummyConnection } = getDummyConnection();
      const db = dummyConnection.kysely;
      const mm2 = new ModuleManager(dummyConnection);
      await mm2.syncConfigTable();
      // assume an initial version
      await db.insertInto(TABLE_NAME).values({ type: "config", json: null, version: 1 }).execute();
      await db
         .insertInto(TABLE_NAME)
         .values({ type: "config", json: JSON.stringify(json), version: CURRENT_VERSION })
         .execute();

      await mm2.build();

      expect(stripMark(json)).toEqual(stripMark(mm2.configs()));
      expect(mm2.configs().data.entities?.test).toBeDefined();
      expect(mm2.configs().data.entities?.test?.fields?.content).toBeDefined();
      expect(mm2.get("data").toJSON().entities?.test?.fields?.content).toBeDefined();
   });

   test("s4: config given, table exists, version outdated, migrate", async () => {
      const c = getDummyConnection();
      const mm = new ModuleManager(c.dummyConnection);
      await mm.build();
      const json = mm.configs();

      const c2 = getDummyConnection();
      const db = c2.dummyConnection.kysely;
      const mm2 = new ModuleManager(c2.dummyConnection);
      await mm2.syncConfigTable();

      await db
         .insertInto(TABLE_NAME)
         .values({ json: JSON.stringify(json), type: "config", version: CURRENT_VERSION - 1 })
         .execute();

      await mm2.build();
   });

   test("s5: config given, table exists, version mismatch", async () => {
      const c = getDummyConnection();
      const mm = new ModuleManager(c.dummyConnection);
      await mm.build();
      const version = mm.version();
      const json = mm.configs();
      //const { version, ...json } = mm.toJSON() as any;

      const c2 = getDummyConnection();
      const db = c2.dummyConnection.kysely;

      const mm2 = new ModuleManager(c2.dummyConnection, {
         initial: { version: version - 1, ...json },
      });
      await mm2.syncConfigTable();
      await db
         .insertInto(TABLE_NAME)
         .values({ type: "config", json: JSON.stringify(json), version: CURRENT_VERSION })
         .execute();

      expect(mm2.build()).rejects.toThrow(/version.*do not match/);
   });

   test("s6: no config given, table exists, fetch", async () => {
      const c = getDummyConnection();
      const mm = new ModuleManager(c.dummyConnection);
      await mm.build();
      const json = mm.configs();
      //const { version, ...json } = mm.toJSON() as any;

      const c2 = getDummyConnection();
      const db = c2.dummyConnection.kysely;

      const mm2 = new ModuleManager(c2.dummyConnection);
      await mm2.syncConfigTable();

      const config = {
         ...json,
         data: {
            ...json.data,
            basepath: "/api/data2",
         },
      };
      await db
         .insertInto(TABLE_NAME)
         .values({ type: "config", json: JSON.stringify(config), version: CURRENT_VERSION })
         .execute();

      // run without config given
      await mm2.build();

      expect(mm2.configs().data.basepath).toBe("/api/data2");
   });

   /*test("blank app, modify config", async () => {
      const { dummyConnection } = getDummyConnection();

      const mm = new ModuleManager(dummyConnection);
      await mm.build();
      const configs = stripMark(mm.configs());

      expect(mm.configs().server.admin.color_scheme).toBeUndefined();
      expect(() => mm.get("server").schema().patch("admin", { color_scheme: "violet" })).toThrow();
      await mm.get("server").schema().patch("admin", { color_scheme: "dark" });
      await mm.save();

      expect(mm.configs().server.admin.color_scheme).toBe("dark");
      expect(stripMark(mm.configs())).toEqual({
         ...configs,
         server: {
            ...configs.server,
            admin: {
               ...configs.server.admin,
               color_scheme: "dark",
            },
         },
      });
   });*/

   test("partial config given", async () => {
      const { dummyConnection } = getDummyConnection();

      const partial = {
         auth: {
            enabled: true,
         },
      };
      const mm = new ModuleManager(dummyConnection, {
         initial: partial,
      });
      await mm.build();

      expect(mm.version()).toBe(CURRENT_VERSION);
      expect(mm.built()).toBe(true);
      expect(mm.configs().auth.enabled).toBe(true);
      expect(mm.configs().data.entities?.users).toBeDefined();
   });

   test("partial config given, but db version exists", async () => {
      const c = getDummyConnection();
      const mm = new ModuleManager(c.dummyConnection);
      await mm.build();
      console.log("==".repeat(30));
      console.log("");
      const json = mm.configs();

      const c2 = getDummyConnection();
      const db = c2.dummyConnection.kysely;

      const mm2 = new ModuleManager(c2.dummyConnection, {
         initial: {
            auth: {
               basepath: "/shouldnt/take/this",
            },
         },
      });
      await mm2.syncConfigTable();
      const payload = {
         ...json,
         auth: {
            ...json.auth,
            enabled: true,
            basepath: "/api/auth2",
         },
      };
      await db
         .insertInto(TABLE_NAME)
         .values({
            type: "config",
            json: JSON.stringify(payload),
            version: CURRENT_VERSION,
         })
         .execute();
      await mm2.build();
      expect(mm2.configs().auth.basepath).toBe("/api/auth2");
   });

   // @todo: add tests for migrations (check "backup" and new version)

   describe("revert", async () => {
      const failingModuleSchema = Type.Object({
         value: Type.Optional(Type.Number()),
      });
      class FailingModule extends Module<typeof failingModuleSchema> {
         getSchema() {
            return failingModuleSchema;
         }

         override async build() {
            //console.log("building FailingModule", this.config);
            if (this.config.value && this.config.value < 0) {
               throw new Error("value must be positive, given: " + this.config.value);
            }
            this.setBuilt();
         }
      }
      class TestModuleManager extends ModuleManager {
         constructor(...args: ConstructorParameters<typeof ModuleManager>) {
            super(...args);
            const [, options] = args;
            // @ts-ignore
            const initial = options?.initial?.failing ?? {};
            this.modules["failing"] = new FailingModule(initial, this.ctx());
            this.modules["failing"].setListener(async (c) => {
               // @ts-ignore
               await this.onModuleConfigUpdated("failing", c);
            });
         }
      }

      beforeEach(() => disableConsoleLog(["log", "warn", "error"]));
      afterEach(enableConsoleLog);

      test("it builds", async () => {
         const { dummyConnection } = getDummyConnection();
         const mm = new TestModuleManager(dummyConnection);
         expect(mm).toBeDefined();
         await mm.build();
         expect(mm.toJSON()).toBeDefined();
      });

      test("it accepts config", async () => {
         const { dummyConnection } = getDummyConnection();
         const mm = new TestModuleManager(dummyConnection, {
            initial: {
               // @ts-ignore
               failing: { value: 2 },
            },
         });
         await mm.build();
         expect(mm.configs()["failing"].value).toBe(2);
      });

      test("it crashes on invalid", async () => {
         const { dummyConnection } = getDummyConnection();
         const mm = new TestModuleManager(dummyConnection, {
            initial: {
               // @ts-ignore
               failing: { value: -1 },
            },
         });
         expect(mm.build()).rejects.toThrow(/value must be positive/);
         expect(mm.configs()["failing"].value).toBe(-1);
      });

      test("it correctly accepts valid", async () => {
         const mockOnUpdated = mock(() => null);
         const { dummyConnection } = getDummyConnection();
         const mm = new TestModuleManager(dummyConnection, {
            onUpdated: async () => {
               mockOnUpdated();
            },
         });
         await mm.build();
         // @ts-ignore
         const f = mm.mutateConfigSafe("failing");

         // @ts-ignore
         expect(f.set({ value: 2 })).resolves.toBeDefined();
         expect(mockOnUpdated).toHaveBeenCalled();
      });

      test("it reverts on safe mutate", async () => {
         const mockOnUpdated = mock(() => null);
         const { dummyConnection } = getDummyConnection();
         const mm = new TestModuleManager(dummyConnection, {
            initial: {
               // @ts-ignore
               failing: { value: 1 },
            },
            onUpdated: async () => {
               mockOnUpdated();
            },
         });
         await mm.build();
         expect(mm.configs()["failing"].value).toBe(1);

         // now safe mutate
         // @ts-ignore
         expect(mm.mutateConfigSafe("failing").set({ value: -2 })).rejects.toThrow(
            /value must be positive/,
         );
         expect(mm.configs()["failing"].value).toBe(1);
         expect(mockOnUpdated).toHaveBeenCalled();
      });

      test("it only accepts schema mutating methods", async () => {
         const { dummyConnection } = getDummyConnection();
         const mm = new TestModuleManager(dummyConnection);
         await mm.build();

         // @ts-ignore
         const f = mm.mutateConfigSafe("failing");

         // @ts-expect-error
         expect(() => f.has("value")).toThrow();
         // @ts-expect-error
         expect(() => f.bypass()).toThrow();
         // @ts-expect-error
         expect(() => f.clone()).toThrow();
         // @ts-expect-error
         expect(() => f.get()).toThrow();
         // @ts-expect-error
         expect(() => f.default()).toThrow();
      });
   });
});
