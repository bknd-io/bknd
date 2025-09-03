import { config } from "core/config";
import { omitKeys, uuidv7, s } from "bknd/utils";
import { Field, baseFieldConfigSchema } from "./Field";
import type { TFieldTSType } from "data/entities/EntityTypescript";

export const primaryFieldTypes = ["integer", "uuid", "custom"] as const;
export type TPrimaryFieldFormat = (typeof primaryFieldTypes)[number];

// Custom ID handler configuration interface
export interface CustomIdHandlerConfig {
   type: "function" | "import";
   handler?: (entity: string, data?: any) => string | number | Promise<string | number>;
   importPath?: string;
   functionName?: string;
   options?: Record<string, any>;
}

export const primaryFieldConfigSchema = s
   .strictObject({
      format: s.string({ enum: primaryFieldTypes, default: "integer" }),
      required: s.boolean({ default: false }),
      customHandler: s.strictObject({
         type: s.string({ enum: ["function", "import"] }),
         handler: s.any().optional(),
         importPath: s.string().optional(),
         functionName: s.string().optional(),
         options: s.record(s.any()).optional(),
      }).optional(),
      ...omitKeys(baseFieldConfigSchema.properties, ["required"]),
   })
   .partial();

export type PrimaryFieldConfig = s.Static<typeof primaryFieldConfigSchema>;

export class PrimaryField<Required extends true | false = false> extends Field<
   PrimaryFieldConfig,
   string,
   Required
> {
   override readonly type = "primary";

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

   get format() {
      return this.config.format ?? "integer";
   }

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

   getNewValue(): any {
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
    * Async version of getNewValue that supports custom ID generation
    * @param entity - The entity name for custom ID generation
    * @param data - Optional data to pass to custom handlers
    * @returns Promise resolving to the new ID value
    */
   async getNewValueAsync(entity?: string, data?: any): Promise<string | number | undefined> {
      if (this.format === "uuid") {
         return uuidv7();
      }

      if (this.format === "custom") {
         if (!entity) {
            throw new Error("Entity name is required for custom ID generation");
         }
         return await this.generateCustomIdWithFallback(entity, data);
      }

      return undefined;
   }

   /**
    * Generate a new ID using custom handler if configured
    */
   async generateCustomId(entity: string, data?: any): Promise<string | number> {
      if (this.format !== "custom" || !this.config.customHandler) {
         throw new Error("Custom ID generation is not configured for this field");
      }

      const handler = this.config.customHandler;
      
      if (handler.type === "function" && handler.handler) {
         // Direct function execution
         try {
            const result = await Promise.resolve(handler.handler(entity, data));
            
            if (typeof result !== 'string' && typeof result !== 'number') {
               throw new Error(`Custom handler returned invalid type: expected string or number, got ${typeof result}`);
            }
            
            return result;
         } catch (error) {
            throw new Error(`Custom handler execution failed: ${error instanceof Error ? error.message : String(error)}`);
         }
      } else if (handler.type === "import") {
         // Import-based handler execution will be implemented in a later task
         throw new Error("Import-based custom handlers are not yet implemented");
      }

      throw new Error("Invalid custom handler configuration");
   }

   /**
    * Generate a new ID using custom handler with fallback to UUID
    */
   async generateCustomIdWithFallback(entity: string, data?: any): Promise<string | number> {
      try {
         return await this.generateCustomId(entity, data);
      } catch (error) {
         console.warn(`Custom ID generation failed for entity '${entity}', falling back to UUID:`, error);
         return uuidv7();
      }
   }

   override async transformPersist(value: any): Promise<number> {
      throw new Error("PrimaryField: This function should not be called");
   }

   /**
    * Validates custom handler configuration when format is "custom"
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
            if (!handler.functionName) {
               throw new Error("Function name is required when type is 'import'");
            }
         }
      }
   }

   /**
    * Gets the custom handler configuration
    */
   getCustomHandler(): CustomIdHandlerConfig | undefined {
      return this.config.customHandler;
   }

   /**
    * Checks if this field uses custom ID generation
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
