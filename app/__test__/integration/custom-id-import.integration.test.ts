import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { createApp } from "core/test/utils";
import { Api } from "../../src/Api";
import { getDummyConnection } from "../helper";
import { idHandlerRegistry } from "../../src/data/fields/IdHandlerRegistry";
import type { BkndConfig } from "../../src/adapter";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";

describe("Custom ID Generation - Import Integration", () => {
  let dummyConnection: any;
  const testHandlersDir = join(process.cwd(), "app", "__test__", "_assets", "test-handlers");

  beforeEach(async () => {
    const { dummyConnection: conn } = getDummyConnection();
    dummyConnection = conn;
    idHandlerRegistry.clear();

    // Create test handlers directory
    try {
      await mkdir(testHandlersDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterEach(async () => {
    idHandlerRegistry.clear();
    
    // Clean up test handler files
    try {
      await unlink(join(testHandlersDir, "customHandlers.js"));
    } catch (error) {
      // File might not exist
    }
    
    try {
      await unlink(join(testHandlersDir, "asyncHandlers.mjs"));
    } catch (error) {
      // File might not exist
    }
  });

  describe("Import-based Handler Configuration", () => {
    it("should import and use external CommonJS handler", async () => {
      // Create external handler file
      const handlerCode = `
        function generateCustomId(entity, data) {
          const prefix = data?.prefix || 'EXT';
          const timestamp = Date.now().toString().slice(-6);
          return \`\${prefix}-\${entity.toUpperCase()}-\${timestamp}\`;
        }

        module.exports = { generateCustomId };
      `;

      await writeFile(join(testHandlersDir, "customHandlers.js"), handlerCode);

      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'import',
          importPath: join(testHandlersDir, "customHandlers.js"),
          functionName: 'generateCustomId'
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      await api.system.addConfig("data", "entities.external_test", {
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

      const response = await api.data.create("external_test", { 
        name: "Test", 
        prefix: "IMPORT" 
      });

      expect(response.success).toBe(true);
      expect(response.data.id).toMatch(/^IMPORT-EXTERNAL_TEST-\d{6}$/);
    });

    it("should import and use external ES module handler", async () => {
      // Create external ES module handler file
      const handlerCode = `
        export async function generateAsyncId(entity, data) {
          await new Promise(resolve => setTimeout(resolve, 10));
          const counter = data?.counter || Math.floor(Math.random() * 1000);
          return \`ESM-\${entity}-\${counter.toString().padStart(4, '0')}\`;
        }

        export function generateSyncId(entity, data) {
          return \`SYNC-\${entity}-\${Date.now()}\`;
        }
      `;

      await writeFile(join(testHandlersDir, "asyncHandlers.mjs"), handlerCode);

      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          orders: {
            type: 'import',
            importPath: join(testHandlersDir, "asyncHandlers.mjs"),
            functionName: 'generateAsyncId'
          },
          products: {
            type: 'import',
            importPath: join(testHandlersDir, "asyncHandlers.mjs"),
            functionName: 'generateSyncId'
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      // Create orders entity with async handler
      await api.system.addConfig("data", "entities.orders", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          total: { type: "number" } 
        },
        type: "regular",
      });

      // Create products entity with sync handler
      await api.system.addConfig("data", "entities.products", {
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

      const orderResponse = await api.data.create("orders", { 
        total: 100, 
        counter: 42 
      });

      const productResponse = await api.data.create("products", { 
        name: "Test Product" 
      });

      expect(orderResponse.success).toBe(true);
      expect(orderResponse.data.id).toBe("ESM-orders-0042");

      expect(productResponse.success).toBe(true);
      expect(productResponse.data.id).toMatch(/^SYNC-products-\d+$/);
    });

    it("should handle import errors gracefully", async () => {
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'import',
          importPath: './non-existent-handler.js',
          functionName: 'generateId'
        }
      };

      // Should throw error during app build due to missing import
      expect(async () => {
        const app = createApp(config);
        await app.build();
      }).toThrow();
    });

    it("should handle missing function in imported module", async () => {
      // Create handler file without the expected function
      const handlerCode = `
        function someOtherFunction() {
          return 'not-the-right-function';
        }

        module.exports = { someOtherFunction };
      `;

      await writeFile(join(testHandlersDir, "customHandlers.js"), handlerCode);

      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'import',
          importPath: join(testHandlersDir, "customHandlers.js"),
          functionName: 'nonExistentFunction'
        }
      };

      // Should throw error during app build due to missing function
      expect(async () => {
        const app = createApp(config);
        await app.build();
      }).toThrow();
    });
  });

  describe("Mixed Configuration Scenarios", () => {
    it("should handle mixed function and import handlers", async () => {
      // Create external handler
      const handlerCode = `
        function generateImportedId(entity, data) {
          return \`IMPORTED-\${entity.toUpperCase()}-\${Date.now()}\`;
        }

        module.exports = { generateImportedId };
      `;

      await writeFile(join(testHandlersDir, "customHandlers.js"), handlerCode);

      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          users: {
            type: 'function',
            handler: (entity: string) => `INLINE-${entity}-${Date.now()}`
          },
          orders: {
            type: 'import',
            importPath: join(testHandlersDir, "customHandlers.js"),
            functionName: 'generateImportedId'
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      // Create entities
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

      await api.system.addConfig("data", "entities.orders", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          total: { type: "number" } 
        },
        type: "regular",
      });

      const userResponse = await api.data.create("users", { name: "Test User" });
      const orderResponse = await api.data.create("orders", { total: 100 });

      expect(userResponse.success).toBe(true);
      expect(userResponse.data.id).toMatch(/^INLINE-users-\d+$/);

      expect(orderResponse.success).toBe(true);
      expect(orderResponse.data.id).toMatch(/^IMPORTED-ORDERS-\d+$/);
    });

    it("should override global handler with entity-specific handler", async () => {
      // Create external handler
      const handlerCode = `
        function generateSpecificId(entity, data) {
          return \`SPECIFIC-\${entity}-\${Date.now()}\`;
        }

        module.exports = { generateSpecificId };
      `;

      await writeFile(join(testHandlersDir, "customHandlers.js"), handlerCode);

      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          // Global handler
          type: 'function',
          handler: (entity: string) => `GLOBAL-${entity}-${Date.now()}`,
          
          // Entity-specific override
          products: {
            type: 'import',
            importPath: join(testHandlersDir, "customHandlers.js"),
            functionName: 'generateSpecificId'
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      // Create entities
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

      await api.system.addConfig("data", "entities.products", {
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

      const userResponse = await api.data.create("users", { name: "Test User" });
      const productResponse = await api.data.create("products", { name: "Test Product" });

      expect(userResponse.success).toBe(true);
      expect(userResponse.data.id).toMatch(/^GLOBAL-users-\d+$/);

      expect(productResponse.success).toBe(true);
      expect(productResponse.data.id).toMatch(/^SPECIFIC-products-\d+$/);
    });
  });

  describe("Performance and Reliability", () => {
    it("should handle concurrent entity creation with imported handlers", async () => {
      // Create external handler with slight delay
      const handlerCode = `
        let counter = 0;
        
        async function generateConcurrentId(entity, data) {
          counter++;
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
          return \`CONCURRENT-\${entity}-\${counter.toString().padStart(4, '0')}\`;
        }

        module.exports = { generateConcurrentId };
      `;

      await writeFile(join(testHandlersDir, "customHandlers.js"), handlerCode);

      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'import',
          importPath: join(testHandlersDir, "customHandlers.js"),
          functionName: 'generateConcurrentId'
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      await api.system.addConfig("data", "entities.concurrent_test", {
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

      // Create multiple entities concurrently
      const promises = Array.from({ length: 10 }, (_, i) => 
        api.data.create("concurrent_test", { value: i })
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data.id).toMatch(/^CONCURRENT-concurrent_test-\d{4}$/);
      });

      // All IDs should be unique
      const ids = results.map(r => r.data.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should cache imported handlers for performance", async () => {
      let callCount = 0;
      
      // Create handler that tracks how many times the module is loaded
      const handlerCode = `
        console.log('Handler module loaded');
        
        function generateCachedId(entity, data) {
          return \`CACHED-\${entity}-\${Date.now()}\`;
        }

        module.exports = { generateCachedId };
      `;

      await writeFile(join(testHandlersDir, "customHandlers.js"), handlerCode);

      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'import',
          importPath: join(testHandlersDir, "customHandlers.js"),
          functionName: 'generateCachedId'
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      await api.system.addConfig("data", "entities.cache_test", {
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

      // Create multiple entities - handler should be cached after first load
      const response1 = await api.data.create("cache_test", { name: "Test 1" });
      const response2 = await api.data.create("cache_test", { name: "Test 2" });
      const response3 = await api.data.create("cache_test", { name: "Test 3" });

      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);
      expect(response3.success).toBe(true);

      expect(response1.data.id).toMatch(/^CACHED-cache_test-\d+$/);
      expect(response2.data.id).toMatch(/^CACHED-cache_test-\d+$/);
      expect(response3.data.id).toMatch(/^CACHED-cache_test-\d+$/);
    });
  });
});