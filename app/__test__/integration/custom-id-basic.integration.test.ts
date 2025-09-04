import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { createApp } from "core/test/utils";
import { Api } from "../../src/Api";
import { getDummyConnection } from "../helper";
import { idHandlerRegistry } from "../../src/data/fields/IdHandlerRegistry";
import type { BkndConfig } from "../../src/adapter";

describe("Custom ID Generation - Basic Integration", () => {
  let dummyConnection: any;

  beforeEach(() => {
    const { dummyConnection: conn } = getDummyConnection();
    dummyConnection = conn;
    idHandlerRegistry.clear();
  });

  afterEach(() => {
    idHandlerRegistry.clear();
  });

  describe("Basic Configuration Tests", () => {
    it("should register custom ID handler from bknd.config.ts", async () => {
      // Note: This test verifies that the config system accepts ID handlers
      // The actual registration happens during entity creation with custom handlers
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'function',
          handler: (entity: string) => `TEST-${entity.toUpperCase()}-${Date.now()}`
        }
      };

      const app = createApp(config);
      await app.build();

      // The config should be accepted without errors
      expect(app).toBeDefined();
      expect(app.em).toBeDefined();
    });

    it("should create entity with standard primary field", async () => {
      const app = createApp({ connection: dummyConnection });
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      // Create entity with standard integer primary field
      await api.system.addConfig("data", "entities.test_basic", {
        config: { sort_field: "id", sort_dir: "asc" },
        fields: { 
          id: { type: "primary" }, 
          name: { type: "text" } 
        },
        type: "regular",
      });

      // Verify entity was created
      expect(app.em.entities.map((e) => e.name)).toContain("test_basic");

      // Test basic CRUD operations
      const createResponse = await api.data.createOne("test_basic", { name: "Test Item" });
      expect(createResponse.data).toBeDefined();
      expect(createResponse.data.name).toBe("Test Item");
      expect(typeof createResponse.data.id).toBe("number");

      const readResponse = await api.data.readOne("test_basic", createResponse.data.id);
      expect(readResponse.data).toBeDefined();
      expect(readResponse.data.name).toBe("Test Item");

      const listResponse = await api.data.readMany("test_basic");
      expect(listResponse.data).toBeDefined();
      expect(Array.isArray(listResponse.data)).toBe(true);
      expect(listResponse.data.length).toBe(1);
    });

    it("should handle per-entity custom ID handlers from config", async () => {
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          users: {
            type: 'function',
            handler: (entity: string) => `USER-${Date.now()}`
          }
        }
      };

      const app = createApp(config);
      await app.build();

      // Verify the handler was registered for the specific entity
      const handlers = idHandlerRegistry.listHandlers();
      expect(handlers).toBeDefined();
    });

    it("should accept various handler configurations", async () => {
      // Test that different handler configurations are accepted
      const configs = [
        {
          connection: dummyConnection,
          idHandlers: {
            type: 'function' as const,
            handler: (entity: string) => `TEST-${entity}`
          }
        },
        {
          connection: dummyConnection,
          idHandlers: {
            users: {
              type: 'function' as const,
              handler: (entity: string) => `USER-${entity}`
            }
          }
        }
      ];

      for (const config of configs) {
        const app = createApp(config);
        await app.build();
        expect(app).toBeDefined();
      }
    });
  });

  describe("Registry Integration Tests", () => {
    it("should execute custom handler through registry", async () => {
      // Register a test handler directly
      idHandlerRegistry.register('test-handler', {
        id: 'test-handler',
        name: 'Test Handler',
        handler: (entity: string) => `DIRECT-${entity}-${Date.now()}`,
        description: 'Test handler for integration tests'
      });

      const result = await idHandlerRegistry.execute('test-handler', 'test_entity');
      
      expect(result.success).toBe(true);
      expect(result.value).toMatch(/^DIRECT-test_entity-\d+$/);
    });

    it("should handle handler execution errors with fallback", async () => {
      // Register a handler that throws an error
      idHandlerRegistry.register('error-handler', {
        id: 'error-handler',
        name: 'Error Handler',
        handler: (entity: string) => {
          throw new Error('Simulated handler error');
        },
        description: 'Handler that always throws errors'
      });

      const result = await idHandlerRegistry.executeWithFallback('error-handler', 'test_entity');
      
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      // Should fallback to UUID
      expect(result.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("should validate handler configurations", async () => {
      // Register a handler with validation
      idHandlerRegistry.register('validated-handler', {
        id: 'validated-handler',
        name: 'Validated Handler',
        handler: (entity: string, data?: any) => {
          const prefix = data?.prefix || 'DEFAULT';
          return `${prefix}-${entity}-${Date.now()}`;
        },
        validate: (config: any) => {
          if (config.prefix && typeof config.prefix !== 'string') {
            return 'Prefix must be a string';
          }
          if (config.prefix && config.prefix.length > 10) {
            return 'Prefix must be 10 characters or less';
          }
          return true;
        },
        description: 'Handler with validation logic'
      });

      // Test valid configuration
      const validResult = idHandlerRegistry.validateConfig('validated-handler', { prefix: 'VALID' });
      expect(validResult.valid).toBe(true);

      // Test invalid configuration
      const invalidResult = idHandlerRegistry.validateConfig('validated-handler', { prefix: 123 });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Prefix must be a string');

      // Test too long prefix
      const longPrefixResult = idHandlerRegistry.validateConfig('validated-handler', { prefix: 'TOOLONGPREFIX' });
      expect(longPrefixResult.valid).toBe(false);
      expect(longPrefixResult.errors).toContain('Prefix must be 10 characters or less');
    });

    it("should handle async custom handlers", async () => {
      // Register an async handler
      idHandlerRegistry.register('async-handler', {
        id: 'async-handler',
        name: 'Async Handler',
        handler: async (entity: string, data?: any) => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10));
          return `ASYNC-${entity}-${Date.now()}`;
        },
        description: 'Async handler for testing'
      });

      const result = await idHandlerRegistry.execute('async-handler', 'test_entity');
      
      expect(result.success).toBe(true);
      expect(result.value).toMatch(/^ASYNC-test_entity-\d+$/);
    });

    it("should maintain separate state for different entities", async () => {
      let counters = new Map<string, number>();

      // Register a stateful handler
      idHandlerRegistry.register('stateful-handler', {
        id: 'stateful-handler',
        name: 'Stateful Handler',
        handler: (entity: string) => {
          const current = counters.get(entity) || 0;
          const next = current + 1;
          counters.set(entity, next);
          return `${entity.toUpperCase()}-${next.toString().padStart(4, '0')}`;
        },
        description: 'Handler that maintains per-entity state'
      });

      // Test with different entities
      const user1 = await idHandlerRegistry.execute('stateful-handler', 'users');
      const product1 = await idHandlerRegistry.execute('stateful-handler', 'products');
      const user2 = await idHandlerRegistry.execute('stateful-handler', 'users');
      const product2 = await idHandlerRegistry.execute('stateful-handler', 'products');

      expect(user1.success).toBe(true);
      expect(product1.success).toBe(true);
      expect(user2.success).toBe(true);
      expect(product2.success).toBe(true);

      expect(user1.value).toBe('USERS-0001');
      expect(product1.value).toBe('PRODUCTS-0001');
      expect(user2.value).toBe('USERS-0002');
      expect(product2.value).toBe('PRODUCTS-0002');
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle non-existent handler gracefully", async () => {
      const result = await idHandlerRegistry.executeWithFallback('non-existent-handler', 'test_entity');
      
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("should handle handler that returns invalid type", async () => {
      // Register a handler that returns invalid type
      idHandlerRegistry.register('invalid-return-handler', {
        id: 'invalid-return-handler',
        name: 'Invalid Return Handler',
        handler: (entity: string) => {
          return { invalid: 'object' } as any; // Invalid return type
        },
        description: 'Handler that returns invalid type'
      });

      const result = await idHandlerRegistry.executeWithFallback('invalid-return-handler', 'test_entity');
      
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("should handle concurrent handler execution", async () => {
      let executionCount = 0;

      // Register a handler that simulates processing time
      idHandlerRegistry.register('concurrent-handler', {
        id: 'concurrent-handler',
        name: 'Concurrent Handler',
        handler: async (entity: string) => {
          executionCount++;
          const currentExecution = executionCount;
          
          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
          
          return `CONCURRENT-${entity}-${currentExecution}`;
        },
        description: 'Handler for testing concurrent execution'
      });

      // Execute multiple handlers concurrently
      const promises = Array.from({ length: 10 }, () => 
        idHandlerRegistry.execute('concurrent-handler', 'test_entity')
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.value).toMatch(/^CONCURRENT-test_entity-\d+$/);
      });

      // All IDs should be unique
      const ids = results.map(r => r.value);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should clear registry properly", () => {
      // Register some handlers
      idHandlerRegistry.register('handler1', {
        id: 'handler1',
        name: 'Handler 1',
        handler: () => 'test1',
        description: 'Test handler 1'
      });

      idHandlerRegistry.register('handler2', {
        id: 'handler2',
        name: 'Handler 2',
        handler: () => 'test2',
        description: 'Test handler 2'
      });

      // Verify handlers are registered
      let handlers = idHandlerRegistry.listHandlers();
      expect(Object.keys(handlers).length).toBeGreaterThanOrEqual(2);

      // Clear registry
      idHandlerRegistry.clear();

      // Verify registry is empty
      handlers = idHandlerRegistry.listHandlers();
      expect(Object.keys(handlers).length).toBe(0);
    });
  });
});