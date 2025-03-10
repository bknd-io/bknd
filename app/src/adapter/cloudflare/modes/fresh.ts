import type { App } from "bknd";
import { createRuntimeApp } from "bknd/adapter";
import { type CloudflareBkndConfig, type Context, makeCfConfig } from "../index";

export async function makeApp(config: CloudflareBkndConfig, ctx: Context) {
   return await createRuntimeApp(
      {
         ...makeCfConfig(config, ctx),
         adminOptions: config.html ? { html: config.html } : undefined,
      },
      ctx,
   );
}

export async function getFresh(config: CloudflareBkndConfig, ctx: Context) {
   const app = await makeApp(config, ctx);
   return app.fetch(ctx.request);
}

let warm_app: App;
export async function getWarm(config: CloudflareBkndConfig, ctx: Context) {
   if (!warm_app) {
      warm_app = await makeApp(config, ctx);
   }

   return warm_app.fetch(ctx.request);
}
