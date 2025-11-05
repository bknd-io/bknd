import path from "node:path";
import { type RuntimeBkndConfig, createRuntimeApp } from "bknd/adapter";
import { registerLocalMediaAdapter } from ".";
import { config, type App } from "bknd";
import { serveStatic } from "hono/bun";

type BunEnv = Bun.Env;
export type BunBkndConfig<Env = BunEnv> = RuntimeBkndConfig<Env> &
   Omit<Bun.Serve.Options<undefined, string>, "fetch">;

export async function createApp<Env = BunEnv>(
   { distPath, serveStatic: _serveStatic, ...config }: BunBkndConfig<Env> = {},
   args: Env = Bun.env as Env,
) {
   const root = path.resolve(distPath ?? "./node_modules/bknd/dist", "static");
   registerLocalMediaAdapter();

   return await createRuntimeApp(
      {
         serveStatic:
            _serveStatic ??
            serveStatic({
               root,
            }),
         ...config,
      },
      args,
   );
}

export function createHandler<Env = BunEnv>(
   config: BunBkndConfig<Env> = {},
   args: Env = Bun.env as Env,
) {
   let app: App | undefined;
   return async (req: Request) => {
      if (!app) {
         app = await createApp(config, args);
      }
      return app.fetch(req);
   };
}

export function serve<Env = BunEnv>(
   {
      distPath,
      connection,
      config: _config,
      options,
      port = config.server.default_port,
      onBuilt,
      buildConfig,
      adminOptions,
      serveStatic,
      beforeBuild,
      ...serveOptions
   }: BunBkndConfig<Env> = {},
   args: Env = Bun.env as Env,
) {
   Bun.serve({
      ...(serveOptions as any),
      port,
      fetch: createHandler(
         {
            connection,
            config: _config,
            options,
            onBuilt,
            buildConfig,
            adminOptions,
            distPath,
            serveStatic,
            beforeBuild,
         },
         args,
      ),
   });

   console.info(`Server is running on http://localhost:${port}`);
}
