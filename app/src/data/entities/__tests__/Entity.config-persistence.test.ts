import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../Entity";
import { idHandlerRegistry } from "../../fields";

describe("Entity Configuration Persistence", () => {
   beforeEach(() => {
      // Clear registry before each test
      idHandlerRegistry.clear();
   });

   describe("Database configuration storage", () => {
      it("should include custom_id_handler in entity configuration when serialized", () => {
         const entity = new Entity("test_entity", [], {
            name: "Test Entity",
            primary_format: "custom",
            custom_id_handler: {
               type: "import",
               importPath: "./handlers/test",
               functionName: "generateId",
               options: { prefix: "test" },
            },
         });

         const serialized = entity.toJSON();
         
         // Verify custom handler configuration is included in serialization
         expect(serialized.config.custom_id_handler).toBeDefined();
         expect(serialized.config.custom_id_handler?.type).toBe("import");
         expect(serialized.config.custom_id_handler?.importPath).toBe("./handlers/test");
         expect(serialized.config.custom_id_handler?.functionName).toBe("generateId");
         expect(serialized.config.custom_id_handler?.options).toEqual({ prefix: "test" });
         expect(serialized.config.primary_format).toBe("custom");
      });

      it("should not include custom_id_handler for entities without custom handlers", () => {
         const entity = new Entity("regular_entity", [], {
            name: "Regular Entity",
            primary_format: "uuid",
         });

         const serialized = entity.toJSON();
         
         // Verify no custom handler in serialization
         expect(serialized.config.custom_id_handler).toBeUndefined();
         expect(serialized.config.primary_format).toBe("uuid");
      });

      it("should preserve all custom handler configuration fields during serialization", () => {
         const customHandlerConfig = {
            type: "import" as const,
            importPath: "./handlers/complex",
            functionName: "generateComplexId",
            options: {
               prefix: "complex",
               format: "timestamp",
               metadata: { version: 2, author: "system" },
               settings: {
                  length: 12,
                  includeChecksum: true,
               },
            },
         };

         const entity = new Entity("complex_entity", [], {
            name: "Complex Entity",
            primary_format: "custom",
            custom_id_handler: customHandlerConfig,
         });

         const serialized = entity.toJSON();
         
         // Verify all configuration is preserved
         expect(serialized.config.custom_id_handler).toEqual(customHandlerConfig);
      });
   });

   describe("Configuration loading and restoration", () => {
      it("should restore entity with import-based custom handler from serialized config", () => {
         // Simulate configuration loaded from database
         const serializedConfig = {
            name: "Restored Entity",
            primary_format: "custom" as const,
            custom_id_handler: {
               type: "import" as const,
               importPath: "./handlers/restored",
               functionName: "generateRestoredId",
               options: { prefix: "restored" },
            },
         };

         // Create entity from serialized config (simulating app startup)
         const restoredEntity = new Entity("restored_entity", [], serializedConfig);

         // Verify entity was restored correctly
         expect(restoredEntity.hasCustomIdHandler()).toBe(true);
         expect(restoredEntity.getCustomIdHandler()?.type).toBe("import");
         expect(restoredEntity.getCustomIdHandler()?.importPath).toBe("./handlers/restored");
         expect(restoredEntity.getCustomIdHandler()?.functionName).toBe("generateRestoredId");
         expect(restoredEntity.getCustomIdHandler()?.options).toEqual({ prefix: "restored" });
         expect(restoredEntity.getPrimaryField().isCustomFormat()).toBe(true);
      });

      it("should handle configuration updates for existing entities", () => {
         // Start with a regular entity
         const originalEntity = new Entity("updatable_entity", [], {
            name: "Updatable Entity",
            primary_format: "integer",
         });

         expect(originalEntity.hasCustomIdHandler()).toBe(false);

         // Simulate updating configuration to add custom handler
         const updatedConfig = {
            name: "Updatable Entity",
            primary_format: "custom" as const,
            custom_id_handler: {
               type: "import" as const,
               importPath: "./handlers/updated",
               functionName: "generateUpdatedId",
            },
         };

         // Create new entity with updated config
         const updatedEntity = new Entity("updatable_entity", [], updatedConfig);

         // Verify entity now has custom handler
         expect(updatedEntity.hasCustomIdHandler()).toBe(true);
         expect(updatedEntity.getCustomIdHandler()?.type).toBe("import");
         expect(updatedEntity.getCustomIdHandler()?.importPath).toBe("./handlers/updated");
      });

      it("should handle removing custom handler from entity configuration", () => {
         // Start with entity that has custom handler
         const entityWithHandler = new Entity("removable_entity", [], {
            name: "Removable Entity",
            primary_format: "custom",
            custom_id_handler: {
               type: "import",
               importPath: "./handlers/removable",
               functionName: "generateRemovableId",
            },
         });

         expect(entityWithHandler.hasCustomIdHandler()).toBe(true);

         // Simulate removing custom handler (changing to UUID)
         const configWithoutHandler = {
            name: "Removable Entity",
            primary_format: "uuid" as const,
         };

         // Create new entity without handler
         const entityWithoutHandler = new Entity("removable_entity", [], configWithoutHandler);

         // Verify entity no longer has custom handler
         expect(entityWithoutHandler.hasCustomIdHandler()).toBe(false);
         expect(entityWithoutHandler.getCustomIdHandler()).toBeUndefined();
         expect(entityWithoutHandler.getPrimaryField().isCustomFormat()).toBe(false);
      });
   });

   describe("Migration scenarios", () => {
      it("should handle migrating from integer to custom ID generation", () => {
         // Original configuration with integer primary key
         const originalConfig = {
            name: "Migration Entity",
            primary_format: "integer" as const,
         };

         const originalEntity = new Entity("migration_entity", [], originalConfig);
         expect(originalEntity.hasCustomIdHandler()).toBe(false);

         // Migrated configuration with custom handler
         const migratedConfig = {
            name: "Migration Entity",
            primary_format: "custom" as const,
            custom_id_handler: {
               type: "import" as const,
               importPath: "./handlers/migrated",
               functionName: "generateMigratedId",
               options: { 
                  migratedFrom: "integer",
                  startingValue: 1000,
               },
            },
         };

         const migratedEntity = new Entity("migration_entity", [], migratedConfig);
         
         // Verify migration was successful
         expect(migratedEntity.hasCustomIdHandler()).toBe(true);
         expect(migratedEntity.getCustomIdHandler()?.options?.migratedFrom).toBe("integer");
         expect(migratedEntity.getCustomIdHandler()?.options?.startingValue).toBe(1000);
      });

      it("should handle migrating from UUID to custom ID generation", () => {
         // Original configuration with UUID
         const originalConfig = {
            name: "UUID Migration Entity",
            primary_format: "uuid" as const,
         };

         const originalEntity = new Entity("uuid_migration_entity", [], originalConfig);
         expect(originalEntity.hasCustomIdHandler()).toBe(false);

         // Migrated configuration with custom handler
         const migratedConfig = {
            name: "UUID Migration Entity",
            primary_format: "custom" as const,
            custom_id_handler: {
               type: "import" as const,
               importPath: "./handlers/uuid-migrated",
               functionName: "generateFromUuid",
               options: { 
                  migratedFrom: "uuid",
                  preserveFormat: true,
               },
            },
         };

         const migratedEntity = new Entity("uuid_migration_entity", [], migratedConfig);
         
         // Verify migration was successful
         expect(migratedEntity.hasCustomIdHandler()).toBe(true);
         expect(migratedEntity.getCustomIdHandler()?.options?.migratedFrom).toBe("uuid");
         expect(migratedEntity.getCustomIdHandler()?.options?.preserveFormat).toBe(true);
      });

      it("should handle configuration schema evolution", () => {
         // Simulate older configuration format (without options)
         const oldConfig = {
            name: "Legacy Entity",
            primary_format: "custom" as const,
            custom_id_handler: {
               type: "import" as const,
               importPath: "./handlers/legacy",
               functionName: "generateLegacyId",
               // No options field
            },
         };

         const legacyEntity = new Entity("legacy_entity", [], oldConfig);
         expect(legacyEntity.hasCustomIdHandler()).toBe(true);
         expect(legacyEntity.getCustomIdHandler()?.options).toBeUndefined();

         // Simulate newer configuration format (with options)
         const newConfig = {
            name: "Legacy Entity",
            primary_format: "custom" as const,
            custom_id_handler: {
               type: "import" as const,
               importPath: "./handlers/legacy",
               functionName: "generateLegacyId",
               options: {
                  version: 2,
                  enhanced: true,
               },
            },
         };

         const modernEntity = new Entity("legacy_entity", [], newConfig);
         expect(modernEntity.hasCustomIdHandler()).toBe(true);
         expect(modernEntity.getCustomIdHandler()?.options).toEqual({
            version: 2,
            enhanced: true,
         });
      });
   });
});