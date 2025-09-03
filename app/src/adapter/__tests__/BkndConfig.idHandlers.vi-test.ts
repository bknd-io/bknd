import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeConfig, type BkndConfig } from '../index';
import { idHandlerRegistry } from '../../data/fields/IdHandlerRegistry';

describe('BkndConfig ID Handlers Extension', () => {
  beforeEach(() => {
    // Clear registry before each test
    idHandlerRegistry.clear();
  });

  describe('Configuration Validation', () => {
    it('should validate function-based global handler configuration', async () => {
      const config: BkndConfig = {
        idHandlers: {
          type: 'function',
          handler: (entity: string) => `custom-${entity}-id`
        }
      };

      const result = await makeConfig(config);
      expect(result).toBeDefined();
    });

    it('should validate function-based per-entity handler configuration', async () => {
      const config: BkndConfig = {
        idHandlers: {
          users: {
            type: 'function',
            handler: (entity: string) => `user-${entity}-id`
          },
          products: {
            type: 'function',
            handler: (entity: string) => `prod-${entity}-id`
          }
        }
      };

      const result = await makeConfig(config);
      expect(result).toBeDefined();
    });

    it('should validate import-based handler configuration', async () => {
      const config: BkndConfig = {
        idHandlers: {
          type: 'import',
          importPath: './handlers/customId',
          functionName: 'generateId'
        }
      };

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

    it('should throw error for invalid options type', async () => {
      const config: BkndConfig = {
        idHandlers: {
          type: 'function',
          handler: () => 'test',
          options: 'invalid' as any
        }
      };

      await expect(makeConfig(config)).rejects.toThrow(
        "Invalid idHandler options for global: must be an object"
      );
    });
  });

  describe('Per-Entity Handler Validation', () => {
    it('should validate multiple entity handlers', async () => {
      const config: BkndConfig = {
        idHandlers: {
          users: {
            type: 'function',
            handler: (entity: string) => `user-${Date.now()}`
          },
          orders: {
            type: 'import',
            importPath: './handlers/orderIds',
            functionName: 'generateOrderId'
          }
        }
      };

      const result = await makeConfig(config);
      expect(result).toBeDefined();
    });

    it('should throw error for invalid entity handler', async () => {
      const config: BkndConfig = {
        idHandlers: {
          users: {
            type: 'invalid' as any
          }
        }
      };

      await expect(makeConfig(config)).rejects.toThrow(
        "Invalid idHandler type for users: must be 'function' or 'import'"
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