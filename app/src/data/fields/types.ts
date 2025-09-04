/**
 * @fileoverview TypeScript type definitions for custom ID generation system
 * 
 * This module provides comprehensive type definitions for the custom ID generation
 * feature in bknd, including handler configurations, validation results, and
 * registry interfaces.
 * 
 * @author bknd Framework
 * @version 1.0.0
 */

/**
 * Supported types for custom ID handler configuration.
 * 
 * - `function`: Direct function handler defined inline
 * - `import`: External handler imported from a module
 */
export type CustomIdHandlerType = "function" | "import";

/**
 * Primary field format types including the new custom format.
 * 
 * - `integer`: Auto-incrementing integer IDs
 * - `uuid`: UUID v7 generation
 * - `custom`: Custom ID generation using handlers
 */
export type TPrimaryFieldFormat = "integer" | "uuid" | "custom";

/**
 * Configuration interface for custom ID generation handlers.
 * 
 * This interface defines how custom ID handlers can be configured either
 * through direct function assignment or by importing external modules.
 * 
 * @example
 * ```typescript
 * // Function-based handler
 * const functionHandler: CustomIdHandlerConfig = {
 *   type: "function",
 *   handler: (entity: string) => `${entity}_${Date.now()}`
 * };
 * 
 * // Import-based handler
 * const importHandler: CustomIdHandlerConfig = {
 *   type: "import",
 *   importPath: "./handlers/customId",
 *   functionName: "generateId",
 *   options: { prefix: "usr" }
 * };
 * ```
 */
export interface CustomIdHandlerConfig {
  /**
   * The type of handler configuration.
   * 
   * - `function`: Use a direct function handler
   * - `import`: Import handler from external module
   */
  type: CustomIdHandlerType;

  /**
   * Direct function handler for ID generation.
   * 
   * Required when `type` is "function". The function receives the entity name
   * and optional data, and should return a string or number ID.
   * 
   * @param entity - The name of the entity for which to generate an ID
   * @param data - Optional data that can be used in ID generation
   * @returns The generated ID as string or number, or a Promise resolving to one
   */
  handler?: (entity: string, data?: any) => string | number | Promise<string | number>;

  /**
   * Path to the module containing the ID handler function.
   * 
   * Required when `type` is "import". Can be a relative path, absolute path,
   * or npm package name.
   * 
   * @example
   * ```typescript
   * importPath: "./handlers/customId"        // Relative path
   * importPath: "/path/to/handlers/customId" // Absolute path
   * importPath: "my-id-package"              // NPM package
   * ```
   */
  importPath?: string;

  /**
   * Name of the function to import from the module.
   * 
   * Optional when `type` is "import". If not provided, the default export
   * will be used, or the system will attempt to auto-detect the handler function.
   * 
   * @example
   * ```typescript
   * functionName: "generateCustomId"  // Named export
   * functionName: undefined           // Use default export
   * ```
   */
  functionName?: string;

  /**
   * Additional options to pass to the handler function.
   * 
   * These options will be merged with the data parameter when calling
   * the handler function, allowing for flexible configuration.
   * 
   * @example
   * ```typescript
   * options: {
   *   prefix: "usr",
   *   suffix: "prod",
   *   length: 8
   * }
   * ```
   */
  options?: Record<string, any>;
}

/**
 * Interface defining a custom ID generation handler.
 * 
 * This interface represents a registered ID handler that can be used
 * to generate custom IDs for entities. Handlers are registered in the
 * IdHandlerRegistry and can be referenced by their unique ID.
 * 
 * @example
 * ```typescript
 * const prefixedHandler: IdHandler = {
 *   id: "prefixed-id",
 *   name: "Prefixed ID Generator",
 *   description: "Generates IDs with entity-specific prefixes",
 *   handler: (entity: string) => `${entity.slice(0, 3)}_${Date.now()}`,
 *   validate: (config) => config && typeof config === "object"
 * };
 * ```
 */
export interface IdHandler {
  /**
   * Unique identifier for this handler.
   * 
   * Used to reference the handler in configurations and registry operations.
   * Should be unique across all registered handlers.
   * 
   * @example "prefixed-id", "sequential-counter", "uuid-with-timestamp"
   */
  id: string;

  /**
   * Human-readable name for the handler.
   * 
   * Used in UI displays and error messages to identify the handler
   * in a user-friendly way.
   * 
   * @example "Prefixed ID Generator", "Sequential Counter", "UUID with Timestamp"
   */
  name: string;

  /**
   * The actual ID generation function.
   * 
   * This function is called to generate new IDs. It receives the entity name
   * and optional data, and should return a unique identifier.
   * 
   * @param entity - The name of the entity for which to generate an ID
   * @param data - Optional data that can influence ID generation
   * @returns The generated ID as string or number, or a Promise resolving to one
   * 
   * @throws {Error} Should throw descriptive errors for generation failures
   */
  handler: (entity: string, data?: any) => string | number | Promise<string | number>;

  /**
   * Optional validation function for handler configuration.
   * 
   * Called to validate configuration before using the handler.
   * Can return a boolean for simple validation or a string with error details.
   * 
   * @param config - Configuration object to validate
   * @returns `true` if valid, `false` or error message string if invalid
   * 
   * @example
   * ```typescript
   * validate: (config) => {
   *   if (!config.prefix) return "Prefix is required";
   *   if (config.prefix.length < 2) return "Prefix must be at least 2 characters";
   *   return true;
   * }
   * ```
   */
  validate?: (config: any) => boolean | string;

  /**
   * Optional description of what this handler does.
   * 
   * Provides detailed information about the handler's behavior,
   * use cases, and any special considerations.
   * 
   * @example "Generates sequential IDs with entity-specific prefixes. Maintains counters per entity."
   */
  description?: string;
}

/**
 * Result interface for validation operations.
 * 
 * Used throughout the system to provide structured feedback about
 * validation results, including detailed error and warning information.
 * 
 * @example
 * ```typescript
 * const result: ValidationResult = {
 *   valid: false,
 *   errors: ["Handler function is required", "Invalid import path"],
 *   warnings: ["Performance may be impacted by complex logic"]
 * };
 * ```
 */
export interface ValidationResult {
  /**
   * Whether the validation passed successfully.
   * 
   * `true` if validation passed, `false` if there were errors.
   * Warnings do not affect this flag.
   */
  valid: boolean;

  /**
   * Array of error messages from validation.
   * 
   * Errors indicate problems that must be fixed before the
   * configuration can be used successfully.
   */
  errors: string[];

  /**
   * Array of warning messages from validation.
   * 
   * Warnings indicate potential issues or recommendations
   * but do not prevent the configuration from being used.
   */
  warnings: string[];
}

/**
 * Result interface for handler execution operations.
 * 
 * Provides comprehensive information about the execution of an ID handler,
 * including success status, generated value, error details, and performance metrics.
 * 
 * @example
 * ```typescript
 * const result: HandlerExecutionResult = {
 *   success: true,
 *   value: "usr_1234567890",
 *   executionTime: 15,
 *   fallbackUsed: false
 * };
 * ```
 */
export interface HandlerExecutionResult {
  /**
   * Whether the handler execution was successful.
   * 
   * `true` if the handler executed successfully and returned a valid ID,
   * `false` if there was an error during execution.
   */
  success: boolean;

  /**
   * The generated ID value if execution was successful.
   * 
   * Only present when `success` is `true`. Contains the actual ID
   * generated by the handler.
   */
  value?: string | number;

  /**
   * Detailed error information if execution failed.
   * 
   * Only present when `success` is `false` or when there are warnings.
   * Contains structured error information for debugging and user feedback.
   */
  error?: import('./IdHandlerErrorManager').ErrorResult;

  /**
   * Time taken to execute the handler in milliseconds.
   * 
   * Useful for performance monitoring and identifying slow handlers.
   * Includes the total time from start to completion of handler execution.
   */
  executionTime?: number;

  /**
   * Whether a fallback mechanism was used.
   * 
   * `true` if the original handler failed and a fallback (typically UUID)
   * was used to generate the ID. `false` or undefined if the original
   * handler succeeded.
   */
  fallbackUsed?: boolean;
}

/**
 * Interface for the ID Handler Registry.
 * 
 * Defines the contract for managing custom ID handlers, including
 * registration, retrieval, validation, and execution operations.
 * 
 * @example
 * ```typescript
 * // Register a handler
 * registry.register("my-handler", {
 *   id: "my-handler",
 *   name: "My Custom Handler",
 *   handler: (entity) => `${entity}_${Date.now()}`
 * });
 * 
 * // Execute a handler
 * const result = await registry.execute("my-handler", "users", { userId: 123 });
 * ```
 */
export interface IdHandlerRegistryInterface {
  /**
   * Register a new ID handler in the registry.
   * 
   * @param id - Unique identifier for the handler
   * @param handler - The handler configuration object
   * @returns The registry instance for method chaining
   * 
   * @throws {Error} If a handler with the same ID is already registered
   * @throws {Error} If the handler configuration is invalid
   * 
   * @example
   * ```typescript
   * registry.register("sequential", {
   *   id: "sequential",
   *   name: "Sequential ID Generator",
   *   handler: (entity) => `${entity}_${getNextSequence(entity)}`
   * });
   * ```
   */
  register(id: string, handler: IdHandler): this;

  /**
   * Retrieve a handler by its ID.
   * 
   * @param id - The unique identifier of the handler
   * @returns The handler if found, undefined otherwise
   * 
   * @example
   * ```typescript
   * const handler = registry.getHandler("sequential");
   * if (handler) {
   *   console.log(`Found handler: ${handler.name}`);
   * }
   * ```
   */
  getHandler(id: string): IdHandler | undefined;

  /**
   * List all registered handlers.
   * 
   * @returns Object mapping handler IDs to handler configurations
   * 
   * @example
   * ```typescript
   * const allHandlers = registry.listHandlers();
   * Object.keys(allHandlers).forEach(id => {
   *   console.log(`Handler: ${id} - ${allHandlers[id].name}`);
   * });
   * ```
   */
  listHandlers(): Record<string, IdHandler>;

  /**
   * Validate a handler configuration.
   * 
   * @param id - The handler ID to validate against
   * @param config - Configuration object to validate
   * @returns Validation result with success status and any errors/warnings
   * 
   * @example
   * ```typescript
   * const result = registry.validateConfig("sequential", { startFrom: 1000 });
   * if (!result.valid) {
   *   console.error("Validation failed:", result.errors);
   * }
   * ```
   */
  validateConfig(id: string, config: any): ValidationResult;

  /**
   * Execute a handler to generate an ID.
   * 
   * @param id - The handler ID to execute
   * @param entity - The entity name for ID generation
   * @param data - Optional data to pass to the handler
   * @returns Promise resolving to execution result with generated ID or error details
   * 
   * @example
   * ```typescript
   * const result = await registry.execute("sequential", "users", { prefix: "usr" });
   * if (result.success) {
   *   console.log(`Generated ID: ${result.value}`);
   * } else {
   *   console.error("Generation failed:", result.error);
   * }
   * ```
   */
  execute(id: string, entity: string, data?: any): Promise<HandlerExecutionResult>;

  /**
   * Execute a handler with automatic fallback to UUID generation.
   * 
   * If the primary handler fails, automatically falls back to UUID generation
   * to ensure an ID is always produced.
   * 
   * @param id - The handler ID to execute
   * @param entity - The entity name for ID generation
   * @param data - Optional data to pass to the handler
   * @returns Promise resolving to execution result, with fallback used if needed
   * 
   * @example
   * ```typescript
   * const result = await registry.executeWithFallback("custom", "users");
   * console.log(`Generated ID: ${result.value}`);
   * if (result.fallbackUsed) {
   *   console.warn("Fallback UUID was used due to handler failure");
   * }
   * ```
   */
  executeWithFallback(id: string, entity: string, data?: any): Promise<HandlerExecutionResult>;

  /**
   * Unregister a handler by ID.
   * 
   * @param id - The handler ID to remove
   * @returns `true` if the handler was removed, `false` if it wasn't found
   * 
   * @example
   * ```typescript
   * const removed = registry.unregister("old-handler");
   * if (removed) {
   *   console.log("Handler removed successfully");
   * }
   * ```
   */
  unregister(id: string): boolean;

  /**
   * Clear all registered handlers.
   * 
   * Primarily used for testing and cleanup operations.
   * 
   * @example
   * ```typescript
   * registry.clear(); // Remove all handlers
   * ```
   */
  clear(): void;
}

/**
 * Configuration for ID handlers in BkndConfig.
 * 
 * Can be either a global handler configuration that applies to all entities,
 * or a mapping of entity names to their specific handler configurations.
 * 
 * @example
 * ```typescript
 * // Global handler for all entities
 * const globalConfig: BkndIdHandlersConfig = {
 *   type: "function",
 *   handler: (entity) => `${entity}_${Date.now()}`
 * };
 * 
 * // Per-entity handlers
 * const perEntityConfig: BkndIdHandlersConfig = {
 *   users: {
 *     type: "function",
 *     handler: (entity) => `usr_${Date.now()}`
 *   },
 *   products: {
 *     type: "import",
 *     importPath: "./handlers/productId",
 *     functionName: "generateProductId"
 *   }
 * };
 * ```
 */
export type BkndIdHandlersConfig = 
  | CustomIdHandlerConfig 
  | { [entityName: string]: CustomIdHandlerConfig };

/**
 * Extended BkndConfig interface with custom ID handlers support.
 * 
 * This type extends the base BkndConfig to include the idHandlers field,
 * providing type safety and IDE autocomplete for custom ID handler configuration.
 * 
 * @template Args - Type for configuration arguments
 * 
 * @example
 * ```typescript
 * const config: BkndConfigWithIdHandlers = {
 *   // ... other bknd config options
 *   idHandlers: {
 *     users: {
 *       type: "function",
 *       handler: (entity, data) => `usr_${data?.userId || Date.now()}`
 *     }
 *   }
 * };
 * ```
 */
export interface BkndConfigWithIdHandlers<Args = any> {
  /**
   * Custom ID handlers configuration.
   * 
   * Allows defining custom ID generation logic either globally for all entities
   * or on a per-entity basis. Handlers can be defined as direct functions or
   * imported from external modules.
   * 
   * @example
   * ```typescript
   * // Global handler
   * idHandlers: {
   *   type: "function",
   *   handler: (entity) => `${entity}_${Date.now()}`
   * }
   * 
   * // Per-entity handlers
   * idHandlers: {
   *   users: { type: "function", handler: (entity) => `usr_${Date.now()}` },
   *   orders: { type: "import", importPath: "./handlers/orderId" }
   * }
   * ```
   */
  idHandlers?: BkndIdHandlersConfig;
}

/**
 * Type guard to check if a configuration is a CustomIdHandlerConfig.
 * 
 * @param config - Object to check
 * @returns `true` if the object is a valid CustomIdHandlerConfig
 * 
 * @example
 * ```typescript
 * if (isCustomIdHandlerConfig(someConfig)) {
 *   // TypeScript now knows someConfig is CustomIdHandlerConfig
 *   console.log(`Handler type: ${someConfig.type}`);
 * }
 * ```
 */
export function isCustomIdHandlerConfig(config: any): config is CustomIdHandlerConfig {
  return (
    config &&
    typeof config === "object" &&
    typeof config.type === "string" &&
    ["function", "import"].includes(config.type)
  );
}

/**
 * Type guard to check if a configuration is a BkndIdHandlersConfig.
 * 
 * @param config - Object to check
 * @returns `true` if the object is a valid BkndIdHandlersConfig
 * 
 * @example
 * ```typescript
 * if (isBkndIdHandlersConfig(config.idHandlers)) {
 *   // Safe to use as BkndIdHandlersConfig
 *   processIdHandlers(config.idHandlers);
 * }
 * ```
 */
export function isBkndIdHandlersConfig(config: any): config is BkndIdHandlersConfig {
  if (!config || typeof config !== "object") return false;
  
  // Check if it's a single CustomIdHandlerConfig
  if (isCustomIdHandlerConfig(config)) return true;
  
  // Check if it's a mapping of entity names to CustomIdHandlerConfig
  return Object.values(config).every(value => isCustomIdHandlerConfig(value));
}

/**
 * Utility type to extract the handler function type from CustomIdHandlerConfig.
 * 
 * @example
 * ```typescript
 * type HandlerFn = ExtractHandlerFunction<CustomIdHandlerConfig>;
 * // HandlerFn is: (entity: string, data?: any) => string | number | Promise<string | number>
 * ```
 */
export type ExtractHandlerFunction<T extends CustomIdHandlerConfig> = 
  T extends { handler: infer H } ? H : never;

/**
 * Utility type to create a strongly-typed handler configuration.
 * 
 * @template TEntity - The entity name type
 * @template TData - The data type passed to the handler
 * 
 * @example
 * ```typescript
 * type UserHandlerConfig = TypedHandlerConfig<"users", { userId: number }>;
 * 
 * const config: UserHandlerConfig = {
 *   type: "function",
 *   handler: (entity, data) => `usr_${data.userId}` // data is typed as { userId: number }
 * };
 * ```
 */
export type TypedHandlerConfig<TEntity extends string, TData = any> = Omit<CustomIdHandlerConfig, 'handler'> & {
  handler?: (entity: TEntity, data?: TData) => string | number | Promise<string | number>;
};

/**
 * Constants for common ID handler types and formats.
 */
export const ID_HANDLER_CONSTANTS = {
  /**
   * Supported handler types
   */
  HANDLER_TYPES: {
    FUNCTION: "function" as const,
    IMPORT: "import" as const,
  },
  
  /**
   * Supported primary field formats
   */
  PRIMARY_FIELD_FORMATS: {
    INTEGER: "integer" as const,
    UUID: "uuid" as const,
    CUSTOM: "custom" as const,
  },
  
  /**
   * Default configuration values
   */
  DEFAULTS: {
    EXECUTION_TIMEOUT: 5000, // 5 seconds
    PERFORMANCE_WARNING_THRESHOLD: 100, // 100ms
    MAX_RETRY_ATTEMPTS: 3,
  },
} as const;