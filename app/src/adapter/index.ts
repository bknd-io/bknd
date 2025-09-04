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
import type { 
  CustomIdHandlerConfig, 
  BkndIdHandlersConfig 
} from "data/fields/types";

// Re-export comprehensive types for better IDE support
export type {
  BkndConfig,
  FrameworkBkndConfig,
  RuntimeBkndConfig,
  CreateAdapterAppOptions,
  FrameworkOptions,
  RuntimeOptions,
  DefaultArgs,
  TypedBkndConfig,
  ExtractConfigArgs,
} from "./types";

// Import the comprehensive BkndConfig type from types module
import type { 
  BkndConfig, 
  FrameworkBkndConfig, 
  RuntimeBkndConfig,
  DefaultArgs,
  CreateAdapterAppOptions,
  FrameworkOptions,
  RuntimeOptions
} from "./types";

// Types are now imported from ./types module and re-exported above

export async function makeConfig<Args extends DefaultArgs = DefaultArgs>(
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
 * Validate the idHandlers configuration from bknd.config.ts.
 * 
 * Performs comprehensive validation of ID handler configurations to ensure
 * they are properly structured and contain all required fields.
 * 
 * @param idHandlers - The ID handlers configuration to validate
 * 
 * @throws {Error} If configuration is invalid with descriptive error messages
 * 
 * @example
 * ```typescript
 * try {
 *   validateIdHandlersConfig(config.idHandlers);
 *   console.log("ID handlers configuration is valid");
 * } catch (error) {
 *   console.error("Configuration error:", error.message);
 * }
 * ```
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
 * Validate a single ID handler configuration.
 * 
 * Checks that the handler configuration has the correct structure,
 * required fields, and valid values for the specified handler type.
 * 
 * @param config - The handler configuration to validate
 * @param context - Context string for error messages (e.g., entity name or "global")
 * 
 * @throws {Error} If the configuration is invalid
 * 
 * @private
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
 * Register custom ID handlers from the bknd configuration.
 * 
 * Processes the idHandlers configuration and registers all defined handlers
 * with the global ID handler registry. Supports both global and per-entity
 * handler configurations.
 * 
 * @template Args - Type for configuration arguments
 * @param config - The bknd configuration containing ID handlers
 * @param app - The App instance for context and logging
 * 
 * @throws {Error} If handler registration fails
 * 
 * @example
 * ```typescript
 * const config: BkndConfig = {
 *   idHandlers: {
 *     users: {
 *       type: "function",
 *       handler: (entity) => `usr_${Date.now()}`
 *     }
 *   }
 * };
 * 
 * await registerIdHandlers(config, app);
 * console.log("ID handlers registered successfully");
 * ```
 */
export async function registerIdHandlers<Args extends DefaultArgs = DefaultArgs>(
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
 * Register a single ID handler with the registry.
 * 
 * Creates an IdHandler object from the configuration and registers it
 * with the provided registry instance.
 * 
 * @param registry - The ID handler registry instance
 * @param handlerId - Unique identifier for the handler
 * @param config - Handler configuration object
 * @param name - Human-readable name for the handler
 * 
 * @throws {Error} If handler registration fails
 * 
 * @private
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
export async function createAdapterApp<Config extends BkndConfig = BkndConfig, Args extends DefaultArgs = DefaultArgs>(
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

export async function createFrameworkApp<Args extends DefaultArgs = DefaultArgs>(
   config: FrameworkBkndConfig<Args> = {} as FrameworkBkndConfig<Args>,
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

export async function createRuntimeApp<Args extends DefaultArgs = DefaultArgs>(
   { serveStatic, adminOptions, ...config }: RuntimeBkndConfig<Args> = {} as RuntimeBkndConfig<Args>,
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
