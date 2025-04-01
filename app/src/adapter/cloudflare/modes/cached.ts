import { App } from "bknd";
import { createRuntimeApp } from "bknd/adapter";
import type { CloudflareBkndConfig, Context, CloudflareEnv } from "../index";
import { makeConfig, registerAsyncsExecutionContext, constants } from "../config";

export async function getCached<Env extends CloudflareEnv = CloudflareEnv>(
   config: CloudflareBkndConfig<Env>,
   { env, ctx, ...args }: Context<Env>,
) {
   const { kv } = config.bindings?.(env)!;
   if (!kv) throw new Error("kv namespace is not defined in cloudflare.bindings");
   const key = config.key ?? "app";

   const cachedConfig = await kv.get(key);
   const initialConfig = cachedConfig ? JSON.parse(cachedConfig) : undefined;

   async function saveConfig(__config: any) {
      ctx.waitUntil(kv!.put(key, JSON.stringify(__config)));
   }

   const app = await createRuntimeApp(
      {
         ...makeConfig(config, env),
         initialConfig,
         onBuilt: async (app) => {
            registerAsyncsExecutionContext(app, ctx);
            app.module.server.client.get(constants.cache_endpoint, async (c) => {
               await kv.delete(key);
               return c.json({ message: "Cache cleared" });
            });
            await config.onBuilt?.(app);
         },
         beforeBuild: async (app) => {
            app.emgr.onEvent(
               App.Events.AppConfigUpdatedEvent,
               async ({ params: { app } }) => {
                  saveConfig(app.toJSON(true));
               },
               "sync",
            );
            await config.beforeBuild?.(app);
         },
         adminOptions: { html: config.html },
      },
      { env, ctx, ...args },
   );

   if (!cachedConfig) {
      saveConfig(app.toJSON(true));
   }

   return app;
}
