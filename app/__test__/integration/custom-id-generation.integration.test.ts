import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { createApp } from "core/test/utils";
import { Api } from "../../src/Api";
import { getDummyConnection } from "../helper";
import { idHandlerRegistry } from "../../src/data/fields/IdHandlerRegistry";
import type { BkndConfig } from "../../src/adapter";

describe("Custom ID Generation Integration", () => {
  let dummyConnection: any;

  beforeEach(() => {
    const { dummyConnection: conn } = getDummyConnection();
    dummyConnection = conn;
    idHandlerRegistry.clear();
  });

  afterEach(() => {
    idHandlerRegistry.clear();
  });

  describe("bknd.config.ts Custom Handler Configuration", () => {
    it("should register and use global custom ID handler from config", async () => {
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'function',
          handler: (entity: string) => `GLOBAL-${entity.toUpperCase()}-${Date.now()}`
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      // Create entity with custom primary field
      await api.system.addConfig("data", "entities.users", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          name: { type: "text" } 
        },
        type: "regular",
      });

      // Create a record to test ID generation
      const createResponse = await api.data.create("users", { name: "Test User" });
      
      expect(createResponse.success).toBe(true);
      expect(createResponse.data.id).toMatch(/^GLOBAL-USERS-\d+$/);
    });

    it("should register and use per-entity custom ID handlers from config", async () => {
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          users: {
            type: 'function',
            handler: (entity: string) => `USER-${Date.now()}`
          },
          products: {
            type: 'function', 
            handler: (entity: string) => `PROD-${Math.random().toString(36).substr(2, 8).toUpperCase()}`
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      // Create users entity
      await api.system.addConfig("data", "entities.users", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          name: { type: "text" } 
        },
        type: "regular",
      });

      // Create products entity
      await api.system.addConfig("data", "entities.products", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          title: { type: "text" } 
        },
        type: "regular",
      });

      // Test user creation
      const userResponse = await api.data.create("users", { name: "Test User" });
      expect(userResponse.success).toBe(true);
      expect(userResponse.data.id).toMatch(/^USER-\d+$/);

      // Test product creation
      const productResponse = await api.data.create("products", { title: "Test Product" });
      expect(productResponse.success).toBe(true);
      expect(productResponse.data.id).toMatch(/^PROD-[A-Z0-9]{8}$/);
    });

    it("should handle async custom ID handlers from config", async () => {
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'function',
          handler: async (entity: string) => {
            // Simulate async operation
            await new Promise(resolve => setTimeout(resolve, 10));
            return `ASYNC-${entity.toUpperCase()}-${Date.now()}`;
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      await api.system.addConfig("data", "entities.orders", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          amount: { type: "number" } 
        },
        type: "regular",
      });

      const response = await api.data.create("orders", { amount: 100 });
      
      expect(response.success).toBe(true);
      expect(response.data.id).toMatch(/^ASYNC-ORDERS-\d+$/);
    });
  });

  describe("Admin UI Configuration and Persistence", () => {
    it("should persist custom handler configuration through Admin UI", async () => {
      const app = createApp({ connection: dummyConnection });
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      // Create entity with custom ID handler through Admin UI
      await api.system.addConfig("data", "entities.customers", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom",
          custom_id_handler: {
            type: 'function',
            handler: (entity: string, data?: any) => {
              const prefix = data?.prefix || 'CUST';
              return `${prefix}-${Date.now()}`;
            },
            options: { prefix: 'CUSTOMER' }
          }
        },
        fields: { 
          id: { 
            type: "primary", 
            format: "custom",
            customHandler: {
              type: 'function',
              handler: (entity: string, data?: any) => {
                const prefix = data?.prefix || 'CUST';
                return `${prefix}-${Date.now()}`;
              },
              options: { prefix: 'CUSTOMER' }
            }
          }, 
          email: { type: "text" } 
        },
        type: "regular",
      });

      // Verify configuration was persisted
      const config = await api.system.readConfig();
      expect(config.data.entities.customers).toBeDefined();
      expect(config.data.entities.customers.config.primary_format).toBe("custom");
      expect(config.data.entities.customers.config.custom_id_handler).toBeDefined();

      // Test ID generation with persisted config
      const response = await api.data.create("customers", { email: "test@example.com" });
      expect(response.success).toBe(true);
      expect(response.data.id).toMatch(/^CUSTOMER-\d+$/);
    });

    it("should update custom handler configuration through Admin UI", async () => {
      const app = createApp({ connection: dummyConnection });
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      // Create initial entity
      await api.system.addConfig("data", "entities.invoices", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "integer"
        },
        fields: { 
          id: { type: "primary", format: "integer" }, 
          total: { type: "number" } 
        },
        type: "regular",
      });

      // Update to use custom handler
      await api.system.patchConfig("data", "entities.invoices.config", {
        primary_format: "custom",
        custom_id_handler: {
          type: 'function',
          handler: (entity: string) => `INV-${Date.now()}`,
        }
      });

      await api.system.patchConfig("data", "entities.invoices.fields.id", {
        format: "custom",
        customHandler: {
          type: 'function',
          handler: (entity: string) => `INV-${Date.now()}`,
        }
      });

      // Test updated configuration
      const response = await api.data.create("invoices", { total: 250 });
      expect(response.success).toBe(true);
      expect(response.data.id).toMatch(/^INV-\d+$/);
    });

    it("should remove custom handler configuration through Admin UI", async () => {
      const app = createApp({ connection: dummyConnection });
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      // Create entity with custom handler
      await api.system.addConfig("data", "entities.temp", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom",
          custom_id_handler: {
            type: 'function',
            handler: (entity: string) => `TEMP-${Date.now()}`,
          }
        },
        fields: { 
          id: { 
            type: "primary", 
            format: "custom",
            customHandler: {
              type: 'function',
              handler: (entity: string) => `TEMP-${Date.now()}`,
            }
          }, 
          data: { type: "text" } 
        },
        type: "regular",
      });

      // Remove custom handler, revert to UUID
      await api.system.patchConfig("data", "entities.temp.config", {
        primary_format: "uuid"
      });

      await api.system.patchConfig("data", "entities.temp.fields.id", {
        format: "uuid"
      });

      await api.system.removeConfig("data", "entities.temp.config.custom_id_handler");
      await api.system.removeConfig("data", "entities.temp.fields.id.customHandler");

      // Test reverted configuration
      const response = await api.data.create("temp", { data: "test" });
      expect(response.success).toBe(true);
      expect(response.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe("Entity Creation with Custom ID Generation", () => {
    it("should create entities with sequential custom IDs", async () => {
      let counter = 0;
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'function',
          handler: (entity: string) => {
            counter++;
            return `${entity.toUpperCase()}-${counter.toString().padStart(4, '0')}`;
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      await api.system.addConfig("data", "entities.items", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          name: { type: "text" } 
        },
        type: "regular",
      });

      // Create multiple items
      const item1 = await api.data.create("items", { name: "Item 1" });
      const item2 = await api.data.create("items", { name: "Item 2" });
      const item3 = await api.data.create("items", { name: "Item 3" });

      expect(item1.success).toBe(true);
      expect(item2.success).toBe(true);
      expect(item3.success).toBe(true);

      expect(item1.data.id).toBe("ITEMS-0001");
      expect(item2.data.id).toBe("ITEMS-0002");
      expect(item3.data.id).toBe("ITEMS-0003");
    });

    it("should create entities with data-dependent custom IDs", async () => {
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'function',
          handler: (entity: string, data?: any) => {
            const category = data?.category || 'MISC';
            const timestamp = Date.now().toString().slice(-6);
            return `${category}-${timestamp}`;
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      await api.system.addConfig("data", "entities.products", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          name: { type: "text" },
          category: { type: "text" }
        },
        type: "regular",
      });

      const electronicsProduct = await api.data.create("products", { 
        name: "Laptop", 
        category: "ELECTRONICS" 
      });
      
      const clothingProduct = await api.data.create("products", { 
        name: "T-Shirt", 
        category: "CLOTHING" 
      });

      expect(electronicsProduct.success).toBe(true);
      expect(clothingProduct.success).toBe(true);

      expect(electronicsProduct.data.id).toMatch(/^ELECTRONICS-\d{6}$/);
      expect(clothingProduct.data.id).toMatch(/^CLOTHING-\d{6}$/);
    });

    it("should handle bulk entity creation with custom IDs", async () => {
      let counter = 0;
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'function',
          handler: (entity: string) => {
            counter++;
            return `BULK-${counter}`;
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      await api.system.addConfig("data", "entities.records", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          value: { type: "number" } 
        },
        type: "regular",
      });

      // Create multiple records in sequence
      const promises = Array.from({ length: 5 }, (_, i) => 
        api.data.create("records", { value: i + 1 })
      );

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data.id).toBe(`BULK-${index + 1}`);
      });
    });
  });

  describe("Error Scenarios and Fallback Behavior", () => {
    it("should fallback to UUID when custom handler throws error", async () => {
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'function',
          handler: (entity: string, data?: any) => {
            if (!data?.required) {
              throw new Error("Required field missing");
            }
            return `VALID-${data.required}`;
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      await api.system.addConfig("data", "entities.fallback_test", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          name: { type: "text" } 
        },
        type: "regular",
      });

      // This should trigger fallback due to missing required field
      const response = await api.data.create("fallback_test", { name: "Test" });
      
      expect(response.success).toBe(true);
      // Should fallback to UUID format
      expect(response.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("should handle invalid handler configuration gracefully", async () => {
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'function',
          handler: null as any // Invalid handler
        }
      };

      // This should throw during app build due to invalid configuration
      expect(async () => {
        const app = createApp(config);
        await app.build();
      }).toThrow();
    });

    it("should handle handler that returns invalid ID type", async () => {
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'function',
          handler: (entity: string) => {
            return { invalid: "object" } as any; // Invalid return type
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      await api.system.addConfig("data", "entities.invalid_test", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          name: { type: "text" } 
        },
        type: "regular",
      });

      // Should fallback to UUID due to invalid return type
      const response = await api.data.create("invalid_test", { name: "Test" });
      
      expect(response.success).toBe(true);
      expect(response.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("should handle async handler timeout gracefully", async () => {
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'function',
          handler: async (entity: string) => {
            // Simulate very slow handler
            await new Promise(resolve => setTimeout(resolve, 10000));
            return `SLOW-${entity}`;
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      await api.system.addConfig("data", "entities.timeout_test", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          name: { type: "text" } 
        },
        type: "regular",
      });

      // Should timeout and fallback to UUID
      const response = await api.data.create("timeout_test", { name: "Test" });
      
      expect(response.success).toBe(true);
      expect(response.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("should maintain data integrity when fallback is used", async () => {
      let shouldFail = true;
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'function',
          handler: (entity: string) => {
            if (shouldFail) {
              throw new Error("Simulated failure");
            }
            return `SUCCESS-${entity}`;
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      await api.system.addConfig("data", "entities.integrity_test", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          name: { type: "text" } 
        },
        type: "regular",
      });

      // First creation should fail and use fallback
      const response1 = await api.data.create("integrity_test", { name: "Test 1" });
      expect(response1.success).toBe(true);
      expect(response1.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

      // Fix the handler
      shouldFail = false;

      // Second creation should succeed with custom handler
      const response2 = await api.data.create("integrity_test", { name: "Test 2" });
      expect(response2.success).toBe(true);
      expect(response2.data.id).toMatch(/^SUCCESS-integrity_test$/);

      // Verify both records exist and are retrievable
      const allRecords = await api.data.list("integrity_test");
      expect(allRecords.success).toBe(true);
      expect(allRecords.data.length).toBe(2);
      
      const record1 = allRecords.data.find(r => r.name === "Test 1");
      const record2 = allRecords.data.find(r => r.name === "Test 2");
      
      expect(record1).toBeDefined();
      expect(record2).toBeDefined();
      expect(record1!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(record2!.id).toBe("SUCCESS-integrity_test");
    });
  });
});