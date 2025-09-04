import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../Entity";
import { idHandlerRegistry } from "../../fields";

describe("Entity Integration Tests", () => {
   beforeEach(() => {
      // Clear registry before each test
      idHandlerRegistry.clear();
   });

   it("should create entity and register custom handler during entity creation", async () => {
      // Create an entity with custom ID handler
      const entity = new Entity("products", [], {
         name: "Products",
         primary_format: "custom",
         custom_id_handler: {
            type: "function",
            handler: (entityName: string, data?: any) => {
               const prefix = data?.category || "PROD";
               const timestamp = Date.now().toString().slice(-6);
               return `${prefix}_${timestamp}`;
            },
         },
      });

      // Verify entity configuration
      expect(entity.hasCustomIdHandler()).toBe(true);
      expect(entity.getPrimaryField().isCustomFormat()).toBe(true);

      // Verify handler was registered
      const registeredHandler = idHandlerRegistry.getHandler("entity_products");
      expect(registeredHandler).toBeDefined();
      expect(registeredHandler?.name).toBe("products Custom Handler");

      // Verify the handler can be executed
      const result = await idHandlerRegistry.execute("entity_products", "products", { category: "ELEC" });
      expect(result.success).toBe(true);
      expect(typeof result.value).toBe("string");
      expect(result.value).toMatch(/^ELEC_\d{6}$/);
   });

   it("should handle entity creation without custom handlers", () => {
      const entity = new Entity("users", [], {
         name: "Users",
         primary_format: "uuid",
      });

      expect(entity.hasCustomIdHandler()).toBe(false);
      expect(entity.getPrimaryField().isCustomFormat()).toBe(false);
      expect(entity.getCustomIdHandler()).toBeUndefined();

      // Verify no handler was registered
      const registeredHandler = idHandlerRegistry.getHandler("entity_users");
      expect(registeredHandler).toBeUndefined();
   });

   it("should handle multiple entities with different custom handlers", () => {
      // Create first entity with custom handler
      const ordersEntity = new Entity("orders", [], {
         name: "Orders",
         primary_format: "custom",
         custom_id_handler: {
            type: "function",
            handler: () => `ORD_${Date.now()}`,
         },
      });

      // Create second entity with different custom handler
      const invoicesEntity = new Entity("invoices", [], {
         name: "Invoices",
         primary_format: "custom",
         custom_id_handler: {
            type: "function",
            handler: () => `INV_${Date.now()}`,
         },
      });

      // Verify both entities have custom handlers
      expect(ordersEntity.hasCustomIdHandler()).toBe(true);
      expect(invoicesEntity.hasCustomIdHandler()).toBe(true);

      // Verify both handlers were registered with different IDs
      const ordersHandler = idHandlerRegistry.getHandler("entity_orders");
      const invoicesHandler = idHandlerRegistry.getHandler("entity_invoices");

      expect(ordersHandler).toBeDefined();
      expect(invoicesHandler).toBeDefined();
      expect(ordersHandler?.name).toBe("orders Custom Handler");
      expect(invoicesHandler?.name).toBe("invoices Custom Handler");
   });

   it("should serialize and deserialize entity configuration correctly", () => {
      const originalConfig = {
         name: "Test Entity",
         primary_format: "custom" as const,
         custom_id_handler: {
            type: "import" as const,
            importPath: "./handlers/test-handler",
            functionName: "generateTestId",
            options: { prefix: "TEST" },
         },
      };

      const entity = new Entity("test_entity", [], originalConfig);
      const serialized = entity.toJSON();

      // Verify the configuration is preserved in serialization
      expect(serialized.config.custom_id_handler).toEqual(originalConfig.custom_id_handler);
      expect(serialized.config.primary_format).toBe("custom");
   });
});