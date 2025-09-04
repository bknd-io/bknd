import { config } from "core/config";
import { omitKeys, uuidv7, s } from "bknd/utils";
import { Field, baseFieldConfigSchema } from "./Field";
import type { TFieldTSType } from "data/entities/EntityTypescript";
import { idHandlerImportResolver } from "./IdHandlerImportResolver";
import { idHandlerErrorManager, type ErrorResult } from "./IdHandlerErrorManager";

import type { TPrimaryFieldFormat, CustomIdHandlerConfig } from "./types";

/**
 * Array of supported primary field format types.
 * 
 * @deprecated Use TPrimaryFieldFormat type instead for type safety
 */
export const primaryFieldTypes = ["integer", "uuid", "custom"] as const;

// Re-export types for backward compatibility
export type { TPrimaryFieldFormat, CustomIdHandlerConfig } from "./types";

/**
 * Schema definition for primary field configuration.
 * 
 * Defines the structure and validation rules for primary field configuration,
 * including support for custom ID handlers.
 */
export const primaryFieldConfigSchema = s
   .strictObject({
      /** The format type for primary field ID generation */
      format: s.string({ enum: primaryFieldTypes, default: "integer" }),
      /** Whether the field is required (always false for primary fields) */
      required: s.boolean({ default: false }),
      /** Custom ID handler configuration when format is "custom" */
      customHandler: s.strictObject({
         /** Type of custom handler: function or import */
         type: s.string({ enum: ["function", "import"] }),
         /** Direct handler function (for type: "function") */
         handler: s.any().optional(),
         /** Import path for external handler (for type: "import") */
         importPath: s.string().optional(),
         /** Function name to import (optional, uses default export if not specified) */
         functionName: s.string().optional(),
         /** Additional options to pass to the handler */
         options: s.record(s.any()).optional(),
      }).optional(),
      ...omitKeys(baseFieldConfigSchema.properties, ["required"]),
   })
   .partial();

/**
 * TypeScript type for primary field configuration.
 * 
 * Represents the configuration object for primary fields, including
 * all supported options and custom handler configuration.
 */
export type PrimaryFieldConfig = s.Static<typeof primaryFieldConfigSchema>;

/**
 * Primary field class for entity primary key management.
 * 
 * Handles primary key generation using various strategies including auto-increment,
 * UUID, and custom ID generation handlers. Supports both synchronous and asynchronous
 * ID generation patterns.
 * 
 * @template Required - Whether the field is required (always false for primary fields)
 * 
 * @example
 * ```typescript
 * // Integer primary field (auto-increment)
 * const integerPrimary = new PrimaryField("id", { format: "integer" });
 * 
 * // UUID primary field
 * const uuidPrimary = new PrimaryField("id", { format: "uuid" });
 * 
 * // Custom ID handler
 * const customPrimary = new PrimaryField("id", {
 *   format: "custom",
 *   customHandler: {
 *     type: "function",
 *     handler: (entity) => `${entity}_${Date.now()}`
 *   }
 * });
 * ```
 */
export class PrimaryField<Required extends true | false = false> extends Field<
   PrimaryFieldConfig,
   string,
   Required
> {
   /** Field type identifier */
   override readonly type = "primary";

   /**
    * Create a new primary field instance.
    * 
    * @param name - The field name (defaults to configured default primary field name)
    * @param cfg - Field configuration including format and custom handler options
    * 
    * @throws {Error} If custom handler configuration is invalid
    * 
    * @example
    * ```typescript
    * // Default integer primary field
    * const field1 = new PrimaryField();
    * 
    * // Named UUID primary field
    * const field2 = new PrimaryField("user_id", { format: "uuid" });
    * 
    * // Custom handler primary field
    * const field3 = new PrimaryField("id", {
    *   format: "custom",
    *   customHandler: {
    *     type: "function",
    *     handler: (entity) => `${entity}_${Date.now()}`
    *   }
    * });
    * ```
    */
   constructor(name: string = config.data.default_primary_field, cfg?: PrimaryFieldConfig) {
      // Store the handler separately to avoid schema validation issues
      const customHandler = cfg?.customHandler;
      const configWithoutHandler = cfg ? { ...cfg } : {};
      if (configWithoutHandler.customHandler) {
         // Keep the handler reference but remove the function for schema validation
         configWithoutHandler.customHandler = {
            ...configWithoutHandler.customHandler,
            handler: undefined,
         };
      }
      
      super(name, { ...configWithoutHandler, fillable: false, required: false });
      
      // Restore the handler after schema validation
      if (customHandler) {
         this.config.customHandler = customHandler;
      }
      
      this.validateCustomHandlerConfig();
   }

   override isRequired(): boolean {
      return false;
   }

   protected getSchema() {
      return primaryFieldConfigSchema;
   }

   /**
    * Get the primary field format type.
    * 
    * @returns The format type: "integer", "uuid", or "custom"
    */
   get format(): TPrimaryFieldFormat {
      return this.config.format ?? "integer";
   }

   /**
    * Get the database field type based on the format.
    * 
    * @returns "integer" for integer format, "text" for uuid and custom formats
    */
   get fieldType(): "integer" | "text" {
      if (this.format === "integer") return "integer";
      return "text";
   }

   override schema() {
      return Object.freeze({
         type: this.fieldType,
         name: this.name,
         primary: true,
         nullable: false,
      });
   }

   /**
    * Generate a new ID value synchronously.
    * 
    * For UUID format, returns a new UUID v7. For custom format, returns undefined
    * to indicate that async generation is required. For integer format, returns
    * undefined as the database handles auto-increment.
    * 
    * @returns The generated ID for UUID format, undefined for other formats
    * 
    * @example
    * ```typescript
    * const uuidField = new PrimaryField("id", { format: "uuid" });
    * const id = uuidField.getNewValue(); // Returns UUID v7 string
    * 
    * const customField = new PrimaryField("id", { format: "custom", ... });
    * const id = customField.getNewValue(); // Returns undefined (use getNewValueAsync)
    * ```
    */
   getNewValue(): string | undefined {
      if (this.format === "uuid") {
         return uuidv7();
      }

      if (this.format === "custom") {
         // Custom ID generation requires async handling
         // This method returns undefined to indicate that async generation is needed
         return undefined;
      }

      return undefined;
   }

   /**
    * Generate a new ID value asynchronously with support for custom handlers.
    * 
    * This method supports all ID generation formats and provides detailed
    * result information including error handling and fallback usage.
    * 
    * @param entity - The entity name for custom ID generation (required for custom format)
    * @param data - Optional data to pass to custom handlers
    * @returns Promise resolving to generation result with success status and value
    * 
    * @example
    * ```typescript
    * // UUID generation
    * const result = await field.getNewValueAsync();
    * if (result.success) {
    *   console.log(`Generated UUID: ${result.value}`);
    * }
    * 
    * // Custom handler generation
    * const result = await customField.getNewValueAsync("users", { prefix: "usr" });
    * if (result.success) {
    *   console.log(`Generated ID: ${result.value}`);
    *   if (result.fallbackUsed) {
    *     console.warn("Custom handler failed, fallback was used");
    *   }
    * }
    * ```
    */
   async getNewValueAsync(entity?: string, data?: any): Promise<{
      success: boolean;
      value?: string | number;
      error?: ErrorResult;
      fallbackUsed?: boolean;
   }> {
      if (this.format === "uuid") {
         return {
            success: true,
            value: uuidv7()
         };
      }

      if (this.format === "custom") {
         if (!entity) {
            const error = idHandlerErrorManager.handleConfigurationError(
               this.config.customHandler!,
               ["Entity name is required for custom ID generation"],
               { field: this.name, format: this.format }
            );
            
            return {
               success: false,
               error
            };
         }
         
         return await this.generateCustomIdWithFallback(entity, data);
      }

      return {
         success: true,
         value: undefined
      };
   }

   /**
    * Generate a new ID using the configured custom handler.
    * 
    * Executes the custom ID handler (either function-based or import-based)
    * and returns the generated ID. Includes comprehensive error handling
    * and performance monitoring.
    * 
    * @param entity - The entity name for ID generation
    * @param data - Optional data to pass to the handler
    * @returns Promise resolving to the generated ID
    * 
    * @throws {Error} If custom ID generation is not configured
    * @throws {Error} If handler execution fails
    * @throws {Error} If handler returns invalid type or value
    * 
    * @example
    * ```typescript
    * try {
    *   const id = await field.generateCustomId("users", { userId: 123 });
    *   console.log(`Generated custom ID: ${id}`);
    * } catch (error) {
    *   console.error("Custom ID generation failed:", error.message);
    * }
    * ```
    */
   async generateCustomId(entity: string, data?: any): Promise<string | number> {
      if (this.format !== "custom" || !this.config.customHandler) {
         throw new Error("Custom ID generation is not configured for this field");
      }

      const handler = this.config.customHandler;
      const startTime = Date.now();
      
      if (handler.type === "function" && handler.handler) {
         // Direct function execution with enhanced error handling
         try {
            const result = await Promise.resolve(handler.handler(entity, data));
            const executionTime = Date.now() - startTime;
            
            // Validate result type with detailed error information
            if (typeof result !== 'string' && typeof result !== 'number') {
               throw new Error(`Custom handler returned invalid type: expected string or number, got ${typeof result}. Returned value: ${JSON.stringify(result)}`);
            }

            // Validate result value
            if (typeof result === 'string' && result.length === 0) {
               throw new Error("Custom handler returned empty string");
            }

            if (typeof result === 'number' && !Number.isFinite(result)) {
               throw new Error(`Custom handler returned non-finite number: ${result}`);
            }

            // Log performance warning if needed
            if (executionTime > 100) {
               console.warn(`Custom ID handler for field '${this.name}' took ${executionTime}ms to execute`);
            }
            
            return result;
         } catch (error) {
            const executionTime = Date.now() - startTime;
            throw new Error(`Custom handler execution failed after ${executionTime}ms: ${error instanceof Error ? error.message : String(error)}`);
         }
      } else if (handler.type === "import") {
         // Import-based handler execution with enhanced error handling
         if (!handler.importPath) {
            throw new Error("Import path is required for import-based handlers");
         }

         try {
            const importResult = await idHandlerImportResolver.resolveHandler({
               importPath: handler.importPath,
               functionName: handler.functionName,
               options: handler.options
            });

            if (!importResult.success) {
               // Provide detailed import error information
               const errorMsg = importResult.error || "Failed to resolve import handler";
               throw new Error(`Import resolution failed: ${errorMsg}. Import path: '${handler.importPath}', Function: '${handler.functionName || 'default'}'`);
            }

            if (!importResult.handler) {
               throw new Error(`No handler returned from import resolution for '${handler.importPath}'`);
            }

            // Execute the imported handler with enhanced error handling
            const handlerData = { ...handler.options, ...data };
            const result = await Promise.resolve(importResult.handler.handler(entity, handlerData));
            const executionTime = Date.now() - startTime;
            
            // Validate result type with detailed error information
            if (typeof result !== 'string' && typeof result !== 'number') {
               throw new Error(`Imported handler returned invalid type: expected string or number, got ${typeof result}. Returned value: ${JSON.stringify(result)}`);
            }

            // Validate result value
            if (typeof result === 'string' && result.length === 0) {
               throw new Error("Imported handler returned empty string");
            }

            if (typeof result === 'number' && !Number.isFinite(result)) {
               throw new Error(`Imported handler returned non-finite number: ${result}`);
            }

            // Log performance warning if needed
            if (executionTime > 100) {
               console.warn(`Imported ID handler '${handler.importPath}:${handler.functionName || 'default'}' took ${executionTime}ms to execute`);
            }
            
            return result;
         } catch (error) {
            const executionTime = Date.now() - startTime;
            throw new Error(`Import handler execution failed after ${executionTime}ms: ${error instanceof Error ? error.message : String(error)}`);
         }
      }

      throw new Error(`Invalid custom handler configuration: type '${handler.type}' is not supported`);
   }

   /**
    * Generate a new ID using custom handler with automatic UUID fallback.
    * 
    * Attempts to generate an ID using the custom handler, but falls back to
    * UUID v7 generation if the handler fails. This ensures ID generation
    * never completely fails in production environments.
    * 
    * @param entity - The entity name for ID generation
    * @param data - Optional data to pass to the handler
    * @returns Promise resolving to generation result with fallback information
    * 
    * @example
    * ```typescript
    * const result = await field.generateCustomIdWithFallback("users");
    * console.log(`Generated ID: ${result.value}`);
    * 
    * if (result.fallbackUsed) {
    *   console.warn("Custom handler failed, UUID fallback was used");
    *   console.error("Original error:", result.error);
    * }
    * ```
    */
   async generateCustomIdWithFallback(entity: string, data?: any): Promise<{
      success: boolean;
      value?: string | number;
      error?: ErrorResult;
      fallbackUsed?: boolean;
   }> {
      try {
         const result = await this.generateCustomId(entity, data);
         return {
            success: true,
            value: result
         };
      } catch (error) {
         // Create structured error result
         const errorResult = idHandlerErrorManager.handleExecutionError(
            error instanceof Error ? error : new Error(String(error)),
            `field_${this.name}`,
            entity,
            { field: this.name, format: this.format }
         );

         // Log detailed error information
         console.warn(`Custom ID generation failed for entity '${entity}', falling back to UUID:`, 
            idHandlerErrorManager.generateErrorSummary(errorResult));
         
         // Return with fallback value
         return {
            success: true,
            value: uuidv7(),
            error: errorResult,
            fallbackUsed: true
         };
      }
   }

   override async transformPersist(value: any): Promise<number> {
      throw new Error("PrimaryField: This function should not be called");
   }

   /**
    * Validate the custom handler configuration.
    * 
    * Performs validation on the custom handler configuration to ensure
    * all required fields are present and properly configured.
    * 
    * @throws {Error} If custom handler configuration is invalid
    * 
    * @private
    */
   private validateCustomHandlerConfig(): void {
      if (this.format === "custom") {
         if (!this.config.customHandler) {
            throw new Error("Custom handler configuration is required when format is 'custom'");
         }

         const handler = this.config.customHandler;
         
         if (handler.type === "function" && !handler.handler) {
            throw new Error("Handler function is required when type is 'function'");
         }

         if (handler.type === "import") {
            if (!handler.importPath) {
               throw new Error("Import path is required when type is 'import'");
            }
            // Function name is optional - if not provided, will use default export or auto-detect
         }
      }
   }

   /**
    * Get the custom handler configuration for this field.
    * 
    * @returns The custom handler configuration if present, undefined otherwise
    * 
    * @example
    * ```typescript
    * const handler = field.getCustomHandler();
    * if (handler) {
    *   console.log(`Handler type: ${handler.type}`);
    *   if (handler.type === "import") {
    *     console.log(`Import path: ${handler.importPath}`);
    *   }
    * }
    * ```
    */
   getCustomHandler(): CustomIdHandlerConfig | undefined {
      return this.config.customHandler;
   }

   /**
    * Check if this field uses custom ID generation.
    * 
    * @returns `true` if the field format is "custom", `false` otherwise
    * 
    * @example
    * ```typescript
    * if (field.isCustomFormat()) {
    *   const result = await field.getNewValueAsync("users");
    * } else {
    *   const id = field.getNewValue();
    * }
    * ```
    */
   isCustomFormat(): boolean {
      return this.format === "custom";
   }

   override toJsonSchema() {
      return this.toSchemaWrapIfRequired(
         this.format === "integer"
            ? s.number({ writeOnly: undefined })
            : s.string({ writeOnly: undefined }),
      );
   }

   override toType(): TFieldTSType {
      const type = this.format === "integer" ? "number" : "string";
      return {
         ...super.toType(),
         required: true,
         import: [{ package: "kysely", name: "Generated" }],
         type: `Generated<${type}>`,
      };
   }
}
