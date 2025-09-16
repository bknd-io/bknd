import { expect, describe, it, beforeAll, afterAll, mock } from "bun:test";
import * as adapter from "adapter";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";
import { omitKeys } from "core/utils";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("adapter", () => {
   it("makes config", async () => {
      expect(omitKeys(await adapter.makeConfig({}), ["connection"])).toEqual({});
      expect(
         omitKeys(await adapter.makeConfig({}, { env: { TEST: "test" } }), ["connection"]),
      ).toEqual({});

      // merges everything returned from `app` with the config
      expect(
         omitKeys(
            await adapter.makeConfig(
               { app: (a) => ({ config: { server: { cors: { origin: a.env.TEST } } } }) },
               { env: { TEST: "test" } },
            ),
            ["connection"],
         ),
      ).toEqual({
         config: { server: { cors: { origin: "test" } } },
      });
   });

   it("allows all properties in app function", async () => {
      const called = mock(() => null);
      const config = await adapter.makeConfig(
         {
            app: (env) => ({
               connection: { url: "test" },
               config: { server: { cors: { origin: "test" } } },
               options: {
                  mode: "db",
               },
               onBuilt: () => {
                  called();
                  expect(env).toEqual({ foo: "bar" });
               },
            }),
         },
         { foo: "bar" },
      );
      expect(config.connection).toEqual({ url: "test" });
      expect(config.config).toEqual({ server: { cors: { origin: "test" } } });
      expect(config.options).toEqual({ mode: "db" });
      await config.onBuilt?.(null as any);
      expect(called).toHaveBeenCalled();
   });

   adapterTestSuite(bunTestRunner, {
      makeApp: adapter.createFrameworkApp,
      label: "framework app",
   });

   adapterTestSuite(bunTestRunner, {
      makeApp: adapter.createRuntimeApp,
      label: "runtime app",
   });
});
