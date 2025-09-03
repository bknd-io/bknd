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
import type { CustomIdHandlerConfig } from "data/fields/PrimaryField";

export type BkndConfig<Args = any> = CreateAppConfig & {
   app?: CreateAppConfig | ((args: Args) => MaybePromise<CreateAppConfig>);
   onBuilt?: (app: App) => Promise<void>;
   beforeBuild?: (app: App, registries?: typeof $registries) => Promise<void>;
   buildConfig?: Parameters<App["build"]>[0];
   
   /** Custom ID handlers configuration - can be global or per-entity */
   idHandlers?: {
      [entityName: string]: CustomIdHandlerConfig;
   } | CustomIdHandlerConfig;
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

export async function makeConfig<Args = DefaultArgs>(
   config: BkndConfig<Args>,
   args?: Args,
): Promise<CreateAppConfig> {
   let additionalConfig: CreateAppConfig = {};
   const { app, idHandlers, ...rest } = config;
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

   // Validate idHandlers configuration if present
   if (idHandlers) {
      validateIdHandlersConfig(idHandlers);
   }

   return { ...rest, ...additionalConfig };
}

/**
 * Validates the idHandlers configuration from bknd.config.ts
 */
function validateIdHandlersConfig(idHandlers: BkndConfig["idHandlers"]): void {
   if (!idHandlers) return;

   // Check if it's a global handler or per-entity handlers
   if (typeof idHandlers === "object" && !Array.isArray(idHandlers)) {
      // Check if it looks like a CustomIdHandlerConfig (has type field)
      if ("type" in idHandlers) {
         // Global handler configuration
         validateSingleHandlerConfig(idHandlers as CustomIdHandlerConfig, "global");
      } else {
         // Per-entity handlers configuration
         for (const [entityName, handlerConfig] of Object.entries(idHandlers)) {
            if (handlerConfig && typeof handlerConfig === "object") {
               validateSingleHandlerConfig(handlerConfig as CustomIdHandlerConfig, entityName);
            }
         }
      }
   }
}

/**
 * Validates a single handler configuration
 */
function validateSingleHandlerConfig(config: CustomIdHandlerConfig, context: string): void {
   if (!config.type || !["function", "import"].includes(config.type)) {
      throw new Error(`Invalid idHandler type for ${context}: must be 'function' or 'import'`);
   }

   if (config.type === "function") {
      if (!config.handler || typeof config.handler !== "function") {
         throw new Error(`Invalid idHandler for ${context}: handler function is required when type is 'function'`);
      }
   } else if (config.type === "import") {
      if (!config.importPath || typeof config.importPath !== "string") {
         throw new Error(`Invalid idHandler for ${context}: importPath is required when type is 'import'`);
      }
      if (config.functionName && typeof config.functionName !== "string") {
         throw new Error(`Invalid idHandler for ${context}: functionName must be a string`);
      }
   }

   // Validate options if present
   if (config.options && (typeof config.options !== "object" || Array.isArray(config.options))) {
      throw new Error(`Invalid idHandler options for ${context}: must be an object`);
   }
}

/**
 * Registers custom ID handlers from the configuration
 */
export async function registerIdHandlers<Args = DefaultArgs>(
   config: BkndConfig<Args>,
   app: App,
): Promise<void> {
   if (!config.idHandlers) return;

   const { idHandlerRegistry } = await import("data/fields/IdHandlerRegistry");

   try {
      // Check if it's a global handler or per-entity handlers
      if (typeof config.idHandlers === "object" && !Array.isArray(config.idHandlers)) {
         // Check if it looks like a CustomIdHandlerConfig (has type field)
         if ("type" in config.idHandlers) {
            // Global handler configuration
            await registerSingleHandler(
               idHandlerRegistry,
               "global",
               config.idHandlers as CustomIdHandlerConfig,
               "Global Custom Handler"
            );
         } else {
            // Per-entity handlers configuration
            for (const [entityName, handlerConfig] of Object.entries(config.idHandlers)) {
               if (handlerConfig && typeof handlerConfig === "object") {
                  await registerSingleHandler(
                     idHandlerRegistry,
                     `config_${entityName}`,
                     handlerConfig as CustomIdHandlerConfig,
                     `${entityName} Config Handler`
                  );
               }
            }
         }
      }

      $console.info("Custom ID handlers registered from configuration");
   } catch (error) {
      $console.error("Failed to register custom ID handlers:", error);
      throw error;
   }
}

/**
 * Registers a single ID handler with the registry
 */
async function registerSingleHandler(
   registry: any,
   handlerId: string,
   config: CustomIdHandlerConfig,
   name: string,
): Promise<void> {
   let handlerFunction: (entity: string, data?: any) => string | number | Promise<string | number>;

   if (config.type === "function") {
      if (!config.handler) {
         throw new Error(`Handler function is required for ${handlerId}`);
      }
      handlerFunction = config.handler;
   } else if (config.type === "import") {
      // For import-based handlers, we'll implement this in a future task
      // For now, throw an error to indicate it's not yet supported
      throw new Error(`Import-based handlers are not yet implemented for ${handlerId}. This will be added in task 10.`);
   } else {
      throw new Error(`Invalid handler type for ${handlerId}: ${config.type}`);
   }

   // Create the IdHandler object
   const idHandler = {
      id: handlerId,
      name,
      handler: handlerFunction,
      description: `Custom ID handler configured in bknd.config.ts`,
      validate: (validationConfig: any) => {
         // Basic validation - can be extended later
         return true;
      },
   };

   // Register with the registry
   registry.register(handlerId, idHandler);
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

      app = App.create(appConfig);

      if (!opts?.force) {
         apps.set(id, app);
      }
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

      // Register custom ID handlers before building the app
      await registerIdHandlers(config, app);
      await config.beforeBuild?.(app, $registries);
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

      // Register custom ID handlers before building the app
      await registerIdHandlers(config, app);
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
