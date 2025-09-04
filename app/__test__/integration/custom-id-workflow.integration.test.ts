import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { createApp } from "core/test/utils";
import { Api } from "../../src/Api";
import { getDummyConnection } from "../helper";
import { idHandlerRegistry } from "../../src/data/fields/IdHandlerRegistry";
import { PrimaryField, type CustomIdHandlerConfig } from "../../src/data/fields/PrimaryField";

describe("Custom ID Generation - Complete Workflow Integration", () => {
  let dummyConnection: any;

  beforeEach(() => {
    const { dummyConnection: conn } = getDummyConnection();
    dummyConnection = conn;
    idHandlerRegistry.clear();
  });

  afterEach(() => {
    idHandlerRegistry.clear();
  });

  describe("End-to-End Workflow Tests", () => {
    it("should demonstrate complete custom ID generation workflow", async () => {
      // Step 1: Register custom handlers for different business entities
      
      // User ID handler - generates user IDs with department prefix
      let userCounter = 0;
      idHandlerRegistry.register('user-id-handler', {
        id: 'user-id-handler',
        name: 'User ID Generator',
        handler: (entity: string, data?: any) => {
          const dept = data?.department || 'GEN';
          userCounter++;
          const timestamp = Date.now().toString().slice(-6);
          return `${dept}-${userCounter}-${timestamp}`;
        },
        validate: (config: any) => {
          if (config.department && typeof config.department !== 'string') {
            return 'Department must be a string';
          }
          return true;
        },
        description: 'Generates user IDs with department prefix'
      });

      // Order ID handler - generates order IDs with year and sequence
      let orderCounter = 0;
      idHandlerRegistry.register('order-id-handler', {
        id: 'order-id-handler',
        name: 'Order ID Generator',
        handler: (entity: string, data?: any) => {
          orderCounter++;
          const year = new Date().getFullYear();
          const sequence = orderCounter.toString().padStart(6, '0');
          return `ORD-${year}-${sequence}`;
        },
        description: 'Generates sequential order IDs with year prefix'
      });

      // Product ID handler - generates product IDs by category
      const productCounters = new Map<string, number>();
      idHandlerRegistry.register('product-id-handler', {
        id: 'product-id-handler',
        name: 'Product ID Generator',
        handler: (entity: string, data?: any) => {
          const category = data?.category || 'MISC';
          const current = productCounters.get(category) || 0;
          const next = current + 1;
          productCounters.set(category, next);
          return `${category}-${next.toString().padStart(4, '0')}`;
        },
        description: 'Generates product IDs by category with sequential numbering'
      });

      // Step 2: Test PrimaryField integration with custom handlers
      
      const userField = new PrimaryField('id', {
        format: 'custom',
        customHandler: {
          type: 'function',
          handler: async (entity: string, data?: any) => {
            const result = await idHandlerRegistry.execute('user-id-handler', entity, data);
            return result.success ? result.value! : `FALLBACK-${Date.now()}`;
          }
        }
      });

      const orderField = new PrimaryField('id', {
        format: 'custom',
        customHandler: {
          type: 'function',
          handler: async (entity: string, data?: any) => {
            const result = await idHandlerRegistry.execute('order-id-handler', entity, data);
            return result.success ? result.value! : `FALLBACK-${Date.now()}`;
          }
        }
      });

      const productField = new PrimaryField('id', {
        format: 'custom',
        customHandler: {
          type: 'function',
          handler: async (entity: string, data?: any) => {
            const result = await idHandlerRegistry.execute('product-id-handler', entity, data);
            return result.success ? result.value! : `FALLBACK-${Date.now()}`;
          }
        }
      });

      // Step 3: Test ID generation for different entities
      
      // Generate user IDs
      const userId1 = await userField.generateCustomId('users', { department: 'ENG' });
      const userId2 = await userField.generateCustomId('users', { department: 'SALES' });
      const userId3 = await userField.generateCustomId('users', {}); // Default department

      expect(userId1).toMatch(/^ENG-\d+-\d{6}$/);
      expect(userId2).toMatch(/^SALES-\d+-\d{6}$/);
      expect(userId3).toMatch(/^GEN-\d+-\d{6}$/);

      // Generate order IDs
      const orderId1 = await orderField.generateCustomId('orders');
      const orderId2 = await orderField.generateCustomId('orders');
      const orderId3 = await orderField.generateCustomId('orders');

      const currentYear = new Date().getFullYear();
      expect(orderId1).toBe(`ORD-${currentYear}-000001`);
      expect(orderId2).toBe(`ORD-${currentYear}-000002`);
      expect(orderId3).toBe(`ORD-${currentYear}-000003`);

      // Generate product IDs
      const productId1 = await productField.generateCustomId('products', { category: 'ELECTRONICS' });
      const productId2 = await productField.generateCustomId('products', { category: 'CLOTHING' });
      const productId3 = await productField.generateCustomId('products', { category: 'ELECTRONICS' });

      expect(productId1).toBe('ELECTRONICS-0001');
      expect(productId2).toBe('CLOTHING-0001');
      expect(productId3).toBe('ELECTRONICS-0002');

      // Step 4: Test error handling and fallback
      
      const errorField = new PrimaryField('id', {
        format: 'custom',
        customHandler: {
          type: 'function',
          handler: (entity: string, data?: any) => {
            if (!data?.required) {
              throw new Error('Required field missing');
            }
            return `VALID-${data.required}`;
          }
        }
      });

      // Test successful generation
      const validId = await errorField.generateCustomId('test', { required: 'value' });
      expect(validId).toBe('VALID-value');

      // Test fallback on error
      const fallbackResult = await errorField.generateCustomIdWithFallback('test', {});
      expect(fallbackResult.success).toBe(true);
      expect(fallbackResult.fallbackUsed).toBe(true);
      expect(fallbackResult.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

      // Step 5: Verify all generated IDs are unique
      const allIds = [userId1, userId2, userId3, orderId1, orderId2, orderId3, productId1, productId2, productId3, validId];
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });

    it("should handle complex business scenario with relationships", async () => {
      // Simulate a complete e-commerce scenario with customers, orders, and order items
      
      // Customer ID handler
      let customerCounter = 1000;
      idHandlerRegistry.register('customer-id', {
        id: 'customer-id',
        name: 'Customer ID Generator',
        handler: (entity: string, data?: any) => {
          const type = data?.type || 'IND'; // Individual or Business
          const region = data?.region || 'US';
          customerCounter++;
          return `${type}-${region}-${customerCounter.toString().padStart(6, '0')}`;
        },
        description: 'Customer ID with type and region'
      });

      // Order ID handler with customer reference
      const ordersByCustomer = new Map<string, number>();
      idHandlerRegistry.register('order-id', {
        id: 'order-id',
        name: 'Order ID Generator',
        handler: (entity: string, data?: any) => {
          const customerId = data?.customer_id;
          if (!customerId) {
            throw new Error('Customer ID required');
          }

          const customerOrderCount = ordersByCustomer.get(customerId) || 0;
          const nextCount = customerOrderCount + 1;
          ordersByCustomer.set(customerId, nextCount);

          const year = new Date().getFullYear();
          return `ORD-${year}-${customerId}-${nextCount.toString().padStart(3, '0')}`;
        },
        description: 'Order ID linked to customer'
      });

      // Order item ID handler
      let orderItemCounter = 0;
      idHandlerRegistry.register('order-item-id', {
        id: 'order-item-id',
        name: 'Order Item ID Generator',
        handler: (entity: string, data?: any) => {
          const orderId = data?.order_id;
          if (!orderId) {
            throw new Error('Order ID required');
          }

          orderItemCounter++;
          return `${orderId}-ITEM-${orderItemCounter.toString().padStart(3, '0')}`;
        },
        description: 'Order item ID linked to order'
      });

      // Create customers
      const customer1Result = await idHandlerRegistry.execute('customer-id', 'customers', {
        type: 'BUS',
        region: 'US'
      });

      const customer2Result = await idHandlerRegistry.execute('customer-id', 'customers', {
        type: 'IND',
        region: 'CA'
      });

      expect(customer1Result.success).toBe(true);
      expect(customer2Result.success).toBe(true);
      expect(customer1Result.value).toBe('BUS-US-001001');
      expect(customer2Result.value).toBe('IND-CA-001002');

      // Create orders for customers
      const order1Result = await idHandlerRegistry.execute('order-id', 'orders', {
        customer_id: customer1Result.value
      });

      const order2Result = await idHandlerRegistry.execute('order-id', 'orders', {
        customer_id: customer1Result.value
      });

      const order3Result = await idHandlerRegistry.execute('order-id', 'orders', {
        customer_id: customer2Result.value
      });

      expect(order1Result.success).toBe(true);
      expect(order2Result.success).toBe(true);
      expect(order3Result.success).toBe(true);

      const currentYear = new Date().getFullYear();
      expect(order1Result.value).toBe(`ORD-${currentYear}-BUS-US-001001-001`);
      expect(order2Result.value).toBe(`ORD-${currentYear}-BUS-US-001001-002`);
      expect(order3Result.value).toBe(`ORD-${currentYear}-IND-CA-001002-001`);

      // Create order items
      const item1Result = await idHandlerRegistry.execute('order-item-id', 'order_items', {
        order_id: order1Result.value
      });

      const item2Result = await idHandlerRegistry.execute('order-item-id', 'order_items', {
        order_id: order1Result.value
      });

      const item3Result = await idHandlerRegistry.execute('order-item-id', 'order_items', {
        order_id: order3Result.value
      });

      expect(item1Result.success).toBe(true);
      expect(item2Result.success).toBe(true);
      expect(item3Result.success).toBe(true);

      expect(item1Result.value).toBe(`${order1Result.value}-ITEM-001`);
      expect(item2Result.value).toBe(`${order1Result.value}-ITEM-002`);
      expect(item3Result.value).toBe(`${order3Result.value}-ITEM-003`);

      // Verify relationships are maintained in IDs
      expect(item1Result.value).toContain(order1Result.value as string);
      expect(item2Result.value).toContain(order1Result.value as string);
      expect(item3Result.value).toContain(order3Result.value as string);

      expect(order1Result.value).toContain(customer1Result.value as string);
      expect(order2Result.value).toContain(customer1Result.value as string);
      expect(order3Result.value).toContain(customer2Result.value as string);
    });

    it("should demonstrate validation and error recovery workflow", async () => {
      // Register a handler with comprehensive validation
      idHandlerRegistry.register('validated-handler', {
        id: 'validated-handler',
        name: 'Validated Handler',
        handler: (entity: string, data?: any) => {
          // Validate required fields
          if (!data?.prefix) {
            throw new Error('Prefix is required');
          }

          if (!data?.sequence) {
            throw new Error('Sequence number is required');
          }

          // Validate data types
          if (typeof data.prefix !== 'string') {
            throw new Error('Prefix must be a string');
          }

          if (typeof data.sequence !== 'number') {
            throw new Error('Sequence must be a number');
          }

          // Validate business rules
          if (data.prefix.length > 5) {
            throw new Error('Prefix must be 5 characters or less');
          }

          if (data.sequence < 1 || data.sequence > 999999) {
            throw new Error('Sequence must be between 1 and 999999');
          }

          return `${data.prefix}-${data.sequence.toString().padStart(6, '0')}`;
        },
        validate: (config: any) => {
          const errors: string[] = [];

          if (config.prefix && typeof config.prefix !== 'string') {
            errors.push('Prefix must be a string');
          }

          if (config.prefix && config.prefix.length > 5) {
            errors.push('Prefix must be 5 characters or less');
          }

          if (config.sequence && typeof config.sequence !== 'number') {
            errors.push('Sequence must be a number');
          }

          if (config.sequence && (config.sequence < 1 || config.sequence > 999999)) {
            errors.push('Sequence must be between 1 and 999999');
          }

          return errors.length === 0 ? true : errors.join(', ');
        },
        description: 'Handler with comprehensive validation'
      });

      // Test configuration validation
      const validConfig = idHandlerRegistry.validateConfig('validated-handler', {
        prefix: 'TEST',
        sequence: 123
      });
      expect(validConfig.valid).toBe(true);

      const invalidConfig1 = idHandlerRegistry.validateConfig('validated-handler', {
        prefix: 123, // Invalid type
        sequence: 'abc' // Invalid type
      });
      expect(invalidConfig1.valid).toBe(false);
      expect(invalidConfig1.errors[0]).toContain('Prefix must be a string');

      const invalidConfig2 = idHandlerRegistry.validateConfig('validated-handler', {
        prefix: 'TOOLONG', // Too long
        sequence: 1000000 // Out of range
      });
      expect(invalidConfig2.valid).toBe(false);
      expect(invalidConfig2.errors[0]).toContain('Prefix must be 5 characters or less');

      // Test successful execution
      const successResult = await idHandlerRegistry.execute('validated-handler', 'test', {
        prefix: 'VALID',
        sequence: 42
      });
      expect(successResult.success).toBe(true);
      expect(successResult.value).toBe('VALID-000042');

      // Test error scenarios with fallback
      const missingPrefixResult = await idHandlerRegistry.executeWithFallback('validated-handler', 'test', {
        sequence: 123
      });
      expect(missingPrefixResult.success).toBe(true);
      expect(missingPrefixResult.fallbackUsed).toBe(true);

      const invalidTypeResult = await idHandlerRegistry.executeWithFallback('validated-handler', 'test', {
        prefix: 123,
        sequence: 'abc'
      });
      expect(invalidTypeResult.success).toBe(true);
      expect(invalidTypeResult.fallbackUsed).toBe(true);

      const outOfRangeResult = await idHandlerRegistry.executeWithFallback('validated-handler', 'test', {
        prefix: 'TEST',
        sequence: 2000000
      });
      expect(outOfRangeResult.success).toBe(true);
      expect(outOfRangeResult.fallbackUsed).toBe(true);

      // All fallback results should be valid UUIDs
      const fallbackIds = [
        missingPrefixResult.value,
        invalidTypeResult.value,
        outOfRangeResult.value
      ];

      fallbackIds.forEach(id => {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      });
    });

    it("should handle async operations and timeouts", async () => {
      // Register handlers with different async behaviors
      
      // Fast async handler with unique counter
      let fastCounter = 0;
      idHandlerRegistry.register('fast-async', {
        id: 'fast-async',
        name: 'Fast Async Handler',
        handler: async (entity: string, data?: any) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          fastCounter++;
          return `FAST-${entity}-${fastCounter}-${Date.now()}`;
        },
        description: 'Fast async handler'
      });

      // Slow async handler
      idHandlerRegistry.register('slow-async', {
        id: 'slow-async',
        name: 'Slow Async Handler',
        handler: async (entity: string, data?: any) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return `SLOW-${entity}-${Date.now()}`;
        },
        description: 'Slow async handler'
      });

      // Very slow handler (simulates timeout scenario)
      idHandlerRegistry.register('timeout-async', {
        id: 'timeout-async',
        name: 'Timeout Async Handler',
        handler: async (entity: string, data?: any) => {
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
          return `TIMEOUT-${entity}-${Date.now()}`;
        },
        description: 'Handler that simulates timeout'
      });

      // Test fast async handler
      const startTime1 = Date.now();
      const fastResult = await idHandlerRegistry.execute('fast-async', 'test');
      const duration1 = Date.now() - startTime1;

      expect(fastResult.success).toBe(true);
      expect(fastResult.value).toMatch(/^FAST-test-\d+-\d+$/);
      expect(duration1).toBeLessThan(100); // Should complete quickly

      // Test slow async handler
      const startTime2 = Date.now();
      const slowResult = await idHandlerRegistry.execute('slow-async', 'test');
      const duration2 = Date.now() - startTime2;

      expect(slowResult.success).toBe(true);
      expect(slowResult.value).toMatch(/^SLOW-test-\d+$/);
      expect(duration2).toBeGreaterThan(90); // Should take at least 100ms

      // Test concurrent async operations
      const concurrentPromises = Array.from({ length: 10 }, (_, i) => 
        idHandlerRegistry.execute('fast-async', 'concurrent', { index: i })
      );

      const concurrentResults = await Promise.all(concurrentPromises);

      concurrentResults.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.value).toMatch(/^FAST-concurrent-\d+-\d+$/);
      });

      // All concurrent results should be unique
      const concurrentIds = concurrentResults.map(r => r.value);
      const uniqueConcurrentIds = new Set(concurrentIds);
      expect(uniqueConcurrentIds.size).toBe(concurrentIds.length);

      // Note: Timeout testing would require implementing actual timeout logic
      // For now, we just verify the handler is registered
      const timeoutHandler = idHandlerRegistry.getHandler('timeout-async');
      expect(timeoutHandler).toBeDefined();
      expect(timeoutHandler?.name).toBe('Timeout Async Handler');
    });
  });

  describe("Integration with Entity Management", () => {
    it("should demonstrate integration with entity creation workflow", async () => {
      // This test shows how custom ID generation would integrate with actual entity creation
      // Note: This doesn't create actual database entities, but demonstrates the workflow
      
      const app = createApp({ connection: dummyConnection });
      await app.build();

      // Register business-specific handlers
      let entityUserCounter = 0;
      idHandlerRegistry.register('user-handler', {
        id: 'user-handler',
        name: 'User Handler',
        handler: (entity: string, data?: any) => {
          const dept = data?.department || 'GENERAL';
          entityUserCounter++;
          const timestamp = Date.now().toString().slice(-6);
          return `USR-${dept}-${entityUserCounter}-${timestamp}`;
        },
        description: 'User ID handler'
      });

      idHandlerRegistry.register('product-handler', {
        id: 'product-handler',
        name: 'Product Handler',
        handler: (entity: string, data?: any) => {
          const category = data?.category || 'MISC';
          const sku = data?.sku || Math.random().toString(36).substr(2, 8).toUpperCase();
          return `${category}-${sku}`;
        },
        description: 'Product ID handler'
      });

      // Create PrimaryField instances that would be used in entity definitions
      const userIdField = new PrimaryField('id', {
        format: 'custom',
        customHandler: {
          type: 'function',
          handler: async (entity: string, data?: any) => {
            const result = await idHandlerRegistry.execute('user-handler', entity, data);
            return result.success ? result.value! : `FALLBACK-${Date.now()}`;
          }
        }
      });

      const productIdField = new PrimaryField('id', {
        format: 'custom',
        customHandler: {
          type: 'function',
          handler: async (entity: string, data?: any) => {
            const result = await idHandlerRegistry.execute('product-handler', entity, data);
            return result.success ? result.value! : `FALLBACK-${Date.now()}`;
          }
        }
      });

      // Simulate entity creation workflow
      const userData = { name: 'John Doe', department: 'ENGINEERING', email: 'john@example.com' };
      const userId = await userIdField.generateCustomId('users', userData);
      
      const productData = { name: 'Laptop', category: 'ELECTRONICS', sku: 'LAP001' };
      const productId = await productIdField.generateCustomId('products', productData);

      expect(userId).toMatch(/^USR-ENGINEERING-\d+-\d{6}$/);
      expect(productId).toBe('ELECTRONICS-LAP001');

      // Simulate batch entity creation
      const batchUserData = [
        { name: 'Alice Smith', department: 'SALES' },
        { name: 'Bob Johnson', department: 'MARKETING' },
        { name: 'Carol Brown', department: 'ENGINEERING' }
      ];

      const batchUserIds = await Promise.all(
        batchUserData.map(data => userIdField.generateCustomId('users', data))
      );

      expect(batchUserIds).toHaveLength(3);
      batchUserIds.forEach((id, index) => {
        const expectedDept = batchUserData[index].department;
        expect(id).toMatch(new RegExp(`^USR-${expectedDept}-\\d+-\\d{6}$`));
      });

      // Verify all IDs are unique
      const allIds = [userId, productId, ...batchUserIds];
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });
  });
});