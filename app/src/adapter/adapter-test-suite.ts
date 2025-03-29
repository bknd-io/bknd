import type { TestRunner } from "core/test";
import type { BkndConfig, DefaultArgs, FrameworkOptions, RuntimeOptions } from "./index";
import type { App } from "App";

export function adapterTestSuite<
   Config extends BkndConfig = BkndConfig,
   Args extends DefaultArgs = DefaultArgs,
>(
   testRunner: TestRunner,
   {
      makeApp,
      makeHandler,
      label = "app",
      overrides = {},
   }: {
      makeApp: (
         config: Config,
         args?: Args,
         opts?: RuntimeOptions | FrameworkOptions,
      ) => Promise<App>;
      makeHandler?: (
         config?: Config,
         args?: Args,
         opts?: RuntimeOptions | FrameworkOptions,
      ) => (request: Request) => Promise<Response>;
      label?: string;
      overrides?: {
         dbUrl?: string;
      };
   },
) {
   const { test, expect, mock } = testRunner;
   const id = crypto.randomUUID();

   test(`creates ${label}`, async () => {
      const beforeBuild = mock(async () => null) as any;
      const onBuilt = mock(async () => null) as any;

      const config = {
         app: (env) => ({
            connection: { url: env.url },
            initialConfig: {
               server: { cors: { origin: env.origin } },
            },
         }),
         beforeBuild,
         onBuilt,
      } as const satisfies BkndConfig;

      const app = await makeApp(
         config as any,
         {
            url: overrides.dbUrl ?? ":memory:",
            origin: "localhost",
         } as any,
         { id },
      );
      expect(app).toBeDefined();
      expect(app.toJSON().server.cors.origin).toEqual("localhost");
      expect(beforeBuild).toHaveBeenCalledTimes(1);
      expect(onBuilt).toHaveBeenCalledTimes(1);
   });

   if (makeHandler) {
      const getConfig = async (fetcher: (r: Request) => Promise<Response>) => {
         const res = await fetcher(new Request("http://localhost:3000/api/system/config"));
         const data = (await res.json()) as any;
         return { res, data };
      };

      test("responds with the same app id", async () => {
         const fetcher = makeHandler(undefined, undefined, { id });

         const { res, data } = await getConfig(fetcher);
         expect(res.ok).toBe(true);
         expect(res.status).toBe(200);
         expect(data.server.cors.origin).toEqual("localhost");
      });

      test("creates fresh & responds to api config", async () => {
         // set the same id, but force recreate
         const fetcher = makeHandler(undefined, undefined, { id, force: true });

         const { res, data } = await getConfig(fetcher);
         expect(res.ok).toBe(true);
         expect(res.status).toBe(200);
         expect(data.server.cors.origin).toEqual("*");
      });
   }
}
