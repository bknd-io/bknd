import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdHandlerRegistry, type IdHandler } from '../IdHandlerRegistry';

describe('IdHandlerRegistry', () => {
  let registry: IdHandlerRegistry;

  beforeEach(() => {
    registry = new IdHandlerRegistry();
    registry.clear();
  });

  describe('Handler Registration', () => {
    it('should register a valid handler', () => {
      const handler: IdHandler = {
        id: 'test-handler',
        name: 'Test Handler',
        handler: (entity: string) => `test-${entity}-${Date.now()}`
      };

      expect(() => registry.register('test-handler', handler)).not.toThrow();
      expect(registry.has('test-handler')).toBe(true);
    });

    it('should throw error when registering handler with duplicate id', () => {
      const handler: IdHandler = {
        id: 'duplicate',
        name: 'Duplicate Handler',
        handler: () => 'test'
      };

      registry.register('duplicate', handler);
      
      expect(() => registry.register('duplicate', handler)).toThrow(
        "ID handler with id 'duplicate' is already registered"
      );
    });

    it('should throw error when registering invalid handler', () => {
      const invalidHandler = {
        id: '',
        name: 'Invalid Handler',
        handler: 'not-a-function'
      } as any;

      expect(() => registry.register('invalid', invalidHandler)).toThrow('Invalid handler');
    });

    it('should validate handler with custom validate function', () => {
      const handler: IdHandler = {
        id: 'validating-handler',
        name: 'Validating Handler',
        handler: () => 'test',
        validate: (config: any) => config.valid === true
      };

      expect(() => registry.register('validating-handler', handler)).not.toThrow();
    });
  });

  describe('Handler Retrieval', () => {
    beforeEach(() => {
      const handler: IdHandler = {
        id: 'retrieval-test',
        name: 'Retrieval Test Handler',
        handler: () => 'test-id'
      };
      registry.register('retrieval-test', handler);
    });

    it('should retrieve registered handler', () => {
      const handler = registry.getHandler('retrieval-test');
      expect(handler).toBeDefined();
      expect(handler?.id).toBe('retrieval-test');
      expect(handler?.name).toBe('Retrieval Test Handler');
    });

    it('should return undefined for non-existent handler', () => {
      const handler = registry.getHandler('non-existent');
      expect(handler).toBeUndefined();
    });

    it('should list all registered handlers', () => {
      const handlers = registry.listHandlers();
      expect(Object.keys(handlers)).toContain('retrieval-test');
      expect(handlers['retrieval-test'].name).toBe('Retrieval Test Handler');
    });
  });

  describe('Handler Validation', () => {
    beforeEach(() => {
      const handler: IdHandler = {
        id: 'validation-test',
        name: 'Validation Test Handler',
        handler: () => 'test',
        validate: (config: any) => {
          if (!config.prefix) return 'Prefix is required';
          if (config.prefix.length < 2) return 'Prefix must be at least 2 characters';
          return true;
        }
      };
      registry.register('validation-test', handler);
    });

    it('should validate config with custom validator', () => {
      const validConfig = { prefix: 'TEST' };
      const result = registry.validateConfig('validation-test', validConfig);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid config', () => {
      const invalidConfig = { prefix: 'T' };
      const result = registry.validateConfig('validation-test', invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Prefix must be at least 2 characters');
    });

    it('should return error for non-existent handler', () => {
      const result = registry.validateConfig('non-existent', {});
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Handler with id 'non-existent' not found");
    });

    it('should return valid for handler without custom validator', () => {
      const simpleHandler: IdHandler = {
        id: 'simple',
        name: 'Simple Handler',
        handler: () => 'simple-id'
      };
      registry.register('simple', simpleHandler);

      const result = registry.validateConfig('simple', {});
      expect(result.valid).toBe(true);
    });
  });

  describe('Handler Execution', () => {
    beforeEach(() => {
      const syncHandler: IdHandler = {
        id: 'sync-handler',
        name: 'Sync Handler',
        handler: (entity: string, data?: any) => `${entity}-${data?.suffix || 'default'}`
      };

      const asyncHandler: IdHandler = {
        id: 'async-handler',
        name: 'Async Handler',
        handler: async (entity: string) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return `async-${entity}-${Date.now()}`;
        }
      };

      const errorHandler: IdHandler = {
        id: 'error-handler',
        name: 'Error Handler',
        handler: () => {
          throw new Error('Handler execution failed');
        }
      };

      const invalidReturnHandler: IdHandler = {
        id: 'invalid-return',
        name: 'Invalid Return Handler',
        handler: () => ({ invalid: 'object' }) as any
      };

      registry.register('sync-handler', syncHandler);
      registry.register('async-handler', asyncHandler);
      registry.register('error-handler', errorHandler);
      registry.register('invalid-return', invalidReturnHandler);
    });

    it('should execute synchronous handler', async () => {
      const result = await registry.execute('sync-handler', 'user', { suffix: 'test' });
      expect(result.success).toBe(true);
      expect(result.value).toBe('user-test');
    });

    it('should execute asynchronous handler', async () => {
      const result = await registry.execute('async-handler', 'product');
      expect(result.success).toBe(true);
      expect(typeof result.value).toBe('string');
      expect(result.value).toMatch(/^async-product-\d+$/);
    });

    it('should return error for non-existent handler', async () => {
      const result = await registry.execute('non-existent', 'entity');
      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toContain("Handler with id 'non-existent' not found");
    });

    it('should return error when handler execution fails', async () => {
      const result = await registry.execute('error-handler', 'entity');
      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toContain("Handler execution failed");
    });

    it('should return error when handler returns invalid type', async () => {
      const result = await registry.execute('invalid-return', 'entity');
      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toContain("Handler returned invalid type");
    });
  });

  describe('Handler Execution with Fallback', () => {
    beforeEach(() => {
      const workingHandler: IdHandler = {
        id: 'working-handler',
        name: 'Working Handler',
        handler: () => 'working-id'
      };

      const failingHandler: IdHandler = {
        id: 'failing-handler',
        name: 'Failing Handler',
        handler: () => {
          throw new Error('Handler failed');
        }
      };

      registry.register('working-handler', workingHandler);
      registry.register('failing-handler', failingHandler);
    });

    it('should return handler result when execution succeeds', async () => {
      const result = await registry.executeWithFallback('working-handler', 'entity');
      expect(result.success).toBe(true);
      expect(result.value).toBe('working-id');
      expect(result.fallbackUsed).toBeUndefined();
    });

    it('should fallback to UUID when handler fails', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = await registry.executeWithFallback('failing-handler', 'entity');
      
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(typeof result.value).toBe('string');
      expect(result.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Custom ID handler 'failing-handler' failed"),
        expect.any(String)
      );
      
      consoleSpy.mockRestore();
    });

    it('should fallback to UUID for non-existent handler', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = await registry.executeWithFallback('non-existent', 'entity');
      
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(typeof result.value).toBe('string');
      expect(result.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = IdHandlerRegistry.getInstance();
      const instance2 = IdHandlerRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = IdHandlerRegistry.getInstance();
      const handler: IdHandler = {
        id: 'singleton-test',
        name: 'Singleton Test',
        handler: () => 'test'
      };
      
      instance1.register('singleton-test', handler);
      
      const instance2 = IdHandlerRegistry.getInstance();
      expect(instance2.has('singleton-test')).toBe(true);
    });
  });

  describe('Handler Validation Edge Cases', () => {
    it('should validate handler with all optional fields', () => {
      const fullHandler: IdHandler = {
        id: 'full-handler',
        name: 'Full Handler',
        handler: () => 'test',
        validate: () => true,
        description: 'A complete handler with all fields'
      };

      expect(() => registry.register('full-handler', fullHandler)).not.toThrow();
    });

    it('should handle handler with invalid optional fields', () => {
      const handlerWithInvalidOptionals = {
        id: 'invalid-optionals',
        name: 'Invalid Optionals Handler',
        handler: () => 'test',
        validate: 'not-a-function',
        description: 123
      } as any;

      expect(() => registry.register('invalid-optionals', handlerWithInvalidOptionals)).toThrow();
    });
  });
});