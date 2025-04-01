import { App } from "bknd";
import { createRuntimeApp } from "bknd/adapter";
import { type CloudflareBkndConfig, constants, type Context, makeCfConfig } from "../index";

export async function getCached(config: CloudflareBkndConfig, { env, ctx, ...args }: Context) {
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
         ...makeCfConfig(config, { env, ctx, ...args }),
         initialConfig,
         onBuilt: async (app) => {
            app.module.server.client.get(constants.cache_endpoint, async (c) => {
               await kv.delete(key);
               return c.json({ message: "Cache cleared" });
            });
            await config.onBuilt?.(app);
         },
         beforeBuild: async (app) => {
            app.emgr.onEvent(
               App.Events.AppBeforeResponse,
               async (event) => {
                  ctx.waitUntil(event.params.app.emgr.executeAsyncs());
               },
               {
                  mode: "sync",
                  id: constants.exec_async_event_id,
               },
            );
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
