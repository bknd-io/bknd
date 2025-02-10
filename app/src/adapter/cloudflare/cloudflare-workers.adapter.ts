/// <reference types="@cloudflare/workers-types" />

import { type FrameworkBkndConfig, makeConfig } from "bknd/adapter";
import { Hono } from "hono";
import { serveStatic } from "hono/cloudflare-workers";
import { D1Connection } from "./connection/D1Connection";
import { getCached } from "./modes/cached";
import { getDurable } from "./modes/durable";
import { getFresh, getWarm } from "./modes/fresh";

export type CloudflareBkndConfig<Env = any> = FrameworkBkndConfig<Context<Env>> & {
   mode?: "warm" | "fresh" | "cache" | "durable";
   bindings?: (args: Context<Env>) => {
      kv?: KVNamespace;
      dobj?: DurableObjectNamespace;
      db?: D1Database;
   };
   static?: "kv" | "assets";
   key?: string;
   keepAliveSeconds?: number;
   forceHttps?: boolean;
   manifest?: string;
   setAdminHtml?: boolean;
   html?: string;
};

export type Context<Env = any> = {
   request: Request;
   env: Env;
   ctx: ExecutionContext;
};

export function serve<Env = any>(config: CloudflareBkndConfig<Env> = {}) {
   return {
      async fetch(request: Request, env: Env, ctx: ExecutionContext) {
         const url = new URL(request.url);

         if (config.manifest && config.static === "assets") {
            console.warn("manifest is not useful with static 'assets'");
         } else if (!config.manifest && config.static === "kv") {
            throw new Error("manifest is required with static 'kv'");
         }

         if (config.manifest && config.static !== "assets") {
            const pathname = url.pathname.slice(1);
            const assetManifest = JSON.parse(config.manifest);
            if (pathname && pathname in assetManifest) {
               const hono = new Hono();

               hono.all("*", async (c, next) => {
                  const res = await serveStatic({
                     path: `./${pathname}`,
                     manifest: config.manifest!
                  })(c as any, next);
                  if (res instanceof Response) {
                     const ttl = 60 * 60 * 24 * 365;
                     res.headers.set("Cache-Control", `public, max-age=${ttl}`);
                     return res;
                  }

                  return c.notFound();
               });

               return hono.fetch(request, env);
            }
         }

         const context = { request, env, ctx } as Context;
         const mode = config.mode ?? "warm";

         const appConfig = makeConfig(config, context);
         const bindings = config.bindings?.(context);
         if (!appConfig.connection) {
            let db: D1Database | undefined;
            if (bindings && "db" in bindings && bindings.db) {
               console.log("Using database from bindings");
               db = bindings.db;
            } else if (env && Object.keys(env).length > 0) {
               // try to find a database in env
               for (const key in env) {
                  try {
                     // @ts-ignore
                     if (env[key].constructor.name === "D1Database") {
                        console.log(`Using database from env "${key}"`);
                        db = env[key] as D1Database;
                        break;
                     }
                  } catch (e) {}
               }
            }

            if (db) {
               appConfig.connection = new D1Connection({ binding: db });
            } else {
               throw new Error("No database connection given");
            }
         }

         switch (mode) {
            case "fresh":
               return await getFresh(appConfig, context);
            case "warm":
               return await getWarm(appConfig, context);
            case "cache":
               return await getCached(appConfig, context);
            case "durable":
               return await getDurable(appConfig, context);
            default:
               throw new Error(`Unknown mode ${mode}`);
         }
      }
   };
}
