import {
   config as $config,
   App,
   type CreateAppConfig,
   Connection,
   guessMimeType,
   type MaybePromise,
   registries as $registries,
   type Merge,
} from "bknd";
import { $console } from "bknd/utils";
import type { Context, MiddlewareHandler, Next } from "hono";
import type { AdminControllerOptions } from "modules/server/AdminController";
import type { Manifest } from "vite";

export type BkndConfig<Args = any, Additional = {}> = Merge<
   CreateAppConfig &
      Omit<Additional, "app"> & {
         app?:
            | Omit<BkndConfig<Args, Additional>, "app">
            | ((args: Args) => MaybePromise<Omit<BkndConfig<Args, Additional>, "app">>);
         onBuilt?: (app: App) => MaybePromise<void>;
         beforeBuild?: (app?: App, registries?: typeof $registries) => MaybePromise<void>;
         buildConfig?: Parameters<App["build"]>[0];
      }
>;

export type FrameworkBkndConfig<Args = any> = BkndConfig<Args>;

export type RuntimeBkndConfig<Args = any> = BkndConfig<Args> & {
   distPath?: string;
   serveStatic?: MiddlewareHandler | [string, MiddlewareHandler];
   adminOptions?: AdminControllerOptions | false;
};

export type DefaultArgs = {
   [key: string]: any;
};

export async function makeConfig<Args = DefaultArgs>(
   config: BkndConfig<Args>,
   args?: Args,
): Promise<Omit<BkndConfig<Args>, "app">> {
   let additionalConfig: CreateAppConfig = {};
   const { app, ...rest } = config;
   if (app) {
      if (typeof app === "function") {
         if (!args) {
            throw new Error("args is required when config.app is a function");
         }
         additionalConfig = await app(args);
      } else {
         additionalConfig = app;
      }
   }

   return { ...rest, ...additionalConfig };
}

export async function createAdapterApp<Config extends BkndConfig = BkndConfig, Args = DefaultArgs>(
   config: Config = {} as Config,
   args?: Args,
): Promise<{ app: App; config: BkndConfig<Args> }> {
   await config.beforeBuild?.(undefined, $registries);

   const appConfig = await makeConfig(config, args);
   if (!appConfig.connection || !Connection.isConnection(appConfig.connection)) {
      let connection: Connection | undefined;
      if (Connection.isConnection(config.connection)) {
         connection = config.connection;
      } else {
         if (connection) {
            $console.warn(
               "Connection is not a valid connection object, using default SQLite connection",
            );
         }
         const sqlite = (await import("bknd/adapter/sqlite")).sqlite;
         const conf = appConfig.connection ?? { url: "file:data.db" };
         connection = sqlite(conf) as any;
         $console.info(`Using ${connection!.name} connection`, conf.url);
      }
      appConfig.connection = connection;
   }

   return {
      app: App.create(appConfig),
      config: appConfig,
   };
}

export async function createFrameworkApp<Args = DefaultArgs>(
   config: FrameworkBkndConfig = {},
   args?: Args,
): Promise<App> {
   const { app, config: appConfig } = await createAdapterApp(config, args);

   if (!app.isBuilt()) {
      if (config.onBuilt) {
         app.emgr.onEvent(
            App.Events.AppBuiltEvent,
            async () => {
               await appConfig.onBuilt?.(app);
            },
            "sync",
         );
      }

      await appConfig.beforeBuild?.(app, $registries);
      await app.build(config.buildConfig);
   }

   return app;
}

export async function createRuntimeApp<Args = DefaultArgs>(
   { serveStatic, adminOptions, ...config }: RuntimeBkndConfig<Args> = {},
   args?: Args,
): Promise<App> {
   const { app, config: appConfig } = await createAdapterApp(config, args);

   if (!app.isBuilt()) {
      app.emgr.onEvent(
         App.Events.AppBuiltEvent,
         async () => {
            if (serveStatic) {
               const [path, handler] = Array.isArray(serveStatic)
                  ? serveStatic
                  : [$config.server.assets_path + "*", serveStatic];
               app.modules.server.get(path, handler);
            }

            await appConfig.onBuilt?.(app);
            if (adminOptions !== false) {
               app.registerAdminController(adminOptions);
            }
         },
         "sync",
      );

      await appConfig.beforeBuild?.(app, $registries);
      await app.build(config.buildConfig);
   }

   return app;
}

/**
 * Creates a middleware handler to serve static assets via dynamic imports.
 * This is useful for environments where filesystem access is limited but bundled assets can be imported.
 *
 * @param manifest - Vite manifest object containing asset information
 * @returns Hono middleware handler for serving static assets
 *
 * @example
 * ```typescript
 * import { serveStaticViaImport } from "bknd/adapter";
 *
 * serve({
 *   serveStatic: serveStaticViaImport(),
 * });
 * ```
 */
export function serveStaticViaImport(opts?: {
   manifest?: Manifest;
   appendRaw?: boolean;
   package?: string;
}) {
   let files: string[] | undefined;
   const pkg = opts?.package ?? "bknd";

   // @ts-ignore
   return async (c: Context, next: Next) => {
      if (!files) {
         const manifest =
            opts?.manifest ||
            ((
               await import(/* @vite-ignore */ `${pkg}/dist/manifest.json`, {
                  with: { type: "json" },
               })
            ).default as Manifest);
         files = Object.values(manifest).flatMap((asset) => [asset.file, ...(asset.css || [])]);
      }

      const path = c.req.path.substring(1);
      if (files.includes(path)) {
         try {
            const url = `${pkg}/static/${path}${opts?.appendRaw ? "?raw" : ""}`;
            const content = await import(/* @vite-ignore */ url, {
               with: { type: "text" },
            }).then((m) => m.default);

            if (content) {
               return c.body(content, {
                  headers: {
                     "Content-Type": guessMimeType(path),
                     "Cache-Control": "public, max-age=31536000, immutable",
                  },
               });
            }
         } catch (e) {
            console.error(`Error serving static file "${path}":`, String(e));
            return c.text("File not found", 404);
         }
      }
      await next();
   };
}
