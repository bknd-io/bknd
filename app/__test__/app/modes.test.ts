import { describe, expect, test } from "bun:test";
import { code, hybrid } from "modes";

describe("modes", () => {
   describe("code", () => {
      test("verify base configuration", async () => {
         const c = code({}) as any;
         const config = await c.app?.({} as any);
         expect(Object.keys(config)).toEqual(["options"]);
         expect(config.options.mode).toEqual("code");
         expect(config.options.plugins).toEqual([]);
         expect(config.options.manager.skipValidation).toEqual(false);
         expect(config.options.manager.onModulesBuilt).toBeDefined();
      });

      test("keeps overrides", async () => {
         const c = code({
            connection: {
               url: ":memory:",
            },
         }) as any;
         const config = await c.app?.({} as any);
         expect(config.connection.url).toEqual(":memory:");
      });
   });

   describe("hybrid", () => {
      test("fails if no reader is provided", () => {
         // @ts-ignore
         expect(hybrid({} as any).app?.({} as any)).rejects.toThrow(/reader/);
      });
      test("verify base configuration", async () => {
         const c = hybrid({ reader: async () => ({}) }) as any;
         const config = await c.app?.({} as any);
         expect(Object.keys(config)).toEqual(["reader", "beforeBuild", "config", "options"]);
         expect(config.options.mode).toEqual("db");
         expect(config.options.plugins).toEqual([]);
         expect(config.options.manager.skipValidation).toEqual(false);
         expect(config.options.manager.onModulesBuilt).toBeDefined();
      });
   });
});
