import { type NuxtBkndConfig, getApp as getNuxtApp } from "bknd/adapter/nuxt";
import bkndConfig from "../../bknd.config";

export async function getApp<Env = NodeJS.ProcessEnv>(
   config: NuxtBkndConfig<Env>,
   args: Env = process.env as Env,
) {
   return await getNuxtApp(config, args);
}

export async function getApi({ headers, verify }: { verify?: boolean; headers?: Headers }) {
   const app = await getApp(bkndConfig, process.env);

   if (verify) {
      const api = app.getApi({ headers });
      await api.verifyAuth();
      return api;
   }

   return app.getApi();
}
