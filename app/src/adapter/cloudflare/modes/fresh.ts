import { createRuntimeApp, type RuntimeOptions } from "bknd/adapter";
import type { CloudflareBkndConfig, Context, CloudflareEnv } from "../index";
import { makeConfig, registerAsyncsExecutionContext, type CfMakeConfigArgs } from "../config";

export async function makeApp<Env extends CloudflareEnv = CloudflareEnv>(
   config: CloudflareBkndConfig<Env>,
   args?: CfMakeConfigArgs<Env>,
   opts?: RuntimeOptions,
) {
   return await createRuntimeApp<Env>(await makeConfig(config, args), args?.env, opts);
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
      ctx,
      opts,
   );
}
