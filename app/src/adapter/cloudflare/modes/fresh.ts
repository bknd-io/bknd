import { createRuntimeApp, type RuntimeOptions } from "bknd/adapter";
import type { CloudflareBkndConfig, Context } from "../index";
import { makeConfig } from "../config";

export async function makeApp(config: CloudflareBkndConfig, ctx: Context, opts?: RuntimeOptions) {
   return await createRuntimeApp<Context>(
      {
         ...makeConfig(config, ctx),
         adminOptions: config.html ? { html: config.html } : undefined,
      },
      ctx,
      opts,
   );
}

export async function getFresh(
   config: CloudflareBkndConfig,
   ctx: Context,
   opts: RuntimeOptions = {},
) {
   const app = await makeApp(config, ctx, {
      ...opts,
      force: true,
   });
   return app.fetch(ctx.request);
}

export async function getWarm(
   config: CloudflareBkndConfig,
   ctx: Context,
   opts: RuntimeOptions = {},
) {
   const app = await makeApp(config, ctx, {
      ...opts,
      force: false,
   });
   return app.fetch(ctx.request);
}
