import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeConfig, type BkndConfig } from '../index';
import { idHandlerRegistry } from '../../data/fields/IdHandlerRegistry';

describe('BkndConfig ID Handlers - Simple Tests', () => {
  beforeEach(() => {
    // Clear registry before each test
    idHandlerRegistry.clear();
  });

  describe('Configuration Validation', () => {
    it('should validate and process global function handler configuration', async () => {
      const mockHandler = vi.fn((entity: string) => `custom-${entity}-id`);
      
      const config: BkndConfig = {
        idHandlers: {
          type: 'function',
          handler: mockHandler
        }
      };

      // This should not throw
      const result = await makeConfig(config);
      expect(result).toBeDefined();
    });

    it('should validate and process per-entity handler configuration', async () => {
      const userHandler = vi.fn((entity: string) => `user-${entity}-id`);
      const productHandler = vi.fn((entity: string) => `prod-${entity}-id`);
      
      const config: BkndConfig = {
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

      // This should not throw
      const result = await makeConfig(config);
      expect(result).toBeDefined();
    });

    it('should throw error for invalid handler type', async () => {
      const config: BkndConfig = {
        idHandlers: {
          type: 'invalid' as any,
          handler: () => 'test'
        }
      };

      await expect(makeConfig(config)).rejects.toThrow(
        "Invalid idHandler type for global: must be 'function' or 'import'"
      );
    });

    it('should throw error for missing handler function', async () => {
      const config: BkndConfig = {
        idHandlers: {
          type: 'function'
          // missing handler
        } as any
      };

      await expect(makeConfig(config)).rejects.toThrow(
        "Invalid idHandler for global: handler function is required when type is 'function'"
      );
    });

    it('should throw error for missing import path', async () => {
      const config: BkndConfig = {
        idHandlers: {
          type: 'import'
          // missing importPath
        } as any
      };

      await expect(makeConfig(config)).rejects.toThrow(
        "Invalid idHandler for global: importPath is required when type is 'import'"
      );
    });

    it('should validate import-based handler configuration', async () => {
      const config: BkndConfig = {
        idHandlers: {
          type: 'import',
          importPath: './handlers/customId',
          functionName: 'generateId'
        }
      };

      // This should not throw during validation
      const result = await makeConfig(config);
      expect(result).toBeDefined();
    });
  });

  describe('Handler Registration Logic', () => {
    it('should test registerIdHandlers function directly', async () => {
      // Import the registerIdHandlers function directly
      const { registerIdHandlers } = await import('../index');
      
      const mockHandler = vi.fn((entity: string) => `test-${entity}-id`);
      const config: BkndConfig = {
        idHandlers: {
          type: 'function',
          handler: mockHandler
        }
      };

      // Create a mock app object
      const mockApp = {} as any;

      // This should register the handler
      await registerIdHandlers(config, mockApp);

      // Verify handler was registered
      const registeredHandler = idHandlerRegistry.getHandler('global');
      expect(registeredHandler).toBeDefined();
      expect(registeredHandler?.name).toBe('Global Custom Handler');
      expect(registeredHandler?.description).toBe('Custom ID handler configured in bknd.config.ts');

      // Test handler execution
      const result = await idHandlerRegistry.execute('global', 'test-entity');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^test-test-entity-id$/);
      expect(mockHandler).toHaveBeenCalledWith('test-entity', undefined);
    });

    it('should register per-entity handlers with correct IDs', async () => {
      const { registerIdHandlers } = await import('../index');
      
      const userHandler = vi.fn((entity: string) => `user-${entity}`);
      const productHandler = vi.fn((entity: string) => `prod-${entity}`);
      
      const config: BkndConfig = {
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

      const mockApp = {} as any;
      await registerIdHandlers(config, mockApp);

      // Verify both handlers were registered with correct IDs
      const userRegisteredHandler = idHandlerRegistry.getHandler('config_users');
      const productRegisteredHandler = idHandlerRegistry.getHandler('config_products');
      
      expect(userRegisteredHandler).toBeDefined();
      expect(userRegisteredHandler?.name).toBe('users Config Handler');
      
      expect(productRegisteredHandler).toBeDefined();
      expect(productRegisteredHandler?.name).toBe('products Config Handler');

      // Test handler execution
      const userResult = await idHandlerRegistry.execute('config_users', 'users');
      const productResult = await idHandlerRegistry.execute('config_products', 'products');
      
      expect(userResult).toBe('user-users');
      expect(productResult).toBe('prod-products');
    });

    it('should throw error for import-based handlers (not yet implemented)', async () => {
      const { registerIdHandlers } = await import('../index');
      
      const config: BkndConfig = {
        idHandlers: {
          type: 'import',
          importPath: './handlers/customId',
          functionName: 'generateId'
        }
      };

      const mockApp = {} as any;

      await expect(registerIdHandlers(config, mockApp)).rejects.toThrow(
        'Import-based handlers are not yet implemented for global. This will be added in task 10.'
      );
    });

    it('should handle registration errors gracefully', async () => {
      const { registerIdHandlers } = await import('../index');
      
      // Register a handler first to cause a conflict
      idHandlerRegistry.register('global', {
        id: 'global',
        name: 'Existing Handler',
        handler: () => 'existing'
      });

      const config: BkndConfig = {
        idHandlers: {
          type: 'function',
          handler: () => 'new-handler'
        }
      };

      const mockApp = {} as any;

      await expect(registerIdHandlers(config, mockApp)).rejects.toThrow(
        "ID handler with id 'global' is already registered"
      );
    });
  });

  describe('Configuration Processing', () => {
    it('should preserve other config properties', async () => {
      const config: BkndConfig = {
        initialConfig: {
          server: { cors: { origin: 'localhost' } }
        },
        idHandlers: {
          type: 'function',
          handler: () => 'test-id'
        }
      };

      const result = await makeConfig(config);
      expect(result.initialConfig?.server?.cors?.origin).toBe('localhost');
    });

    it('should handle config with app function and idHandlers', async () => {
      const config: BkndConfig<{ env: { TEST: string } }> = {
        app: (args) => ({
          initialConfig: { server: { cors: { origin: args.env.TEST } } }
        }),
        idHandlers: {
          type: 'function',
          handler: () => 'test-id'
        }
      };

      const result = await makeConfig(config, { env: { TEST: 'test-origin' } });
      expect(result.initialConfig?.server?.cors?.origin).toBe('test-origin');
    });

    it('should handle empty idHandlers configuration', async () => {
      const config: BkndConfig = {
        idHandlers: undefined
      };

      const result = await makeConfig(config);
      expect(result).toBeDefined();
    });
  });
});