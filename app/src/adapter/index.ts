import {
   config as $config,
   App,
   type CreateAppConfig,
   Connection,
   guessMimeType,
   type MaybePromise,
   registries as $registries,
} from "bknd";
import { $console } from "bknd/utils";
import type { Context, MiddlewareHandler, Next } from "hono";
import type { AdminControllerOptions } from "modules/server/AdminController";
import type { Manifest } from "vite";

export type BkndConfig<Args = any> = CreateAppConfig & {
   app?: CreateAppConfig | ((args: Args) => MaybePromise<CreateAppConfig>);
   onBuilt?: (app: App) => Promise<void>;
   beforeBuild?: (app: App, registries?: typeof $registries) => Promise<void>;
   buildConfig?: Parameters<App["build"]>[0];
};

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
): Promise<CreateAppConfig> {
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

// a map that contains all apps by id
const apps = new Map<string, App>();
export async function createAdapterApp<Config extends BkndConfig = BkndConfig, Args = DefaultArgs>(
   config: Config = {} as Config,
   args?: Args,
): Promise<App> {
   const appConfig = await makeConfig(config, args);
   if (!appConfig.connection || !Connection.isConnection(appConfig.connection)) {
      let connection: Connection | undefined;
      if (Connection.isConnection(config.connection)) {
         connection = config.connection;
      } else {
         const sqlite = (await import("bknd/adapter/sqlite")).sqlite;
         const conf = appConfig.connection ?? { url: ":memory:" };
         connection = sqlite(conf) as any;
         $console.info(`Using ${connection!.name} connection`, conf.url);
      }
      appConfig.connection = connection;
   }

   return App.create(appConfig);
}

export async function createFrameworkApp<Args = DefaultArgs>(
   config: FrameworkBkndConfig = {},
   args?: Args,
): Promise<App> {
   const app = await createAdapterApp(config, args);

   if (!app.isBuilt()) {
      if (config.onBuilt) {
         app.emgr.onEvent(
            App.Events.AppBuiltEvent,
            async () => {
               await config.onBuilt?.(app);
            },
            "sync",
         );
      }

      await config.beforeBuild?.(app, $registries);
      await app.build(config.buildConfig);
   }

   return app;
}

export async function createRuntimeApp<Args = DefaultArgs>(
   { serveStatic, adminOptions, ...config }: RuntimeBkndConfig<Args> = {},
   args?: Args,
): Promise<App> {
   const app = await createAdapterApp(config, args);

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

            await config.onBuilt?.(app);
            if (adminOptions !== false) {
               app.registerAdminController(adminOptions);
            }
         },
         "sync",
      );

      await config.beforeBuild?.(app, $registries);
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
export function serveStaticViaImport(opts?: { manifest?: Manifest }) {
   let files: string[] | undefined;

   // @ts-ignore
   return async (c: Context, next: Next) => {
      if (!files) {
         const manifest =
            opts?.manifest || ((await import("bknd/dist/manifest.json")).default as Manifest);
         files = Object.values(manifest).flatMap((asset) => [asset.file, ...(asset.css || [])]);
      }

      const path = c.req.path.substring(1);
      if (files.includes(path)) {
         try {
            const content = await import(/* @vite-ignore */ `bknd/static/${path}?raw`, {
               assert: { type: "text" },
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
            console.error("Error serving static file:", e);
            return c.text("File not found", 404);
         }
      }
      await next();
   };
}
