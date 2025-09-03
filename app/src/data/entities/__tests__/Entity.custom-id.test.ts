import { describe, it, expect, beforeEach } from "vitest";
import { Entity, entityConfigSchema } from "../Entity";
import { idHandlerRegistry } from "../../fields";
import { parse } from "bknd/utils";

describe("Entity Custom ID Handler Configuration", () => {
   beforeEach(() => {
      // Clear registry before each test
      idHandlerRegistry.clear();
   });

   describe("entityConfigSchema validation", () => {
      it("should accept valid custom_id_handler configuration", () => {
         const config = {
            name: "Test Entity",
            primary_format: "custom" as const,
            custom_id_handler: {
               type: "function" as const,
               handler: (entity: string) => `test_${entity}_${Date.now()}`,
            },
         };

         const parsed = parse(entityConfigSchema, config);
         expect(parsed.custom_id_handler).toBeDefined();
         expect(parsed.custom_id_handler?.type).toBe("function");
      });

      it("should accept import-based custom_id_handler configuration", () => {
         const config = {
            name: "Test Entity",
            primary_format: "custom" as const,
            custom_id_handler: {
               type: "import" as const,
               importPath: "./custom-handlers",
               functionName: "generateCustomId",
               options: { prefix: "test" },
            },
         };

         const parsed = parse(entityConfigSchema, config);
         expect(parsed.custom_id_handler).toBeDefined();
         expect(parsed.custom_id_handler?.type).toBe("import");
         expect(parsed.custom_id_handler?.importPath).toBe("./custom-handlers");
         expect(parsed.custom_id_handler?.functionName).toBe("generateCustomId");
      });

      it("should accept configuration without custom_id_handler", () => {
         const config = {
            name: "Test Entity",
            primary_format: "uuid" as const,
         };

         const parsed = parse(entityConfigSchema, config);
         expect(parsed.custom_id_handler).toBeUndefined();
      });
   });

   describe("Entity constructor with custom ID handlers", () => {
      it("should create entity with function-based custom ID handler", () => {
         const customHandler = (entity: string) => `custom_${entity}_${Date.now()}`;
         
         const entity = new Entity("test_entity", [], {
            name: "Test Entity",
            primary_format: "custom",
            custom_id_handler: {
               type: "function",
               handler: customHandler,
            },
         });

         expect(entity.hasCustomIdHandler()).toBe(true);
         expect(entity.getCustomIdHandler()).toBeDefined();
         expect(entity.getCustomIdHandler()?.type).toBe("function");
         expect(entity.getPrimaryField().isCustomFormat()).toBe(true);
      });

      it("should create entity with import-based custom ID handler configuration", () => {
         const entity = new Entity("test_entity", [], {
            name: "Test Entity",
            primary_format: "custom",
            custom_id_handler: {
               type: "import",
               importPath: "./handlers/custom-id",
               functionName: "generateId",
            },
         });

         expect(entity.hasCustomIdHandler()).toBe(true);
         expect(entity.getCustomIdHandler()?.type).toBe("import");
         expect(entity.getCustomIdHandler()?.importPath).toBe("./handlers/custom-id");
      });

      it("should register function-based custom handler in registry", () => {
         const customHandler = (entity: string) => `custom_${entity}_123`;
         
         new Entity("test_entity", [], {
            name: "Test Entity",
            primary_format: "custom",
            custom_id_handler: {
               type: "function",
               handler: customHandler,
            },
         });

         const registeredHandler = idHandlerRegistry.getHandler("entity_test_entity");
         expect(registeredHandler).toBeDefined();
         expect(registeredHandler?.name).toBe("test_entity Custom Handler");
      });

      it("should create entity without custom handler when format is not custom", () => {
         const entity = new Entity("test_entity", [], {
            name: "Test Entity",
            primary_format: "uuid",
         });

         expect(entity.hasCustomIdHandler()).toBe(false);
         expect(entity.getCustomIdHandler()).toBeUndefined();
         expect(entity.getPrimaryField().isCustomFormat()).toBe(false);
      });
   });

   describe("Entity validation", () => {
      it("should throw error when custom_id_handler is provided but primary_format is not custom", () => {
         expect(() => {
            new Entity("test_entity", [], {
               name: "Test Entity",
               primary_format: "uuid",
               custom_id_handler: {
                  type: "function",
                  handler: () => "test",
               },
            });
         }).toThrow("custom_id_handler is configured but primary_format is not set to \"custom\"");
      });

      it("should throw error when primary_format is custom but no custom_id_handler is provided", () => {
         expect(() => {
            new Entity("test_entity", [], {
               name: "Test Entity",
               primary_format: "custom",
            });
         }).toThrow("primary_format is set to \"custom\" but no custom_id_handler is configured");
      });

      it("should throw error when function type handler has no handler function", () => {
         expect(() => {
            new Entity("test_entity", [], {
               name: "Test Entity",
               primary_format: "custom",
               custom_id_handler: {
                  type: "function",
               },
            });
         }).toThrow("Handler function is required when type is \"function\"");
      });

      it("should throw error when import type handler has no import path", () => {
         expect(() => {
            new Entity("test_entity", [], {
               name: "Test Entity",
               primary_format: "custom",
               custom_id_handler: {
                  type: "import",
                  functionName: "generateId",
               },
            });
         }).toThrow("Import path is required when type is \"import\"");
      });

      it("should throw error when import type handler has no function name", () => {
         expect(() => {
            new Entity("test_entity", [], {
               name: "Test Entity",
               primary_format: "custom",
               custom_id_handler: {
                  type: "import",
                  importPath: "./handlers",
               },
            });
         }).toThrow("Function name is required when type is \"import\"");
      });
   });

   describe("Entity methods", () => {
      it("should return correct custom handler configuration", () => {
         const customHandler = {
            type: "function" as const,
            handler: (entity: string) => `test_${entity}`,
            options: { prefix: "test" },
         };

         const entity = new Entity("test_entity", [], {
            name: "Test Entity",
            primary_format: "custom",
            custom_id_handler: customHandler,
         });

         const retrievedHandler = entity.getCustomIdHandler();
         expect(retrievedHandler).toEqual(customHandler);
      });

      it("should correctly identify entities with custom handlers", () => {
         const entityWithCustom = new Entity("test_entity", [], {
            name: "Test Entity",
            primary_format: "custom",
            custom_id_handler: {
               type: "function",
               handler: () => "test",
            },
         });

         const entityWithoutCustom = new Entity("regular_entity", [], {
            name: "Regular Entity",
            primary_format: "uuid",
         });

         expect(entityWithCustom.hasCustomIdHandler()).toBe(true);
         expect(entityWithoutCustom.hasCustomIdHandler()).toBe(false);
      });
   });

   describe("Entity JSON serialization", () => {
      it("should include custom_id_handler in toJSON output", () => {
         const entity = new Entity("test_entity", [], {
            name: "Test Entity",
            primary_format: "custom",
            custom_id_handler: {
               type: "import",
               importPath: "./handlers",
               functionName: "generateId",
            },
         });

         const json = entity.toJSON();
         expect(json.config.custom_id_handler).toBeDefined();
         expect(json.config.custom_id_handler?.type).toBe("import");
         expect(json.config.primary_format).toBe("custom");
      });
   });
});