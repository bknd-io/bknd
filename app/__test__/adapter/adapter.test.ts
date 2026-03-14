import { expect, describe, it, beforeAll, afterAll, mock } from "bun:test";
import * as adapter from "adapter";
import { disableConsoleLog, enableConsoleLog, omitKeys } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";

const stripConnection = <T extends Record<string, any>>(cfg: T) =>
  omitKeys(cfg, ["connection"]);

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("adapter", () => {
  describe("makeConfig", () => {
    it("returns empty config for empty inputs", async () => {
      const cases: Array<Parameters<typeof adapter.makeConfig>> = [
        [{}],
        [{}, { env: { TEST: "test" } }],
      ];

      for (const args of cases) {
        const cfg = await adapter.makeConfig(...(args as any));
        expect(stripConnection(cfg)).toEqual({});
      }
    });

    it("merges app output into config", async () => {
      const cfg = await adapter.makeConfig(
        { app: (a) => ({ config: { server: { cors: { origin: a.env.TEST } } } }) },
        { env: { TEST: "test" } },
      );

      expect(stripConnection(cfg)).toEqual({
        config: { server: { cors: { origin: "test" } } },
      });
    });

    it("allows all properties in app() result", async () => {
      const called = mock(() => null);

      const cfg = await adapter.makeConfig(
        {
          app: (env) => ({
            connection: { url: "test" },
            config: { server: { cors: { origin: "test" } } },
            options: { mode: "db" as const },
            onBuilt: () => {
              called();
              expect(env).toEqual({ foo: "bar" });
            },
          }),
        },
        { foo: "bar" },
      );

      expect(cfg.connection).toEqual({ url: "test" });
      expect(cfg.config).toEqual({ server: { cors: { origin: "test" } } });
      expect(cfg.options).toEqual({ mode: "db" });

      await cfg.onBuilt?.({} as any);
      expect(called).toHaveBeenCalledTimes(1);
    });
  });

  describe("adapter test suites", () => {
    adapterTestSuite(bunTestRunner, {
      makeApp: adapter.createFrameworkApp,
      label: "framework app",
    });

    adapterTestSuite(bunTestRunner, {
      makeApp: adapter.createRuntimeApp,
      label: "runtime app",
    });
  });
});
