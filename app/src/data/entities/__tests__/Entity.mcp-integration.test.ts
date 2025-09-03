import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../Entity";
import { idHandlerRegistry } from "../../fields";

describe("Entity Custom ID Handler MCP Integration", () => {
   beforeEach(() => {
      // Clear registry before each test
      idHandlerRegistry.clear();
   });

   describe("MCP configuration operations", () => {
      it("should support adding entity with custom handler via MCP-like operations", () => {
         // Simulate MCP config_data_entities_add operation
         const entityConfig = {
            type: "regular" as const,
            config: {
               name: "MCP Entity",
               primary_format: "custom" as const,
               custom_id_handler: {
                  type: "import" as const,
                  importPath: "./handlers/mcp",
                  functionName: "generateMcpId",
                  options: { source: "mcp" },
               },
            },
            fields: {},
         };

         // Create entity (simulating what happens when MCP adds entity config)
         const entity = new Entity("mcp_entity", [], entityConfig.config);

         // Verify entity was created correctly
         expect(entity.hasCustomIdHandler()).toBe(true);
         expect(entity.getCustomIdHandler()?.type).toBe("import");
         expect(entity.getCustomIdHandler()?.importPath).toBe("./handlers/mcp");
         expect(entity.getCustomIdHandler()?.functionName).toBe("generateMcpId");

         // Verify configuration can be serialized (for MCP get operations)
         const serialized = entity.toJSON();
         expect(serialized.config.custom_id_handler).toBeDefined();
         expect(serialized.config.custom_id_handler?.options?.source).toBe("mcp");
      });

      it("should support updating entity custom handler via MCP-like operations", () => {
         // Start with entity without custom handler
         const originalEntity = new Entity("updatable_mcp_entity", [], {
            name: "Updatable MCP Entity",
            primary_format: "uuid",
         });

         expect(originalEntity.hasCustomIdHandler()).toBe(false);

         // Simulate MCP config_data_entities_update operation
         const updatedConfig = {
            name: "Updatable MCP Entity",
            primary_format: "custom" as const,
            custom_id_handler: {
               type: "import" as const,
               importPath: "./handlers/updated-mcp",
               functionName: "generateUpdatedMcpId",
               options: { 
                  updatedVia: "mcp",
                  timestamp: Date.now(),
               },
            },
         };

         // Create updated entity (simulating config update)
         const updatedEntity = new Entity("updatable_mcp_entity", [], updatedConfig);

         // Verify update was successful
         expect(updatedEntity.hasCustomIdHandler()).toBe(true);
         expect(updatedEntity.getCustomIdHandler()?.options?.updatedVia).toBe("mcp");
         expect(updatedEntity.getCustomIdHandler()?.options?.timestamp).toBeDefined();
      });

      it("should support removing custom handler via MCP-like operations", () => {
         // Start with entity that has custom handler
         const entityWithHandler = new Entity("removable_mcp_entity", [], {
            name: "Removable MCP Entity",
            primary_format: "custom",
            custom_id_handler: {
               type: "import",
               importPath: "./handlers/removable-mcp",
               functionName: "generateRemovableMcpId",
            },
         });

         expect(entityWithHandler.hasCustomIdHandler()).toBe(true);

         // Simulate MCP config_data_entities_update operation to remove handler
         const configWithoutHandler = {
            name: "Removable MCP Entity",
            primary_format: "integer" as const,
            // custom_id_handler removed
         };

         // Create entity without handler (simulating config update)
         const entityWithoutHandler = new Entity("removable_mcp_entity", [], configWithoutHandler);

         // Verify handler was removed
         expect(entityWithoutHandler.hasCustomIdHandler()).toBe(false);
         expect(entityWithoutHandler.getCustomIdHandler()).toBeUndefined();
      });
   });

   describe("Configuration validation for MCP operations", () => {
      it("should validate custom handler configuration during MCP operations", () => {
         // Test invalid configuration (missing function name for import type)
         expect(() => {
            new Entity("invalid_mcp_entity", [], {
               name: "Invalid MCP Entity",
               primary_format: "custom",
               custom_id_handler: {
                  type: "import",
                  importPath: "./handlers/invalid",
                  // Missing functionName
               },
            });
         }).toThrow("Function name is required when type is \"import\"");

         // Test invalid configuration (missing import path for import type)
         expect(() => {
            new Entity("invalid_mcp_entity2", [], {
               name: "Invalid MCP Entity 2",
               primary_format: "custom",
               custom_id_handler: {
                  type: "import",
                  functionName: "generateId",
                  // Missing importPath
               },
            });
         }).toThrow("Import path is required when type is \"import\"");

         // Test invalid configuration (custom handler without custom format)
         expect(() => {
            new Entity("invalid_mcp_entity3", [], {
               name: "Invalid MCP Entity 3",
               primary_format: "uuid",
               custom_id_handler: {
                  type: "import",
                  importPath: "./handlers/test",
                  functionName: "generateId",
               },
            });
         }).toThrow("custom_id_handler is configured but primary_format is not set to \"custom\"");
      });

      it("should handle partial configuration updates via MCP", () => {
         // Start with entity with custom handler
         const originalEntity = new Entity("partial_update_entity", [], {
            name: "Partial Update Entity",
            primary_format: "custom",
            custom_id_handler: {
               type: "import",
               importPath: "./handlers/original",
               functionName: "generateOriginalId",
               options: { version: 1 },
            },
         });

         // Simulate partial update (only updating options)
         const partiallyUpdatedConfig = {
            name: "Partial Update Entity",
            primary_format: "custom" as const,
            custom_id_handler: {
               type: "import" as const,
               importPath: "./handlers/original",
               functionName: "generateOriginalId",
               options: { 
                  version: 2,
                  enhanced: true,
               },
            },
         };

         const updatedEntity = new Entity("partial_update_entity", [], partiallyUpdatedConfig);

         // Verify partial update was successful
         expect(updatedEntity.getCustomIdHandler()?.options?.version).toBe(2);
         expect(updatedEntity.getCustomIdHandler()?.options?.enhanced).toBe(true);
         expect(updatedEntity.getCustomIdHandler()?.importPath).toBe("./handlers/original");
         expect(updatedEntity.getCustomIdHandler()?.functionName).toBe("generateOriginalId");
      });
   });

   describe("Bulk operations simulation", () => {
      it("should handle multiple entities with custom handlers", () => {
         const entities = [
            {
               name: "bulk_entity_1",
               config: {
                  name: "Bulk Entity 1",
                  primary_format: "custom" as const,
                  custom_id_handler: {
                     type: "import" as const,
                     importPath: "./handlers/bulk1",
                     functionName: "generateBulk1Id",
                  },
               },
            },
            {
               name: "bulk_entity_2",
               config: {
                  name: "Bulk Entity 2",
                  primary_format: "uuid" as const,
               },
            },
            {
               name: "bulk_entity_3",
               config: {
                  name: "Bulk Entity 3",
                  primary_format: "custom" as const,
                  custom_id_handler: {
                     type: "import" as const,
                     importPath: "./handlers/bulk3",
                     functionName: "generateBulk3Id",
                     options: { bulk: true },
                  },
               },
            },
         ];

         // Create all entities (simulating bulk MCP operations)
         const createdEntities = entities.map(({ name, config }) => 
            new Entity(name, [], config)
         );

         // Verify entities were created correctly
         expect(createdEntities).toHaveLength(3);
         
         // Entity 1 should have custom handler
         expect(createdEntities[0].hasCustomIdHandler()).toBe(true);
         expect(createdEntities[0].getCustomIdHandler()?.importPath).toBe("./handlers/bulk1");
         
         // Entity 2 should not have custom handler
         expect(createdEntities[1].hasCustomIdHandler()).toBe(false);
         
         // Entity 3 should have custom handler with options
         expect(createdEntities[2].hasCustomIdHandler()).toBe(true);
         expect(createdEntities[2].getCustomIdHandler()?.options?.bulk).toBe(true);

         // Verify all can be serialized for MCP responses
         const serializedConfigs = createdEntities.map(entity => entity.toJSON());
         expect(serializedConfigs).toHaveLength(3);
         expect(serializedConfigs[0].config.custom_id_handler).toBeDefined();
         expect(serializedConfigs[1].config.custom_id_handler).toBeUndefined();
         expect(serializedConfigs[2].config.custom_id_handler?.options?.bulk).toBe(true);
      });
   });
});