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
               { app: (a) => ({ initialConfig: { server: { cors: { origin: a.env.TEST } } } }) },
               { env: { TEST: "test" } },
            ),
            ["connection"],
         ),
      ).toEqual({
         initialConfig: { server: { cors: { origin: "test" } } },
      });
   });

   /* it.only("...", async () => {
      const app = await adapter.createAdapterApp();
   }); */

   it("reuses apps correctly", async () => {
      const id = crypto.randomUUID();

      const first = await adapter.createAdapterApp(
         {
            initialConfig: { server: { cors: { origin: "random" } } },
         },
         undefined,
         { id },
      );
      const second = await adapter.createAdapterApp();
      const third = await adapter.createAdapterApp(undefined, undefined, { id });

      await first.build();
      await second.build();
      await third.build();

      expect(first.toJSON().server.cors.origin).toEqual("random");
      expect(first).toBe(third);
      expect(first).not.toBe(second);
      expect(second).not.toBe(third);
      expect(second.toJSON().server.cors.origin).toEqual("*");

      // recreate the first one
      const first2 = await adapter.createAdapterApp(undefined, undefined, { id, force: true });
      await first2.build();
      expect(first2).not.toBe(first);
      expect(first2).not.toBe(third);
      expect(first2).not.toBe(second);
      expect(first2.toJSON().server.cors.origin).toEqual("*");
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
