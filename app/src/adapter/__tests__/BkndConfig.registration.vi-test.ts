import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFrameworkApp, createRuntimeApp, type BkndConfig } from '../index';
import { idHandlerRegistry } from '../../data/fields/IdHandlerRegistry';

describe('BkndConfig ID Handler Registration', () => {
  beforeEach(() => {
    // Clear registry before each test
    idHandlerRegistry.clear();
  });

  describe('Framework App Registration', () => {
    it('should register global function handler during app creation', async () => {
      const mockHandler = vi.fn((entity: string) => `global-${entity}-${Date.now()}`);
      
      const config: BkndConfig = {
        app: () => ({
          connection: { url: ':memory:' }
        }),
        idHandlers: {
          type: 'function',
          handler: mockHandler
        }
      };

      const app = await createFrameworkApp(config, {});
      expect(app).toBeDefined();

      // Verify handler was registered
      const registeredHandler = idHandlerRegistry.getHandler('global');
      expect(registeredHandler).toBeDefined();
      expect(registeredHandler?.name).toBe('Global Custom Handler');
      expect(registeredHandler?.description).toBe('Custom ID handler configured in bknd.config.ts');

      // Test handler execution
      const result = await idHandlerRegistry.execute('global', 'test-entity');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^global-test-entity-\d+$/);
      expect(mockHandler).toHaveBeenCalledWith('test-entity', undefined);
    });

    it('should register per-entity function handlers during app creation', async () => {
      const userHandler = vi.fn((entity: string) => `user-${entity}-${Date.now()}`);
      const productHandler = vi.fn((entity: string) => `prod-${entity}-${Date.now()}`);
      
      const config: BkndConfig = {
        app: () => ({
          connection: { url: ':memory:' }
        }),
        idHandlers: {
          users: {
            type: 'function',
            handler: userHandler
          },
          products: {
            type: 'function',
            handler: productHandler
          }
        }
      };

      const app = await createFrameworkApp(config, {});
      expect(app).toBeDefined();

      // Verify both handlers were registered
      const userRegisteredHandler = idHandlerRegistry.getHandler('config_users');
      const productRegisteredHandler = idHandlerRegistry.getHandler('config_products');
      
      expect(userRegisteredHandler).toBeDefined();
      expect(userRegisteredHandler?.name).toBe('users Config Handler');
      
      expect(productRegisteredHandler).toBeDefined();
      expect(productRegisteredHandler?.name).toBe('products Config Handler');

      // Test handler execution
      const userResult = await idHandlerRegistry.execute('config_users', 'users');
      const productResult = await idHandlerRegistry.execute('config_products', 'products');
      
      expect(userResult).toMatch(/^user-users-\d+$/);
      expect(productResult).toMatch(/^prod-products-\d+$/);
      
      expect(userHandler).toHaveBeenCalledWith('users', undefined);
      expect(productHandler).toHaveBeenCalledWith('products', undefined);
    });

    it('should throw error for import-based handlers (not yet implemented)', async () => {
      const config: BkndConfig = {
        app: () => ({
          connection: { url: ':memory:' }
        }),
        idHandlers: {
          type: 'import',
          importPath: './handlers/customId',
          functionName: 'generateId'
        }
      };

      await expect(createFrameworkApp(config, {})).rejects.toThrow(
        'Import-based handlers are not yet implemented for global. This will be added in task 10.'
      );
    });
  });

  describe('Runtime App Registration', () => {
    it('should register handlers in runtime app creation', async () => {
      const mockHandler = vi.fn((entity: string) => `runtime-${entity}-id`);
      
      const config: BkndConfig = {
        app: () => ({
          connection: { url: ':memory:' }
        }),
        idHandlers: {
          type: 'function',
          handler: mockHandler
        }
      };

      const app = await createRuntimeApp(config, {});
      expect(app).toBeDefined();

      // Verify handler was registered
      const registeredHandler = idHandlerRegistry.getHandler('global');
      expect(registeredHandler).toBeDefined();
      expect(registeredHandler?.name).toBe('Global Custom Handler');

      // Test handler execution
      const result = await idHandlerRegistry.execute('global', 'test-entity');
      expect(result).toMatch(/^runtime-test-entity-id$/);
    });
  });

  describe('Handler Registration Error Handling', () => {
    it('should handle registration errors gracefully', async () => {
      // Register a handler first to cause a conflict
      idHandlerRegistry.register('global', {
        id: 'global',
        name: 'Existing Handler',
        handler: () => 'existing'
      });

      const config: BkndConfig = {
        app: () => ({
          connection: { url: ':memory:' }
        }),
        idHandlers: {
          type: 'function',
          handler: () => 'new-handler'
        }
      };

      await expect(createFrameworkApp(config, {})).rejects.toThrow(
        "ID handler with id 'global' is already registered"
      );
    });

    it('should validate handler function during registration', async () => {
      const config: BkndConfig = {
        app: () => ({
          connection: { url: ':memory:' }
        }),
        idHandlers: {
          type: 'function',
          handler: null as any
        }
      };

      await expect(createFrameworkApp(config, {})).rejects.toThrow(
        'Handler function is required for global'
      );
    });
  });

  describe('Integration with beforeBuild Hook', () => {
    it('should register handlers before custom beforeBuild hook', async () => {
      const beforeBuildSpy = vi.fn();
      const mockHandler = vi.fn(() => 'test-id');
      
      const config: BkndConfig = {
        app: () => ({
          connection: { url: ':memory:' }
        }),
        idHandlers: {
          type: 'function',
          handler: mockHandler
        },
        beforeBuild: async (app, registries) => {
          // Handler should be registered by this point
          const handler = idHandlerRegistry.getHandler('global');
          expect(handler).toBeDefined();
          beforeBuildSpy();
        }
      };

      const app = await createFrameworkApp(config, {});
      expect(app).toBeDefined();
      expect(beforeBuildSpy).toHaveBeenCalled();
    });
  });
});