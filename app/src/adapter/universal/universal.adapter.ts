import {
   createFrameworkApp,
   createRuntimeApp,
   type FrameworkBkndConfig,
   type RuntimeBkndConfig,
} from "bknd/adapter";
import { $console } from "core/utils";
import type { App } from "App";

export type AdapterModeWithOptions<Env = Record<string, string | undefined>> =
   | {
        mode: "standalone";
        options: RuntimeBkndConfig<Env>;
     }
   | {
        mode: "api";
        options: FrameworkBkndConfig<Env>;
     };

export function createBknd<Env>(config: AdapterModeWithOptions<Env>, env?: Env) {
   let appPromise: Promise<App> | undefined;

   const { mode, options } = config;

   async function getApp(): Promise<App> {
      if (!appPromise) {
         if (mode === "standalone") {
            if (options.adminOptions && !options.serveStatic) {
               $console.warn(
                  "adminOptions provided without serveStatic — admin UI assets may not be served. " +
                     "See `serveStatic`, `serveStaticViaImport`, or add a `package.json` script that runs `bknd copy-assets --out {relative_static_assets_directory_path}`.",
               );
            }
            appPromise = createRuntimeApp(options, env);
         } else {
            appPromise = createFrameworkApp(options, env);
         }
      }
      return appPromise;
   }

   async function getApi(opts?: { headers?: Headers; verify?: boolean }) {
      const app = await getApp();
      if (opts?.verify) {
         const api = app.getApi({ headers: opts.headers });
         await api.verifyAuth();
         return api;
      }
      return app.getApi(opts?.headers ? { headers: opts.headers } : undefined);
   }

   function serve() {
      return async (req: Request) => {
         const app = await getApp();
         return app.fetch(req);
      };
   }

   return { getApp, getApi, serve };
}

/** Utility type to determine the config type based on mode,
 *  Usage `Config<"standalone">` or `Config<"api">`
 */
export type Config<T extends AdapterModeWithOptions["mode"]> = Extract<
   Parameters<typeof createBknd>[0],
   { mode: T }
>['options'];