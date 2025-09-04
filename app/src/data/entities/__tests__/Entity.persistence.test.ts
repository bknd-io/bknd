import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../Entity";
import { idHandlerRegistry } from "../../fields";
import { constructEntity } from "../../schema/constructor";

describe("Entity Configuration Persistence", () => {
   beforeEach(() => {
      // Clear registry before each test
      idHandlerRegistry.clear();
   });

   describe("Configuration serialization and deserialization", () => {
      it("should persist and restore function-based custom ID handler configuration", () => {
         const customHandler = (entity: string) => `test_${entity}_${Date.now()}`;
         
         // Create entity with custom handler
         const originalEntity = new Entity("test_entity", [], {
            name: "Test Entity",
            primary_format: "custom",
            custom_id_handler: {
               type: "function",
               handler: customHandler,
               options: { prefix: "test" },
            },
         });

         // Serialize configuration (simulating database storage)
         const serializedConfig = originalEntity.toJSON();
         
         // Verify serialization includes custom handler config
         expect(serializedConfig.config.custom_id_handler).toBeDefined();
         expect(serializedConfig.config.custom_id_handler?.type).toBe("function");
         expect(serializedConfig.config.primary_format).toBe("custom");

         // Clear registry to simulate app restart
         idHandlerRegistry.clear();
         expect(idHandlerRegistry.getHandler("entity_test_entity")).toBeUndefined();

         // Reconstruct entity from serialized config (simulating app startup)
         const restoredEntity = constructEntity("test_entity", serializedConfig);

         // Verify entity was restored correctly
         expect(restoredEntity.hasCustomIdHandler()).toBe(true);
         expect(restoredEntity.getCustomIdHandler()?.type).toBe("function");
         expect(restoredEntity.getPrimaryField().isCustomFormat()).toBe(true);

         // Verify handler was re-registered
         const registeredHandler = idHandlerRegistry.getHandler("entity_test_entity");
         expect(registeredHandler).toBeDefined();
         expect(registeredHandler?.name).toBe("test_entity Custom Handler");
      });

      it("should persist and restore import-based custom ID handler configuration", () => {
         // Create entity with import-based custom handler
         const originalEntity = new Entity("import_entity", [], {
            name: "Import Entity",
            primary_format: "custom",
            custom_id_handler: {
               type: "import",
               importPath: "./handlers/custom-id",
               functionName: "generateId",
               options: { prefix: "imp" },
            },
         });

         // Serialize configuration
         const serializedConfig = originalEntity.toJSON();
         
         // Verify serialization includes custom handler config
         expect(serializedConfig.config.custom_id_handler).toBeDefined();
         expect(serializedConfig.config.custom_id_handler?.type).toBe("import");
         expect(serializedConfig.config.custom_id_handler?.importPath).toBe("./handlers/custom-id");
         expect(serializedConfig.config.custom_id_handler?.functionName).toBe("generateId");

         // Reconstruct entity from serialized config
         const restoredEntity = constructEntity("import_entity", serializedConfig);

         // Verify entity was restored correctly
         expect(restoredEntity.hasCustomIdHandler()).toBe(true);
         expect(restoredEntity.getCustomIdHandler()?.type).toBe("import");
         expect(restoredEntity.getCustomIdHandler()?.importPath).toBe("./handlers/custom-id");
         expect(restoredEntity.getCustomIdHandler()?.functionName).toBe("generateId");
      });

      it("should handle entities without custom handlers during persistence", () => {
         // Create regular entity
         const originalEntity = new Entity("regular_entity", [], {
            name: "Regular Entity",
            primary_format: "uuid",
         });

         // Serialize configuration
         const serializedConfig = originalEntity.toJSON();
         
         // Verify no custom handler in serialization
         expect(serializedConfig.config.custom_id_handler).toBeUndefined();
         expect(serializedConfig.config.primary_format).toBe("uuid");

         // Reconstruct entity from serialized config
         const restoredEntity = constructEntity("regular_entity", serializedConfig);

         // Verify entity was restored correctly
         expect(restoredEntity.hasCustomIdHandler()).toBe(false);
         expect(restoredEntity.getCustomIdHandler()).toBeUndefined();
         expect(restoredEntity.getPrimaryField().isCustomFormat()).toBe(false);
      });

      it("should preserve custom handler options during persistence", () => {
         const customHandler = (entity: string, data?: any) => {
            const prefix = data?.prefix || "default";
            return `${prefix}_${entity}_${Date.now()}`;
         };

         // Create entity with custom handler and options
         const originalEntity = new Entity("options_entity", [], {
            name: "Options Entity",
            primary_format: "custom",
            custom_id_handler: {
               type: "function",
               handler: customHandler,
               options: {
                  prefix: "custom",
                  format: "timestamp",
                  metadata: { version: 1 },
               },
            },
         });

         // Serialize and restore
         const serializedConfig = originalEntity.toJSON();
         const restoredEntity = constructEntity("options_entity", serializedConfig);

         // Verify options were preserved
         const restoredHandler = restoredEntity.getCustomIdHandler();
         expect(restoredHandler?.options).toBeDefined();
         expect(restoredHandler?.options?.prefix).toBe("custom");
         expect(restoredHandler?.options?.format).toBe("timestamp");
         expect(restoredHandler?.options?.metadata).toEqual({ version: 1 });
      });
   });

   describe("Migration scenarios", () => {
      it("should handle adding custom handler to existing entity configuration", () => {
         // Simulate existing entity configuration without custom handler
         const existingConfig = {
            type: "regular" as const,
            config: {
               name: "Existing Entity",
               primary_format: "integer" as const,
            },
            fields: {},
         };

         // Create entity from existing config
         const existingEntity = constructEntity("existing_entity", existingConfig);
         expect(existingEntity.hasCustomIdHandler()).toBe(false);

         // Simulate updating configuration to add custom handler
         const updatedConfig = {
            ...existingConfig,
            config: {
               ...existingConfig.config,
               primary_format: "custom" as const,
               custom_id_handler: {
                  type: "function" as const,
                  handler: (entity: string) => `migrated_${entity}`,
               },
            },
         };

         // Create entity with updated config
         const updatedEntity = constructEntity("existing_entity", updatedConfig);
         expect(updatedEntity.hasCustomIdHandler()).toBe(true);
         expect(updatedEntity.getCustomIdHandler()?.type).toBe("function");

         // Verify handler was registered
         const registeredHandler = idHandlerRegistry.getHandler("entity_existing_entity");
         expect(registeredHandler).toBeDefined();
      });

      it("should handle removing custom handler from entity configuration", () => {
         // Create entity with custom handler
         const withHandlerConfig = {
            type: "regular" as const,
            config: {
               name: "Handler Entity",
               primary_format: "custom" as const,
               custom_id_handler: {
                  type: "function" as const,
                  handler: (entity: string) => `handler_${entity}`,
               },
            },
            fields: {},
         };

         const entityWithHandler = constructEntity("handler_entity", withHandlerConfig);
         expect(entityWithHandler.hasCustomIdHandler()).toBe(true);

         // Verify handler was registered
         expect(idHandlerRegistry.getHandler("entity_handler_entity")).toBeDefined();

         // Simulate removing custom handler (changing to UUID)
         const withoutHandlerConfig = {
            ...withHandlerConfig,
            config: {
               ...withHandlerConfig.config,
               primary_format: "uuid" as const,
               custom_id_handler: undefined,
            },
         };

         // Create entity without handler
         const entityWithoutHandler = constructEntity("handler_entity", withoutHandlerConfig);
         expect(entityWithoutHandler.hasCustomIdHandler()).toBe(false);
         expect(entityWithoutHandler.getCustomIdHandler()).toBeUndefined();
      });
   });
});