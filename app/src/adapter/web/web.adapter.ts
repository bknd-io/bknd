import {
   createFrameworkApp,
   createRuntimeApp,
   type FrameworkBkndConfig,
} from "bknd/adapter";
import type { AdminControllerOptions } from "modules/server/AdminController";
import type { App } from "App";
import type { MiddlewareHandler } from "hono";
import { $console } from "bknd/utils";

export type WebBkndConfig<Env = Record<string, string | undefined>> = FrameworkBkndConfig<Env> & {
   /**
    * Serve the admin UI from the server. When omitted, render the admin UI
    * client-side via `import { Admin } from "bknd/ui"` and `import "bknd/dist/styles.css"`.
    *
    * When provided, also set up static asset serving via one of:
    * - `serveStatic` middleware (for Bun, Node, etc.)
    * - `bknd copy-assets --out <static-dir>` postinstall script
    * - `serveStaticViaImport()` from `bknd/adapter` (for edge/serverless)
    */
   adminOptions?: AdminControllerOptions;
   /** Hono middleware for serving bknd's bundled JS/CSS assets. */
   serveStatic?: MiddlewareHandler | [string, MiddlewareHandler];
   /** Override the path to bknd's dist folder (default: ./node_modules/bknd/dist) */
   distPath?: string;
};

export function createBknd<Env>(config: WebBkndConfig<Env>, args?: Env) {
   let appPromise: Promise<App> | undefined;

   const { adminOptions, serveStatic, distPath, ...frameworkConfig } = config;

   async function getApp() {
      if (!appPromise) {
         if (adminOptions != null) {
            if (!serveStatic) {
               $console.warn(
                  "adminOptions provided without serveStatic — admin UI assets may not be served. "
                  + "See serveStatic, bknd copy-assets, or serveStaticViaImport.",
               );
            }
            appPromise = createRuntimeApp(
               { ...frameworkConfig, adminOptions, serveStatic, distPath },
               args,
            );
         } else {
            appPromise = createFrameworkApp(frameworkConfig, args);
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
      return app.getApi();
   }

   function serve() {
      return async (req: Request) => {
         const app = await getApp();
         return app.fetch(req);
      };
   }

   return { getApp, getApi, serve };
}
