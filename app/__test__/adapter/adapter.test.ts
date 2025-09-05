import { expect, describe, it, beforeAll, afterAll } from "bun:test";
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

   adapterTestSuite(bunTestRunner, {
      makeApp: adapter.createFrameworkApp,
      label: "framework app",
   });

   adapterTestSuite(bunTestRunner, {
      makeApp: adapter.createRuntimeApp,
      label: "runtime app",
   });
});
