import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { createApp } from "core/test/utils";
import { Api } from "../../src/Api";
import { getDummyConnection } from "../helper";
import { idHandlerRegistry } from "../../src/data/fields/IdHandlerRegistry";
import type { BkndConfig } from "../../src/adapter";

describe("Custom ID Generation - End-to-End Integration", () => {
  let dummyConnection: any;

  beforeEach(() => {
    const { dummyConnection: conn } = getDummyConnection();
    dummyConnection = conn;
    idHandlerRegistry.clear();
  });

  afterEach(() => {
    idHandlerRegistry.clear();
  });

  describe("Complete Workflow Integration", () => {
    it("should support complete entity lifecycle with custom IDs", async () => {
      // Setup: Create app with custom ID handlers
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          users: {
            type: 'function',
            handler: (entity: string, data?: any) => {
              const dept = data?.department || 'GEN';
              const timestamp = Date.now().toString().slice(-6);
              return `${dept}-${timestamp}`;
            }
          },
          orders: {
            type: 'function',
            handler: (entity: string, data?: any) => {
              const year = new Date().getFullYear();
              const random = Math.random().toString(36).substr(2, 6).toUpperCase();
              return `ORD-${year}-${random}`;
            }
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      // Step 1: Create entities through Admin UI
      await api.system.addConfig("data", "entities.users", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          name: { type: "text" },
          email: { type: "text" },
          department: { type: "text" }
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
          user_id: { type: "text" },
          total: { type: "number" },
          status: { type: "text" }
        },
        type: "regular",
      });

      // Step 2: Create users with custom IDs
      const user1 = await api.data.create("users", { 
        name: "John Doe", 
        email: "john@example.com",
        department: "ENG" 
      });

      const user2 = await api.data.create("users", { 
        name: "Jane Smith", 
        email: "jane@example.com",
        department: "SALES" 
      });

      expect(user1.success).toBe(true);
      expect(user2.success).toBe(true);
      expect(user1.data.id).toMatch(/^ENG-\d{6}$/);
      expect(user2.data.id).toMatch(/^SALES-\d{6}$/);

      // Step 3: Create orders referencing users
      const order1 = await api.data.create("orders", {
        user_id: user1.data.id,
        total: 150.00,
        status: "pending"
      });

      const order2 = await api.data.create("orders", {
        user_id: user2.data.id,
        total: 75.50,
        status: "completed"
      });

      expect(order1.success).toBe(true);
      expect(order2.success).toBe(true);
      expect(order1.data.id).toMatch(/^ORD-\d{4}-[A-Z0-9]{6}$/);
      expect(order2.data.id).toMatch(/^ORD-\d{4}-[A-Z0-9]{6}$/);

      // Step 4: Query and verify relationships work with custom IDs
      const userOrders = await api.data.list("orders", {
        filter: { user_id: user1.data.id }
      });

      expect(userOrders.success).toBe(true);
      expect(userOrders.data.length).toBe(1);
      expect(userOrders.data[0].user_id).toBe(user1.data.id);

      // Step 5: Update records with custom IDs
      const updatedOrder = await api.data.update("orders", order1.data.id, {
        status: "shipped"
      });

      expect(updatedOrder.success).toBe(true);
      expect(updatedOrder.data.id).toBe(order1.data.id);
      expect(updatedOrder.data.status).toBe("shipped");

      // Step 6: Delete records with custom IDs
      const deleteResult = await api.data.delete("orders", order2.data.id);
      expect(deleteResult.success).toBe(true);

      // Verify deletion
      const remainingOrders = await api.data.list("orders");
      expect(remainingOrders.success).toBe(true);
      expect(remainingOrders.data.length).toBe(1);
      expect(remainingOrders.data[0].id).toBe(order1.data.id);
    });

    it("should handle entity schema evolution with custom IDs", async () => {
      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'function',
          handler: (entity: string) => `V1-${entity.toUpperCase()}-${Date.now()}`
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      // Step 1: Create initial entity schema
      await api.system.addConfig("data", "entities.products", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          name: { type: "text" },
          price: { type: "number" }
        },
        type: "regular",
      });

      // Create some initial data
      const product1 = await api.data.create("products", { 
        name: "Widget A", 
        price: 10.99 
      });

      expect(product1.success).toBe(true);
      expect(product1.data.id).toMatch(/^V1-PRODUCTS-\d+$/);

      // Step 2: Evolve schema - add new fields
      await api.system.patchConfig("data", "entities.products.fields", {
        description: { type: "text" },
        category: { type: "text" }
      });

      // Create product with new schema
      const product2 = await api.data.create("products", { 
        name: "Widget B", 
        price: 15.99,
        description: "Advanced widget",
        category: "electronics"
      });

      expect(product2.success).toBe(true);
      expect(product2.data.id).toMatch(/^V1-PRODUCTS-\d+$/);

      // Step 3: Change ID generation strategy
      await api.system.patchConfig("data", "entities.products.config", {
        custom_id_handler: {
          type: 'function',
          handler: (entity: string, data?: any) => {
            const category = data?.category || 'MISC';
            return `V2-${category.toUpperCase()}-${Date.now()}`;
          }
        }
      });

      // Create product with new ID strategy
      const product3 = await api.data.create("products", { 
        name: "Widget C", 
        price: 20.99,
        description: "Premium widget",
        category: "premium"
      });

      expect(product3.success).toBe(true);
      expect(product3.data.id).toMatch(/^V2-PREMIUM-\d+$/);

      // Verify all products exist with their respective ID formats
      const allProducts = await api.data.list("products");
      expect(allProducts.success).toBe(true);
      expect(allProducts.data.length).toBe(3);

      const v1Products = allProducts.data.filter(p => p.id.startsWith('V1-'));
      const v2Products = allProducts.data.filter(p => p.id.startsWith('V2-'));

      expect(v1Products.length).toBe(2);
      expect(v2Products.length).toBe(1);
    });

    it("should support complex business logic in custom ID generation", async () => {
      // Simulate a complex business scenario with multiple entity types
      // and interdependent ID generation logic
      
      let customerCounter = 1000;
      let invoiceCounter = 1;
      const invoicesByCustomer = new Map<string, number>();

      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          customers: {
            type: 'function',
            handler: (entity: string, data?: any) => {
              const type = data?.type || 'IND'; // Individual or Business
              const region = data?.region || 'US';
              const id = `${type}-${region}-${(customerCounter++).toString().padStart(6, '0')}`;
              return id;
            }
          },
          invoices: {
            type: 'function',
            handler: (entity: string, data?: any) => {
              const customerId = data?.customer_id;
              if (!customerId) {
                throw new Error('Customer ID required for invoice generation');
              }

              // Get customer-specific invoice counter
              const customerInvoiceCount = invoicesByCustomer.get(customerId) || 0;
              const nextCount = customerInvoiceCount + 1;
              invoicesByCustomer.set(customerId, nextCount);

              const year = new Date().getFullYear();
              const invoiceId = `INV-${year}-${customerId}-${nextCount.toString().padStart(3, '0')}`;
              return invoiceId;
            }
          },
          payments: {
            type: 'function',
            handler: (entity: string, data?: any) => {
              const invoiceId = data?.invoice_id;
              const method = data?.method || 'CARD';
              const timestamp = Date.now().toString().slice(-8);
              return `PAY-${method}-${timestamp}`;
            }
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      // Create entity schemas
      await api.system.addConfig("data", "entities.customers", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          name: { type: "text" },
          type: { type: "text" },
          region: { type: "text" },
          email: { type: "text" }
        },
        type: "regular",
      });

      await api.system.addConfig("data", "entities.invoices", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          customer_id: { type: "text" },
          amount: { type: "number" },
          status: { type: "text" }
        },
        type: "regular",
      });

      await api.system.addConfig("data", "entities.payments", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          invoice_id: { type: "text" },
          amount: { type: "number" },
          method: { type: "text" }
        },
        type: "regular",
      });

      // Create business workflow
      
      // Step 1: Create customers
      const customer1 = await api.data.create("customers", {
        name: "Acme Corp",
        type: "BUS",
        region: "US",
        email: "billing@acme.com"
      });

      const customer2 = await api.data.create("customers", {
        name: "John Doe",
        type: "IND", 
        region: "CA",
        email: "john@example.com"
      });

      expect(customer1.success).toBe(true);
      expect(customer2.success).toBe(true);
      expect(customer1.data.id).toBe("BUS-US-001000");
      expect(customer2.data.id).toBe("IND-CA-001001");

      // Step 2: Create invoices for customers
      const invoice1 = await api.data.create("invoices", {
        customer_id: customer1.data.id,
        amount: 1500.00,
        status: "pending"
      });

      const invoice2 = await api.data.create("invoices", {
        customer_id: customer1.data.id,
        amount: 750.00,
        status: "pending"
      });

      const invoice3 = await api.data.create("invoices", {
        customer_id: customer2.data.id,
        amount: 250.00,
        status: "pending"
      });

      expect(invoice1.success).toBe(true);
      expect(invoice2.success).toBe(true);
      expect(invoice3.success).toBe(true);

      const currentYear = new Date().getFullYear();
      expect(invoice1.data.id).toBe(`INV-${currentYear}-BUS-US-001000-001`);
      expect(invoice2.data.id).toBe(`INV-${currentYear}-BUS-US-001000-002`);
      expect(invoice3.data.id).toBe(`INV-${currentYear}-IND-CA-001001-001`);

      // Step 3: Create payments for invoices
      const payment1 = await api.data.create("payments", {
        invoice_id: invoice1.data.id,
        amount: 1500.00,
        method: "WIRE"
      });

      const payment2 = await api.data.create("payments", {
        invoice_id: invoice3.data.id,
        amount: 250.00,
        method: "CARD"
      });

      expect(payment1.success).toBe(true);
      expect(payment2.success).toBe(true);
      expect(payment1.data.id).toMatch(/^PAY-WIRE-\d{8}$/);
      expect(payment2.data.id).toMatch(/^PAY-CARD-\d{8}$/);

      // Step 4: Verify complete business workflow
      const allCustomers = await api.data.list("customers");
      const allInvoices = await api.data.list("invoices");
      const allPayments = await api.data.list("payments");

      expect(allCustomers.data.length).toBe(2);
      expect(allInvoices.data.length).toBe(3);
      expect(allPayments.data.length).toBe(2);

      // Verify business logic integrity
      const customer1Invoices = allInvoices.data.filter(inv => 
        inv.customer_id === customer1.data.id
      );
      expect(customer1Invoices.length).toBe(2);

      const paidInvoices = allPayments.data.map(pay => pay.invoice_id);
      expect(paidInvoices).toContain(invoice1.data.id);
      expect(paidInvoices).toContain(invoice3.data.id);
    });
  });

  describe("Error Recovery and Data Consistency", () => {
    it("should maintain data consistency during handler failures", async () => {
      let shouldFail = false;
      let attemptCount = 0;

      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'function',
          handler: (entity: string, data?: any) => {
            attemptCount++;
            
            if (shouldFail && attemptCount % 2 === 0) {
              throw new Error(`Simulated failure on attempt ${attemptCount}`);
            }
            
            return `SUCCESS-${entity}-${attemptCount}`;
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      await api.system.addConfig("data", "entities.resilient_test", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          name: { type: "text" },
          attempt: { type: "number" }
        },
        type: "regular",
      });

      // Create successful record
      const record1 = await api.data.create("resilient_test", { 
        name: "Success 1", 
        attempt: 1 
      });

      expect(record1.success).toBe(true);
      expect(record1.data.id).toBe("SUCCESS-resilient_test-1");

      // Enable failures
      shouldFail = true;

      // This should fail and fallback to UUID
      const record2 = await api.data.create("resilient_test", { 
        name: "Fallback", 
        attempt: 2 
      });

      expect(record2.success).toBe(true);
      expect(record2.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

      // This should succeed again
      const record3 = await api.data.create("resilient_test", { 
        name: "Success 2", 
        attempt: 3 
      });

      expect(record3.success).toBe(true);
      expect(record3.data.id).toBe("SUCCESS-resilient_test-3");

      // Verify all records exist and are queryable
      const allRecords = await api.data.list("resilient_test");
      expect(allRecords.success).toBe(true);
      expect(allRecords.data.length).toBe(3);

      // Verify we can update and delete records with mixed ID formats
      const updateResult = await api.data.update("resilient_test", record2.data.id, {
        name: "Updated Fallback"
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data.name).toBe("Updated Fallback");

      const deleteResult = await api.data.delete("resilient_test", record1.data.id);
      expect(deleteResult.success).toBe(true);

      // Verify final state
      const finalRecords = await api.data.list("resilient_test");
      expect(finalRecords.success).toBe(true);
      expect(finalRecords.data.length).toBe(2);
    });

    it("should handle concurrent operations with custom ID generation", async () => {
      let globalCounter = 0;
      const entityCounters = new Map<string, number>();

      const config: BkndConfig = {
        connection: dummyConnection,
        idHandlers: {
          type: 'function',
          handler: (entity: string, data?: any) => {
            // Simulate some processing time
            const start = Date.now();
            while (Date.now() - start < 10) {
              // Busy wait for 10ms
            }

            globalCounter++;
            const entityCount = (entityCounters.get(entity) || 0) + 1;
            entityCounters.set(entity, entityCount);

            return `${entity.toUpperCase()}-G${globalCounter}-E${entityCount}`;
          }
        }
      };

      const app = createApp(config);
      await app.build();

      const api = new Api({
        host: "http://localhost",
        fetcher: app.server.request as typeof fetch,
      });

      await api.system.addConfig("data", "entities.concurrent", {
        config: { 
          sort_field: "id", 
          sort_dir: "asc",
          primary_format: "custom"
        },
        fields: { 
          id: { type: "primary", format: "custom" }, 
          thread: { type: "number" },
          timestamp: { type: "number" }
        },
        type: "regular",
      });

      // Create multiple records concurrently
      const concurrentPromises = Array.from({ length: 20 }, (_, i) => 
        api.data.create("concurrent", { 
          thread: i, 
          timestamp: Date.now() 
        })
      );

      const results = await Promise.all(concurrentPromises);

      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data.id).toMatch(/^CONCURRENT-G\d+-E\d+$/);
        expect(result.data.thread).toBe(index);
      });

      // All IDs should be unique
      const ids = results.map(r => r.data.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      // Verify all records are persisted correctly
      const allRecords = await api.data.list("concurrent");
      expect(allRecords.success).toBe(true);
      expect(allRecords.data.length).toBe(20);
    });
  });
});