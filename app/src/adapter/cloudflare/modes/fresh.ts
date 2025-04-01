import { createRuntimeApp, type RuntimeOptions } from "bknd/adapter";
import type { CloudflareBkndConfig, Context, CloudflareEnv } from "../index";
import { makeConfig, registerAsyncsExecutionContext } from "../config";

export async function makeApp<Env extends CloudflareEnv = CloudflareEnv>(
   config: CloudflareBkndConfig<Env>,
   args: Env = {} as Env,
   opts?: RuntimeOptions,
) {
   return await createRuntimeApp<Env>(
      {
         ...makeConfig(config, args),
         adminOptions: config.html ? { html: config.html } : undefined,
      },
      args,
      opts,
   );
}

export async function getWarm<Env extends CloudflareEnv = CloudflareEnv>(
   config: CloudflareBkndConfig<Env>,
   ctx: Context<Env>,
   opts: RuntimeOptions = {},
) {
   const app = await makeApp(
      {
         ...config,
         onBuilt: async (app) => {
            registerAsyncsExecutionContext(app, ctx.ctx);
            config.onBuilt?.(app);
         },
      },
      ctx.env,
      opts,
   );
   return app.fetch(ctx.request);
}

export async function getFresh<Env extends CloudflareEnv = CloudflareEnv>(
   config: CloudflareBkndConfig<Env>,
   ctx: Context<Env>,
   opts: RuntimeOptions = {},
) {
   return await getWarm(config, ctx, {
      ...opts,
      force: true,
   });
}
