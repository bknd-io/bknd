import { App, type CreateAppConfig } from "bknd";
import { config as $config } from "bknd/core";
import { $console } from "bknd/utils";
import type { MiddlewareHandler } from "hono";
import type { AdminControllerOptions } from "modules/server/AdminController";
import { Connection } from "bknd/data";

export { Connection } from "bknd/data";

export type BkndConfig<Args = any> = CreateAppConfig & {
   app?: CreateAppConfig | ((args: Args) => CreateAppConfig);
   onBuilt?: (app: App) => Promise<void>;
   beforeBuild?: (app: App) => Promise<void>;
   buildConfig?: Parameters<App["build"]>[0];
};

export type FrameworkBkndConfig<Args = any> = BkndConfig<Args>;

export type CreateAdapterAppOptions = {
   force?: boolean;
   id?: string;
};
export type FrameworkOptions = CreateAdapterAppOptions;
export type RuntimeOptions = CreateAdapterAppOptions;

export type RuntimeBkndConfig<Args = any> = BkndConfig<Args> & {
   distPath?: string;
   serveStatic?: MiddlewareHandler | [string, MiddlewareHandler];
   adminOptions?: AdminControllerOptions | false;
};

export type DefaultArgs = {
   [key: string]: any;
};

export function makeConfig<Args = DefaultArgs>(
   config: BkndConfig<Args>,
   args?: Args,
): CreateAppConfig {
   let additionalConfig: CreateAppConfig = {};
   const { app, ...rest } = config;
   if (app) {
      if (typeof app === "function") {
         if (!args) {
            throw new Error("args is required when config.app is a function");
         }
         additionalConfig = app(args);
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
   opts?: CreateAdapterAppOptions,
): Promise<App> {
   const id = opts?.id ?? "app";
   let app = apps.get(id);
   if (!app || opts?.force) {
      const appConfig = makeConfig(config, args);
      if (!appConfig.connection || !Connection.isConnection(appConfig.connection)) {
         let connection: Connection | undefined;
         if (Connection.isConnection(config.connection)) {
            connection = config.connection;
         } else {
            const sqlite = (await import("bknd/adapter/sqlite")).sqlite;
            const conf = appConfig.connection ?? { url: ":memory:" };
            connection = sqlite(conf);
            $console.info(`Using ${connection.name} connection`, conf.url);
         }
         appConfig.connection = connection;
      }

      app = App.create(appConfig);
      apps.set(id, app);
   }
   return app;
}

export async function createFrameworkApp<Args = DefaultArgs>(
   config: FrameworkBkndConfig = {},
   args?: Args,
   opts?: FrameworkOptions,
): Promise<App> {
   const app = await createAdapterApp(config, args, opts);

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

      await config.beforeBuild?.(app);
      await app.build(config.buildConfig);
   }

   return app;
}

export async function createRuntimeApp<Args = DefaultArgs>(
   { serveStatic, adminOptions, ...config }: RuntimeBkndConfig<Args> = {},
   args?: Args,
   opts?: RuntimeOptions,
): Promise<App> {
   const app = await createAdapterApp(config, args, opts);

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

      await config.beforeBuild?.(app);
      await app.build(config.buildConfig);
   }

   return app;
}
