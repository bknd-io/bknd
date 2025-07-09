import { createFrameworkApp } from "bknd/adapter";
import config from "../bknd.config";

export async function getApp() {
   return await createFrameworkApp(config, process.env, {
      force: import.meta.env && !import.meta.env.PROD,
   });
}

export async function getApi(opts?: {
   headers?: Headers | any;
   verify?: boolean;
}) {
   const app = await getApp();
   if (opts?.verify && opts.headers) {
      const api = app.getApi({ headers: opts.headers });
      await api.verifyAuth();
      return api;
   }

   return app.getApi();
}
