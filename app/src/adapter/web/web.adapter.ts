import {
   createFrameworkApp,
   createRuntimeApp,
   type FrameworkBkndConfig,
} from "bknd/adapter";
import type { AdminControllerOptions } from "modules/server/AdminController";
import type { App } from "App";

export type WebBkndConfig<Env = any> = FrameworkBkndConfig<Env> & {
   adminOptions?: AdminControllerOptions | false;
};

export function createBknd<Env>(config: WebBkndConfig<Env>, args?: Env) {
   let appPromise: Promise<App> | undefined;

   const { adminOptions, ...frameworkConfig } = config;

   async function getApp() {
      if (!appPromise) {
         if (adminOptions != null) {
            appPromise = createRuntimeApp({ ...frameworkConfig, adminOptions }, args);
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
