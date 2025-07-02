/// <reference types="@cloudflare/workers-types" />

import type { RuntimeBkndConfig } from "bknd/adapter";
import { Hono } from "hono";
import { serveStatic } from "hono/cloudflare-workers";
import { getFresh } from "./modes/fresh";
import { getCached } from "./modes/cached";
import { getDurable } from "./modes/durable";
import type { App } from "bknd";
import { $console } from "core/utils";

declare global {
   namespace Cloudflare {
      interface Env {}
   }
}

export type CloudflareEnv = Cloudflare.Env;
export type CloudflareBkndConfig<Env = CloudflareEnv> = RuntimeBkndConfig<Env> & {
   mode?: "warm" | "fresh" | "cache" | "durable";
   bindings?: (args: Env) => {
      kv?: KVNamespace;
      dobj?: DurableObjectNamespace;
      db?: D1Database;
   };
   d1?: {
      session?: boolean;
      transport?: "header" | "cookie";
      first?: D1SessionConstraint;
   };
   static?: "kv" | "assets";
   key?: string;
   keepAliveSeconds?: number;
   forceHttps?: boolean;
   manifest?: string;
   registerMedia?: boolean | ((env: Env) => void);
};

export type Context<Env = CloudflareEnv> = {
   request: Request;
   env: Env;
   ctx: ExecutionContext;
};

export function serve<Env extends CloudflareEnv = CloudflareEnv>(
   config: CloudflareBkndConfig<Env> = {},
) {
   return {
      async fetch(request: Request, env: Env, ctx: ExecutionContext) {
         const url = new URL(request.url);

         if (config.manifest && config.static === "assets") {
            $console.warn("manifest is not useful with static 'assets'");
         } else if (!config.manifest && config.static === "kv") {
            throw new Error("manifest is required with static 'kv'");
         }

         if (config.manifest && config.static === "kv") {
            const pathname = url.pathname.slice(1);
            const assetManifest = JSON.parse(config.manifest);
            if (pathname && pathname in assetManifest) {
               const hono = new Hono();

               hono.all("*", async (c, next) => {
                  const res = await serveStatic({
                     path: `./${pathname}`,
                     manifest: config.manifest!,
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

         const context = { request, env, ctx } as Context<Env>;
         const mode = config.mode ?? "warm";

         let app: App;
         switch (mode) {
            case "fresh":
               app = await getFresh(config, context, { force: true });
               break;
            case "warm":
               app = await getFresh(config, context);
               break;
            case "cache":
               app = await getCached(config, context);
               break;
            case "durable":
               return await getDurable(config, context);
            default:
               throw new Error(`Unknown mode ${mode}`);
         }

         return app.fetch(request, env, ctx);
      },
   };
}
