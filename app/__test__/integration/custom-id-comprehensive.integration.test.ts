import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { createApp } from "core/test/utils";
import { Api } from "../../src/Api";
import { getDummyConnection } from "../helper";
import { idHandlerRegistry } from "../../src/data/fields/IdHandlerRegistry";
import { PrimaryField, type CustomIdHandlerConfig } from "../../src/data/fields/PrimaryField";

describe("Custom ID Generation - Comprehensive Integration", () => {
  let dummyConnection: any;

  beforeEach(() => {
    const { dummyConnection: conn } = getDummyConnection();
    dummyConnection = conn;
    idHandlerRegistry.clear();
  });

  afterEach(() => {
    idHandlerRegistry.clear();
  });

  describe("ID Handler Registry Integration", () => {
    it("should register and execute custom handlers", async () => {
      // Register various types of handlers
      idHandlerRegistry.register('prefixed-id', {
        id: 'prefixed-id',
        name: 'Prefixed ID Generator',
        handler: (entity: string, data?: any) => {
          const prefix = data?.prefix || entity.toUpperCase();
          const timestamp = Date.now().toString().slice(-6);
          return `${prefix}-${timestamp}`;
        },
        validate: (config: any) => {
          if (config.prefix && typeof config.prefix !== 'string') {
            return 'Prefix must be a string';
          }
          return true;
        },
        description: 'Generates IDs with custom prefix and timestamp'
      });

      idHandlerRegistry.register('sequential-id', {
        id: 'sequential-id',
        name: 'Sequential ID Generator',
        handler: (() => {
          let counter = 0;
          return (entity: string, data?: any) => {
            counter++;
            const padding = data?.padding || 4;
            return counter.toString().padStart(padding, '0');
          };
        })(),
        description: 'Generates sequential IDs with padding'
      });

      idHandlerRegistry.register('async-id', {
        id: 'async-id',
        name: 'Async ID Generator',
        handler: async (entity: string, data?: any) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return `ASYNC-${entity}-${Date.now()}`;
        },
        description: 'Async ID generator'
      });

      // Test handler execution
      const prefixedResult = await idHandlerRegistry.execute('prefixed-id', 'users', { prefix: 'USR' });
      expect(prefixedResult.success).toBe(true);
      expect(prefixedResult.value).toMatch(/^USR-\d{6}$/);

      const sequentialResult1 = await idHandlerRegistry.execute('sequential-id', 'products');
      const sequentialResult2 = await idHandlerRegistry.execute('sequential-id', 'products');
      expect(sequentialResult1.success).toBe(true);
      expect(sequentialResult2.success).toBe(true);
      expect(sequentialResult1.value).toBe('0001');
      expect(sequentialResult2.value).toBe('0002');

      const asyncResult = await idHandlerRegistry.execute('async-id', 'orders');
      expect(asyncResult.success).toBe(true);
      expect(asyncResult.value).toMatch(/^ASYNC-orders-\d+$/);

      // Test validation
      const validConfig = idHandlerRegistry.validateConfig('prefixed-id', { prefix: 'VALID' });
      expect(validConfig.valid).toBe(true);

      const invalidConfig = idHandlerRegistry.validateConfig('prefixed-id', { prefix: 123 });
      expect(invalidConfig.valid).toBe(false);
      expect(invalidConfig.errors).toContain('Prefix must be a string');
    });

    it("should handle error scenarios with fallback", async () => {
      // Register error-prone handler
      idHandlerRegistry.register('error-handler', {
        id: 'error-handler',
        name: 'Error Handler',
        handler: (entity: string, data?: any) => {
          if (!data?.required) {
            throw new Error('Required field missing');
          }
          return `VALID-${data.required}`;
        },
        description: 'Handler that requires specific data'
      });

      // Test successful execution
      const successResult = await idHandlerRegistry.execute('error-handler', 'test', { required: 'value' });
      expect(successResult.success).toBe(true);
      expect(successResult.value).toBe('VALID-value');

      // Test error with fallback
      const errorResult = await idHandlerRegistry.executeWithFallback('error-handler', 'test', {});
      expect(errorResult.success).toBe(true);
      expect(errorResult.fallbackUsed).toBe(true);
      expect(errorResult.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

      // Test non-existent handler
      const nonExistentResult = await idHandlerRegistry.executeWithFallback('non-existent', 'test');
      expect(nonExistentResult.success).toBe(true);
      expect(nonExistentResult.fallbackUsed).toBe(true);
      expect(nonExistentResult.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("should handle concurrent operations safely", async () => {
      let globalCounter = 0;
      const entityCounters = new Map<string, number>();

      idHandlerRegistry.register('concurrent-handler', {
        id: 'concurrent-handler',
        name: 'Concurrent Handler',
        handler: async (entity: string) => {
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
          
          globalCounter++;
          const entityCount = (entityCounters.get(entity) || 0) + 1;
          entityCounters.set(entity, entityCount);
          
          return `${entity.toUpperCase()}-G${globalCounter}-E${entityCount}`;
        },
        description: 'Handler for testing concurrency'
      });

      // Execute multiple handlers concurrently
      const promises = Array.from({ length: 20 }, (_, i) => 
        idHandlerRegistry.execute('concurrent-handler', i % 2 === 0 ? 'users' : 'products')
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.value).toMatch(/^(USERS|PRODUCTS)-G\d+-E\d+$/);
      });

      // All IDs should be unique
      const ids = results.map(r => r.value);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("PrimaryField Integration", () => {
    it("should generate custom IDs using function handlers", async () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: (entity: string, data?: any) => {
          const prefix = data?.prefix || 'DEFAULT';
          const timestamp = Date.now().toString().slice(-6);
          return `${prefix}-${entity.toUpperCase()}-${timestamp}`;
        }
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      const result = await field.generateCustomId('users', { prefix: 'USR' });
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^USR-USERS-\d{6}$/);
    });

    it("should handle async custom handlers in PrimaryField", async () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: async (entity: string, data?: any) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          const counter = data?.counter || Math.floor(Math.random() * 1000);
          return `ASYNC-${entity}-${counter.toString().padStart(6, '0')}`;
        }
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      const result = await field.generateCustomId('orders', { counter: 42 });
      expect(result).toBe('ASYNC-orders-000042');
    });

    it("should fallback to UUID when custom handler fails", async () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: (entity: string, data?: any) => {
          throw new Error('Simulated failure');
        }
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      const result = await field.generateCustomIdWithFallback('test_entity', {});
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("should handle different return types from custom handlers", async () => {
      // Test string return
      const stringHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: (entity: string) => `STRING-${entity}-${Date.now()}`
      };

      const stringField = new PrimaryField('id', {
        format: 'custom',
        customHandler: stringHandler
      });

      const stringResult = await stringField.generateCustomId('test');
      expect(typeof stringResult).toBe('string');
      expect(stringResult).toMatch(/^STRING-test-\d+$/);

      // Test number return
      const numberHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: (entity: string) => Date.now()
      };

      const numberField = new PrimaryField('id', {
        format: 'custom',
        customHandler: numberHandler
      });

      const numberResult = await numberField.generateCustomId('test');
      expect(typeof numberResult).toBe('number');
      expect(numberResult).toBeGreaterThan(0);
    });
  });

  describe("Business Logic Scenarios", () => {
    it("should support complex business ID generation patterns", async () => {
      // Simulate a business scenario with multiple entity types and complex ID logic
      
      // Customer ID handler
      let customerCounter = 1000;
      idHandlerRegistry.register('customer-id', {
        id: 'customer-id',
        name: 'Customer ID Generator',
        handler: (entity: string, data?: any) => {
          const type = data?.type || 'IND'; // Individual or Business
          const region = data?.region || 'US';
          const id = `${type}-${region}-${(customerCounter++).toString().padStart(6, '0')}`;
          return id;
        },
        description: 'Generates customer IDs with type and region'
      });

      // Invoice ID handler
      const invoicesByCustomer = new Map<string, number>();
      idHandlerRegistry.register('invoice-id', {
        id: 'invoice-id',
        name: 'Invoice ID Generator',
        handler: (entity: string, data?: any) => {
          const customerId = data?.customer_id;
          if (!customerId) {
            throw new Error('Customer ID required for invoice generation');
          }

          const customerInvoiceCount = invoicesByCustomer.get(customerId) || 0;
          const nextCount = customerInvoiceCount + 1;
          invoicesByCustomer.set(customerId, nextCount);

          const year = new Date().getFullYear();
          return `INV-${year}-${customerId}-${nextCount.toString().padStart(3, '0')}`;
        },
        description: 'Generates invoice IDs linked to customers'
      });

      // Test customer creation
      const customer1 = await idHandlerRegistry.execute('customer-id', 'customers', {
        type: 'BUS',
        region: 'US'
      });

      const customer2 = await idHandlerRegistry.execute('customer-id', 'customers', {
        type: 'IND',
        region: 'CA'
      });

      expect(customer1.success).toBe(true);
      expect(customer2.success).toBe(true);
      expect(customer1.value).toBe('BUS-US-001000');
      expect(customer2.value).toBe('IND-CA-001001');

      // Test invoice creation
      const invoice1 = await idHandlerRegistry.execute('invoice-id', 'invoices', {
        customer_id: customer1.value
      });

      const invoice2 = await idHandlerRegistry.execute('invoice-id', 'invoices', {
        customer_id: customer1.value
      });

      const invoice3 = await idHandlerRegistry.execute('invoice-id', 'invoices', {
        customer_id: customer2.value
      });

      expect(invoice1.success).toBe(true);
      expect(invoice2.success).toBe(true);
      expect(invoice3.success).toBe(true);

      const currentYear = new Date().getFullYear();
      expect(invoice1.value).toBe(`INV-${currentYear}-BUS-US-001000-001`);
      expect(invoice2.value).toBe(`INV-${currentYear}-BUS-US-001000-002`);
      expect(invoice3.value).toBe(`INV-${currentYear}-IND-CA-001001-001`);
    });

    it("should handle stateful ID generation with persistence", async () => {
      // Simulate a scenario where ID generation needs to maintain state
      const productCategories = new Map<string, number>();
      
      idHandlerRegistry.register('product-id', {
        id: 'product-id',
        name: 'Product ID Generator',
        handler: (entity: string, data?: any) => {
          const category = data?.category || 'MISC';
          const currentCount = productCategories.get(category) || 0;
          const nextCount = currentCount + 1;
          productCategories.set(category, nextCount);
          
          return `${category}-${nextCount.toString().padStart(4, '0')}`;
        },
        validate: (config: any) => {
          if (config.category && typeof config.category !== 'string') {
            return 'Category must be a string';
          }
          return true;
        },
        description: 'Generates product IDs by category with sequential numbering'
      });

      // Test different categories
      const electronics1 = await idHandlerRegistry.execute('product-id', 'products', { category: 'ELECTRONICS' });
      const clothing1 = await idHandlerRegistry.execute('product-id', 'products', { category: 'CLOTHING' });
      const electronics2 = await idHandlerRegistry.execute('product-id', 'products', { category: 'ELECTRONICS' });
      const misc1 = await idHandlerRegistry.execute('product-id', 'products', {});

      expect(electronics1.success).toBe(true);
      expect(clothing1.success).toBe(true);
      expect(electronics2.success).toBe(true);
      expect(misc1.success).toBe(true);

      expect(electronics1.value).toBe('ELECTRONICS-0001');
      expect(clothing1.value).toBe('CLOTHING-0001');
      expect(electronics2.value).toBe('ELECTRONICS-0002');
      expect(misc1.value).toBe('MISC-0001');

      // Verify state is maintained
      const electronics3 = await idHandlerRegistry.execute('product-id', 'products', { category: 'ELECTRONICS' });
      expect(electronics3.value).toBe('ELECTRONICS-0003');
    });

    it("should handle time-based ID generation", async () => {
      idHandlerRegistry.register('timestamp-id', {
        id: 'timestamp-id',
        name: 'Timestamp ID Generator',
        handler: (entity: string, data?: any) => {
          const now = new Date();
          const year = now.getFullYear();
          const month = (now.getMonth() + 1).toString().padStart(2, '0');
          const day = now.getDate().toString().padStart(2, '0');
          const hour = now.getHours().toString().padStart(2, '0');
          const minute = now.getMinutes().toString().padStart(2, '0');
          const second = now.getSeconds().toString().padStart(2, '0');
          const ms = now.getMilliseconds().toString().padStart(3, '0');
          
          const prefix = data?.prefix || entity.toUpperCase();
          return `${prefix}-${year}${month}${day}-${hour}${minute}${second}${ms}`;
        },
        description: 'Generates IDs based on current timestamp'
      });

      const result1 = await idHandlerRegistry.execute('timestamp-id', 'orders', { prefix: 'ORD' });
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result2 = await idHandlerRegistry.execute('timestamp-id', 'orders', { prefix: 'ORD' });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.value).toMatch(/^ORD-\d{8}-\d{9}$/);
      expect(result2.value).toMatch(/^ORD-\d{8}-\d{9}$/);
      expect(result1.value).not.toBe(result2.value);
    });
  });

  describe("Error Recovery and Data Consistency", () => {
    it("should maintain consistency during partial failures", async () => {
      let shouldFail = false;
      let attemptCount = 0;

      idHandlerRegistry.register('flaky-handler', {
        id: 'flaky-handler',
        name: 'Flaky Handler',
        handler: (entity: string, data?: any) => {
          attemptCount++;
          
          if (shouldFail && attemptCount % 2 === 0) {
            throw new Error(`Simulated failure on attempt ${attemptCount}`);
          }
          
          return `SUCCESS-${entity}-${attemptCount}`;
        },
        description: 'Handler that fails intermittently'
      });

      // First success
      const result1 = await idHandlerRegistry.executeWithFallback('flaky-handler', 'test');
      expect(result1.success).toBe(true);
      expect(result1.fallbackUsed || false).toBe(false);
      expect(result1.value).toBe('SUCCESS-test-1');

      // Enable failures
      shouldFail = true;

      // This should fail and use fallback
      const result2 = await idHandlerRegistry.executeWithFallback('flaky-handler', 'test');
      expect(result2.success).toBe(true);
      expect(result2.fallbackUsed).toBe(true);
      expect(result2.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

      // This should succeed again
      const result3 = await idHandlerRegistry.executeWithFallback('flaky-handler', 'test');
      expect(result3.success).toBe(true);
      expect(result3.fallbackUsed || false).toBe(false);
      expect(result3.value).toBe('SUCCESS-test-3');
    });

    it("should handle resource cleanup properly", async () => {
      const resources = new Set<string>();

      idHandlerRegistry.register('resource-handler', {
        id: 'resource-handler',
        name: 'Resource Handler',
        handler: async (entity: string, data?: any) => {
          const resourceId = `resource-${Date.now()}`;
          resources.add(resourceId);
          
          try {
            // Simulate some work that might fail
            if (data?.shouldFail) {
              throw new Error('Simulated resource failure');
            }
            
            return `${entity}-${resourceId}`;
          } finally {
            // Cleanup resource
            resources.delete(resourceId);
          }
        },
        description: 'Handler that manages resources'
      });

      // Test successful execution
      const successResult = await idHandlerRegistry.execute('resource-handler', 'test', { shouldFail: false });
      expect(successResult.success).toBe(true);
      expect(successResult.value).toMatch(/^test-resource-\d+$/);
      expect(resources.size).toBe(0); // Resource should be cleaned up

      // Test failed execution
      const failResult = await idHandlerRegistry.executeWithFallback('resource-handler', 'test', { shouldFail: true });
      expect(failResult.success).toBe(true);
      expect(failResult.fallbackUsed).toBe(true);
      expect(resources.size).toBe(0); // Resource should still be cleaned up
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle high-volume ID generation efficiently", async () => {
      let counter = 0;
      
      idHandlerRegistry.register('high-volume-handler', {
        id: 'high-volume-handler',
        name: 'High Volume Handler',
        handler: (entity: string, data?: any) => {
          counter++;
          return `HV-${entity}-${counter.toString().padStart(8, '0')}`;
        },
        description: 'Handler optimized for high volume'
      });

      const startTime = performance.now();
      
      // Generate many IDs
      const promises = Array.from({ length: 1000 }, (_, i) => 
        idHandlerRegistry.execute('high-volume-handler', 'test', { index: i })
      );

      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // All should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.value).toBe(`HV-test-${(index + 1).toString().padStart(8, '0')}`);
      });

      // Should complete in reasonable time (less than 1 second for 1000 IDs)
      expect(duration).toBeLessThan(1000);

      // All IDs should be unique
      const ids = results.map(r => r.value);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should handle memory efficiently with large datasets", async () => {
      const largeDataMap = new Map<string, number>();
      
      idHandlerRegistry.register('memory-efficient-handler', {
        id: 'memory-efficient-handler',
        name: 'Memory Efficient Handler',
        handler: (entity: string, data?: any) => {
          const key = `${entity}-${data?.category || 'default'}`;
          const current = largeDataMap.get(key) || 0;
          const next = current + 1;
          largeDataMap.set(key, next);
          
          // Cleanup old entries to prevent memory leaks
          if (largeDataMap.size > 1000) {
            const oldestKey = largeDataMap.keys().next().value;
            largeDataMap.delete(oldestKey);
          }
          
          return `${key}-${next}`;
        },
        description: 'Handler that manages memory efficiently'
      });

      // Generate IDs with different categories
      const categories = ['A', 'B', 'C', 'D', 'E'];
      const promises = Array.from({ length: 500 }, (_, i) => 
        idHandlerRegistry.execute('memory-efficient-handler', 'test', { 
          category: categories[i % categories.length] 
        })
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.value).toMatch(/^test-[A-E]-\d+$/);
      });

      // Memory usage should be controlled
      expect(largeDataMap.size).toBeLessThanOrEqual(1000);
    });
  });
});