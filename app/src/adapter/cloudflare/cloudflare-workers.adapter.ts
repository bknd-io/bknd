/// <reference types="@cloudflare/workers-types" />

import type { RuntimeBkndConfig } from "bknd/adapter";
import { Hono } from "hono";
import { serveStatic } from "hono/cloudflare-workers";
import type { MaybePromise } from "bknd";
import { $console } from "bknd/utils";
import { createRuntimeApp } from "bknd/adapter";
import { registerAsyncsExecutionContext, makeConfig, type CloudflareContext } from "./config";

declare global {
   namespace Cloudflare {
      interface Env {}
   }
}

export type CloudflareEnv = Cloudflare.Env;
export type CloudflareBkndConfig<Env = CloudflareEnv> = RuntimeBkndConfig<Env> & {
   bindings?: (args: Env) => MaybePromise<{
      kv?: KVNamespace;
      db?: D1Database;
   }>;
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

export async function createApp<Env extends CloudflareEnv = CloudflareEnv>(
   config: CloudflareBkndConfig<Env> = {},
   ctx: Partial<CloudflareContext<Env>> = {},
) {
   const appConfig = await makeConfig(config, ctx);
   return await createRuntimeApp<Env>(
      {
         ...appConfig,
         onBuilt: async (app) => {
            if (ctx.ctx) {
               registerAsyncsExecutionContext(app, ctx?.ctx);
            }
            await appConfig.onBuilt?.(app);
         },
      },
      ctx?.env,
   );
}

// compatiblity
export const getFresh = createApp;

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

         const context = { request, env, ctx } as CloudflareContext<Env>;
         const app = await createApp(config, context);

         return app.fetch(request, env, ctx);
      },
   };
}
