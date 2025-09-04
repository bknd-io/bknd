/**
 * @fileoverview TypeScript type definitions for bknd adapter configuration
 * 
 * This module provides comprehensive type definitions for bknd configuration
 * including custom ID handlers, with full IDE autocomplete support.
 * 
 * @author bknd Framework
 * @version 1.0.0
 */

import type { App, CreateAppConfig, MaybePromise } from "bknd";
import type { BkndIdHandlersConfig } from "data/fields/types";

/**
 * Default arguments type for bknd configuration functions.
 * 
 * Can be extended to provide strongly-typed arguments for configuration functions.
 * 
 * @example
 * ```typescript
 * interface MyArgs extends DefaultArgs {
 *   env: {
 *     DATABASE_URL: string;
 *     API_KEY: string;
 *   };
 * }
 * 
 * const config: BkndConfig<MyArgs> = {
 *   app: (args) => ({
 *     connection: { url: args.env.DATABASE_URL }
 *   })
 * };
 * ```
 */
export interface DefaultArgs {
  [key: string]: any;
}

/**
 * Comprehensive bknd configuration interface with full TypeScript support.
 * 
 * Extends the base CreateAppConfig with additional bknd-specific options
 * including custom ID handlers, lifecycle hooks, and build configuration.
 * 
 * @template Args - Type for configuration arguments passed to app function
 * 
 * @example
 * ```typescript
 * // Basic configuration
 * const config: BkndConfig = {
 *   connection: { url: "sqlite:./app.db" },
 *   idHandlers: {
 *     users: {
 *       type: "function",
 *       handler: (entity) => `usr_${Date.now()}`
 *     }
 *   }
 * };
 * 
 * // Configuration with typed arguments
 * interface AppArgs {
 *   env: { DATABASE_URL: string };
 * }
 * 
 * const typedConfig: BkndConfig<AppArgs> = {
 *   app: (args) => ({
 *     connection: { url: args.env.DATABASE_URL }
 *   }),
 *   idHandlers: {
 *     type: "function",
 *     handler: (entity) => `${entity}_${Date.now()}`
 *   }
 * };
 * ```
 */
export interface BkndConfig<Args extends DefaultArgs = DefaultArgs> extends CreateAppConfig {
  /**
   * App configuration - can be static config or function returning config.
   * 
   * When provided as a function, it receives the args parameter and can
   * return configuration dynamically based on runtime arguments.
   * 
   * @example
   * ```typescript
   * // Static configuration
   * app: {
   *   connection: { url: "sqlite:./app.db" }
   * }
   * 
   * // Dynamic configuration
   * app: (args) => ({
   *   connection: { url: args.env.DATABASE_URL },
   *   server: { port: args.env.PORT }
   * })
   * ```
   */
  app?: CreateAppConfig | ((args: Args) => MaybePromise<CreateAppConfig>);

  /**
   * Hook called after the app is built and ready.
   * 
   * Use this for post-build initialization, registering additional
   * services, or performing startup tasks.
   * 
   * @param app - The built App instance
   * 
   * @example
   * ```typescript
   * onBuilt: async (app) => {
   *   console.log("App built successfully");
   *   
   *   // Register additional services
   *   app.registerService("myService", new MyService());
   *   
   *   // Perform startup tasks
   *   await initializeExternalServices();
   * }
   * ```
   */
  onBuilt?: (app: App) => Promise<void>;

  /**
   * Hook called before the app build process starts.
   * 
   * Use this for pre-build setup, registering custom handlers,
   * or modifying registries before the build process.
   * 
   * @param app - The App instance before building
   * @param registries - Available registries for customization
   * 
   * @example
   * ```typescript
   * beforeBuild: async (app, registries) => {
   *   // Register custom field types
   *   registries?.fields.register("myField", MyFieldClass);
   *   
   *   // Setup custom middleware
   *   app.use(myCustomMiddleware);
   * }
   * ```
   */
  beforeBuild?: (app: App, registries?: any) => Promise<void>;

  /**
   * Configuration options for the app build process.
   * 
   * @example
   * ```typescript
   * buildConfig: {
   *   skipMigrations: false,
   *   validateSchema: true
   * }
   * ```
   */
  buildConfig?: Parameters<App["build"]>[0];

  /**
   * Custom ID handlers configuration.
   * 
   * Define custom ID generation logic either globally for all entities
   * or on a per-entity basis. Supports both inline functions and
   * imported handlers from external modules.
   * 
   * @example
   * ```typescript
   * // Global handler for all entities
   * idHandlers: {
   *   type: "function",
   *   handler: (entity) => `${entity}_${Date.now()}`
   * }
   * 
   * // Per-entity handlers
   * idHandlers: {
   *   users: {
   *     type: "function", 
   *     handler: (entity, data) => `usr_${data?.id || Date.now()}`
   *   },
   *   products: {
   *     type: "import",
   *     importPath: "./handlers/productId",
   *     functionName: "generateProductId",
   *     options: { prefix: "prod" }
   *   },
   *   orders: {
   *     type: "import",
   *     importPath: "my-id-package"
   *   }
   * }
   * ```
   */
  idHandlers?: BkndIdHandlersConfig;
}

/**
 * Framework-specific bknd configuration type.
 * 
 * Alias for BkndConfig to maintain compatibility with framework-specific
 * naming conventions.
 * 
 * @template Args - Type for configuration arguments
 */
export type FrameworkBkndConfig<Args extends DefaultArgs = DefaultArgs> = BkndConfig<Args>;

/**
 * Runtime bknd configuration with additional runtime-specific options.
 * 
 * Extends BkndConfig with options specific to runtime environments,
 * such as static file serving and admin interface configuration.
 * 
 * @template Args - Type for configuration arguments
 * 
 * @example
 * ```typescript
 * const runtimeConfig: RuntimeBkndConfig = {
 *   connection: { url: "sqlite:./app.db" },
 *   
 *   // Serve static files
 *   serveStatic: ["/assets/*", staticFileHandler],
 *   
 *   // Configure admin interface
 *   adminOptions: {
 *     path: "/admin",
 *     auth: { enabled: true }
 *   },
 *   
 *   // Custom ID handlers
 *   idHandlers: {
 *     users: {
 *       type: "function",
 *       handler: (entity) => `usr_${Date.now()}`
 *     }
 *   }
 * };
 * ```
 */
export interface RuntimeBkndConfig<Args extends DefaultArgs = DefaultArgs> extends BkndConfig<Args> {
  /**
   * Path to the distribution directory for static assets.
   */
  distPath?: string;

  /**
   * Static file serving configuration.
   * 
   * Can be a middleware handler or a tuple of [path, handler].
   */
  serveStatic?: any | [string, any];

  /**
   * Admin interface configuration options.
   * 
   * Set to `false` to disable the admin interface entirely.
   */
  adminOptions?: any | false;
}

/**
 * Options for creating adapter applications.
 */
export interface CreateAdapterAppOptions {
  /**
   * Whether to force creation of a new app instance.
   * 
   * If `false`, will reuse existing app instance with the same ID.
   */
  force?: boolean;

  /**
   * Unique identifier for the app instance.
   * 
   * Used for app instance caching and management.
   */
  id?: string;
}

/**
 * Framework-specific options alias.
 */
export type FrameworkOptions = CreateAdapterAppOptions;

/**
 * Runtime-specific options alias.
 */
export type RuntimeOptions = CreateAdapterAppOptions;

/**
 * Type guard to check if a value is a valid BkndConfig.
 * 
 * @param value - Value to check
 * @returns `true` if the value is a valid BkndConfig
 * 
 * @example
 * ```typescript
 * if (isBkndConfig(someValue)) {
 *   // TypeScript now knows someValue is BkndConfig
 *   console.log(someValue.idHandlers);
 * }
 * ```
 */
export function isBkndConfig(value: any): value is BkndConfig {
  return value && typeof value === "object";
}

/**
 * Utility type to extract the Args type from a BkndConfig.
 * 
 * @example
 * ```typescript
 * type MyConfig = BkndConfig<{ env: { PORT: number } }>;
 * type MyArgs = ExtractConfigArgs<MyConfig>; // { env: { PORT: number } }
 * ```
 */
export type ExtractConfigArgs<T> = T extends BkndConfig<infer Args> ? Args : DefaultArgs;

/**
 * Utility type to create a strongly-typed BkndConfig with specific args.
 * 
 * @template TArgs - The arguments type
 * 
 * @example
 * ```typescript
 * interface MyArgs {
 *   env: {
 *     DATABASE_URL: string;
 *     PORT: number;
 *   };
 * }
 * 
 * type MyConfig = TypedBkndConfig<MyArgs>;
 * 
 * const config: MyConfig = {
 *   app: (args) => ({
 *     connection: { url: args.env.DATABASE_URL }, // args is properly typed
 *     server: { port: args.env.PORT }
 *   })
 * };
 * ```
 */
export type TypedBkndConfig<TArgs extends DefaultArgs> = BkndConfig<TArgs>;

/**
 * Constants for bknd configuration.
 */
export const BKND_CONFIG_CONSTANTS = {
  /**
   * Default app ID for singleton instances.
   */
  DEFAULT_APP_ID: "app",

  /**
   * Default configuration values.
   */
  DEFAULTS: {
    FORCE_NEW_INSTANCE: false,
    ENABLE_ADMIN: true,
    ADMIN_PATH: "/admin",
  },
} as const;