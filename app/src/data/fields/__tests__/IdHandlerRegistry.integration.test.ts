import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { idHandlerRegistry } from '../IdHandlerRegistry';
import { PrimaryField, type CustomIdHandlerConfig } from '../PrimaryField';
import { registerSampleHandlers, clearSampleHandlers } from './sample-handlers';

describe('ID Handler Registry Integration', () => {
  beforeEach(() => {
    clearSampleHandlers();
    registerSampleHandlers();
  });

  afterEach(() => {
    clearSampleHandlers();
  });

  describe('Registry with Sample Handlers', () => {
    it('should have registered sample handlers', () => {
      const handlers = idHandlerRegistry.listHandlers();
      
      expect(handlers['prefixed-id']).toBeDefined();
      expect(handlers['sequential-id']).toBeDefined();
      expect(handlers['uuid-with-prefix']).toBeDefined();
    });

    it('should execute prefixed ID handler', async () => {
      const result = await idHandlerRegistry.execute('prefixed-id', 'user', { prefix: 'USR' });
      
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^USR-\d+$/);
    });

    it('should execute sequential ID handler', async () => {
      const result1 = await idHandlerRegistry.execute('sequential-id', 'product');
      const result2 = await idHandlerRegistry.execute('sequential-id', 'product');
      
      expect(result1).toBe('0001');
      expect(result2).toBe('0002');
    });

    it('should execute UUID with prefix handler', async () => {
      const result = await idHandlerRegistry.execute('uuid-with-prefix', 'order', { prefix: 'ORD' });
      
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^ORD_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should validate handler configurations', () => {
      const validConfig = { prefix: 'TEST' };
      const invalidConfig = { prefix: 123 };
      
      const validResult = idHandlerRegistry.validateConfig('prefixed-id', validConfig);
      const invalidResult = idHandlerRegistry.validateConfig('prefixed-id', invalidConfig);
      
      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Prefix must be a string');
    });
  });

  describe('PrimaryField Integration with Registry', () => {
    it('should work with PrimaryField using function handler', async () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: (entity: string, data?: any) => {
          const prefix = data?.prefix || 'DEF';
          return `${prefix}-${entity}-${Math.random().toString(36).substr(2, 9)}`;
        }
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      const result = await field.generateCustomId('user', { prefix: 'USR' });
      
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^USR-user-[a-z0-9]{9}$/);
    });

    it('should demonstrate complete workflow with validation', async () => {
      // Create a PrimaryField with custom handler
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: (entity: string, data?: any) => {
          if (!data?.companyCode) {
            throw new Error('Company code is required');
          }
          return `${data.companyCode}-${entity.toUpperCase()}-${Date.now()}`;
        }
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      // Test successful generation
      const validResult = await field.generateCustomId('employee', { companyCode: 'ACME' });
      expect(validResult).toMatch(/^ACME-EMPLOYEE-\d+$/);

      // Test fallback on error
      const fallbackResult = await field.generateCustomIdWithFallback('employee', {});
      expect(typeof fallbackResult).toBe('string');
      expect(fallbackResult).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should handle async custom handlers', async () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: async (entity: string, data?: any) => {
          // Simulate async operation (e.g., database lookup)
          await new Promise(resolve => setTimeout(resolve, 10));
          
          const counter = data?.counter || Math.floor(Math.random() * 1000);
          return `${entity}_${counter.toString().padStart(6, '0')}`;
        }
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      const result = await field.generateCustomId('invoice', { counter: 42 });
      expect(result).toBe('invoice_000042');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle handler that returns number', async () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: (entity: string) => {
          return Date.now(); // Returns number
        }
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      const result = await field.generateCustomId('user');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should demonstrate registry fallback behavior', async () => {
      const result = await idHandlerRegistry.executeWithFallback('non-existent-handler', 'entity');
      
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should maintain separate counters for different entities in sequential handler', async () => {
      const userResult1 = await idHandlerRegistry.execute('sequential-id', 'user');
      const productResult1 = await idHandlerRegistry.execute('sequential-id', 'product');
      const userResult2 = await idHandlerRegistry.execute('sequential-id', 'user');
      
      expect(userResult1).toBe('0001');
      expect(productResult1).toBe('0001');
      expect(userResult2).toBe('0002');
    });
  });
});