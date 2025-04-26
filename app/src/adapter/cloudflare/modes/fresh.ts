import { createRuntimeApp, type RuntimeOptions } from "bknd/adapter";
import type { CloudflareBkndConfig, Context, CloudflareEnv } from "../index";
import { makeConfig, registerAsyncsExecutionContext } from "../config";

export async function makeApp<Env extends CloudflareEnv = CloudflareEnv>(
   config: CloudflareBkndConfig<Env>,
   args: Env = {} as Env,
   opts?: RuntimeOptions,
) {
   return await createRuntimeApp<Env>(makeConfig(config, args), args, opts);
}

export async function getFresh<Env extends CloudflareEnv = CloudflareEnv>(
   config: CloudflareBkndConfig<Env>,
   ctx: Context<Env>,
   opts: RuntimeOptions = {},
) {
   return await makeApp(
      {
         ...config,
         onBuilt: async (app) => {
            registerAsyncsExecutionContext(app, ctx.ctx);
            await config.onBuilt?.(app);
         },
      },
      ctx.env,
      opts,
   );
}
