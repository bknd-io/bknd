/// <reference types="bun-types" />

import path from "node:path";
import { type RuntimeBkndConfig, createRuntimeApp, type RuntimeOptions } from "bknd/adapter";
import { registerLocalMediaAdapter } from ".";
import { config } from "bknd/core";
import type { ServeOptions } from "bun";
import { serveStatic } from "hono/bun";
import type { App } from "App";

type BunEnv = Bun.Env;
export type BunBkndConfig<Env = BunEnv> = RuntimeBkndConfig<Env> & Omit<ServeOptions, "fetch">;

export async function createApp<Env = BunEnv>(
   { distPath, ...config }: BunBkndConfig<Env> = {},
   args: Env = {} as Env,
   opts?: RuntimeOptions,
) {
   const root = path.resolve(distPath ?? "./node_modules/bknd/dist", "static");
   registerLocalMediaAdapter();

   return await createRuntimeApp(
      {
         ...config,
         serveStatic: serveStatic({ root }),
      },
      args ?? (process.env as Env),
      opts,
   );
}

export function createHandler<Env = BunEnv>(
   config: BunBkndConfig<Env> = {},
   args: Env = {} as Env,
   opts?: RuntimeOptions,
) {
   let app: App | undefined;
   return async (req: Request) => {
      if (!app) {
         app = await createApp(config, args ?? (process.env as Env), opts);
      }
      return app.fetch(req);
   };
}

export function serve<Env = BunEnv>(
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
   }: BunBkndConfig<Env> = {},
   args: Env = {} as Env,
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
         args,
         opts,
      ),
   });

   console.info(`Server is running on http://localhost:${port}`);
}
