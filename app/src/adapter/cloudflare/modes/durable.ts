import { DurableObject } from "cloudflare:workers";
import { App, type CreateAppConfig } from "bknd";
import { createRuntimeApp, makeConfig } from "bknd/adapter";
import { type CloudflareBkndConfig, type Context, constants } from "../index";

export async function getDurable(config: CloudflareBkndConfig, ctx: Context) {
   const { dobj } = config.bindings?.(ctx.env)!;
   if (!dobj) throw new Error("durable object is not defined in cloudflare.bindings");
   const key = config.key ?? "app";

   if ([config.onBuilt, config.beforeBuild].some((x) => x)) {
      console.log("onBuilt and beforeBuild are not supported with DurableObject mode");
   }

   const start = performance.now();

   const id = dobj.idFromName(key);
   const stub = dobj.get(id) as unknown as DurableBkndApp;

   const create_config = makeConfig(config, ctx);

   const res = await stub.fire(ctx.request, {
      config: create_config,
      html: config.html,
      keepAliveSeconds: config.keepAliveSeconds,
      setAdminHtml: config.setAdminHtml,
   });

   const headers = new Headers(res.headers);
   headers.set("X-TTDO", String(performance.now() - start));

   return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
   });
}

export class DurableBkndApp extends DurableObject {
   protected id = Math.random().toString(36).slice(2);
   protected app?: App;
   protected interval?: any;

   async fire(
      request: Request,
      options: {
         config: CreateAppConfig;
         html?: string;
         keepAliveSeconds?: number;
         setAdminHtml?: boolean;
      },
   ) {
      let buildtime = 0;
      if (!this.app) {
         const start = performance.now();
         const config = options.config;

         // change protocol to websocket if libsql
         if (
            config?.connection &&
            "type" in config.connection &&
            config.connection.type === "libsql"
         ) {
            config.connection.config.protocol = "wss";
         }

         this.app = await createRuntimeApp({
            ...config,
            onBuilt: async (app) => {
               app.emgr.onEvent(
                  App.Events.AppBeforeResponse,
                  async (event) => {
                     this.ctx.waitUntil(event.params.app.emgr.executeAsyncs());
                  },
                  {
                     mode: "sync",
                     id: constants.exec_async_event_id,
                  },
               );
               app.modules.server.get(constants.do_endpoint, async (c) => {
                  // @ts-ignore
                  const context: any = c.req.raw.cf ? c.req.raw.cf : c.env.cf;
                  return c.json({
                     id: this.id,
                     keepAliveSeconds: options?.keepAliveSeconds ?? 0,
                     colo: context.colo,
                  });
               });

               await this.onBuilt(app);
            },
            adminOptions: { html: options.html },
            beforeBuild: async (app) => {
               await this.beforeBuild(app);
            },
         });

         buildtime = performance.now() - start;
      }

      if (options?.keepAliveSeconds) {
         this.keepAlive(options.keepAliveSeconds);
      }

      const res = await this.app!.fetch(request);
      const headers = new Headers(res.headers);
      headers.set("X-BuildTime", buildtime.toString());
      headers.set("X-DO-ID", this.id);

      return new Response(res.body, {
         status: res.status,
         statusText: res.statusText,
         headers,
      });
   }

   async onBuilt(app: App) {}
   async beforeBuild(app: App) {}

   protected keepAlive(seconds: number) {
      if (this.interval) {
         clearInterval(this.interval);
      }

      let i = 0;
      this.interval = setInterval(() => {
         i += 1;
         if (i === seconds) {
            console.log("cleared");
            clearInterval(this.interval);

            // ping every 30 seconds
         } else if (i % 30 === 0) {
            console.log("ping");
            this.app?.modules.ctx().connection.ping();
         }
      }, 1000);
   }
}
