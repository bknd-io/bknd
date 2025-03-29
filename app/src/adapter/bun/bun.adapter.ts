/// <reference types="bun-types" />

import path from "node:path";
import { type RuntimeBkndConfig, createRuntimeApp, type RuntimeOptions } from "bknd/adapter";
import { registerLocalMediaAdapter } from "bknd/adapter/node";
import { config } from "bknd/core";
import type { ServeOptions } from "bun";
import { serveStatic } from "hono/bun";

export type BunArgs = {
   env: Bun.Env;
};
export type BunBkndConfig<Args = BunArgs> = RuntimeBkndConfig<Args> & Omit<ServeOptions, "fetch">;

export async function createApp<Args = BunArgs>(
   { distPath, ...config }: BunBkndConfig<Args> = {},
   args?: Args,
   opts?: RuntimeOptions,
) {
   const root = path.resolve(distPath ?? "./node_modules/bknd/dist", "static");
   registerLocalMediaAdapter();

   return await createRuntimeApp(
      {
         ...config,
         serveStatic: serveStatic({ root }),
      },
      args,
      opts,
   );
}

export function createHandler<Args = BunArgs>(
   config: BunBkndConfig<Args> = {},
   args?: Args,
   opts?: RuntimeOptions,
) {
   return async (req: Request) => {
      const app = await createApp(config, args ?? ({ env: process.env } as Args), opts);
      return app.fetch(req);
   };
}

export function serve<Args = BunArgs>(
   {
      distPath,
      connection,
      initialConfig,
      options,
      port = config.server.default_port,
      onBuilt,
      buildConfig,
      adminOptions,
      ...serveOptions
   }: BunBkndConfig<Args> = {},
   args?: Args,
   opts?: RuntimeOptions,
) {
   Bun.serve({
      ...serveOptions,
      port,
      fetch: createHandler(
         {
            connection,
            initialConfig,
            options,
            onBuilt,
            buildConfig,
            adminOptions,
            distPath,
         },
         args ?? { env: process.env },
         opts,
      ),
   });

   console.log(`Server is running on http://localhost:${port}`);
}
