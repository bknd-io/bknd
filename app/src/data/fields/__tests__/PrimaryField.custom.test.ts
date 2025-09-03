import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrimaryField, type CustomIdHandlerConfig } from '../PrimaryField';

describe('PrimaryField Custom ID Generation', () => {
  describe('Custom Handler Configuration', () => {
    it('should create PrimaryField with custom format and function handler', () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: (entity: string) => `custom-${entity}-id`
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      expect(field.format).toBe('custom');
      expect(field.isCustomFormat()).toBe(true);
      expect(field.getCustomHandler()).toEqual(customHandler);
    });

    it('should create PrimaryField with custom format and import handler', () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'import',
        importPath: './handlers/customId',
        functionName: 'generateId'
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      expect(field.format).toBe('custom');
      expect(field.isCustomFormat()).toBe(true);
      expect(field.getCustomHandler()).toEqual(customHandler);
    });

    it('should throw error when custom format is used without handler', () => {
      expect(() => {
        new PrimaryField('id', { format: 'custom' });
      }).toThrow('Custom handler configuration is required when format is \'custom\'');
    });

    it('should throw error when function type is used without handler function', () => {
      expect(() => {
        new PrimaryField('id', {
          format: 'custom',
          customHandler: { type: 'function' }
        });
      }).toThrow('Handler function is required when type is \'function\'');
    });

    it('should throw error when import type is used without import path', () => {
      expect(() => {
        new PrimaryField('id', {
          format: 'custom',
          customHandler: { type: 'import', functionName: 'generateId' }
        });
      }).toThrow('Import path is required when type is \'import\'');
    });

    it('should throw error when import type is used without function name', () => {
      expect(() => {
        new PrimaryField('id', {
          format: 'custom',
          customHandler: { type: 'import', importPath: './handlers' }
        });
      }).toThrow('Function name is required when type is \'import\'');
    });
  });

  describe('Custom ID Generation', () => {
    it('should generate custom ID using function handler', async () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: (entity: string, data?: any) => `${entity}-${data?.suffix || 'default'}`
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      const result = await field.generateCustomId('user', { suffix: 'test' });
      expect(result).toBe('user-test');
    });

    it('should generate custom ID using async function handler', async () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: async (entity: string) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return `async-${entity}-${Date.now()}`;
        }
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      const result = await field.generateCustomId('product');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^async-product-\d+$/);
    });

    it('should throw error when generateCustomId is called on non-custom field', async () => {
      const field = new PrimaryField('id', { format: 'uuid' });

      await expect(field.generateCustomId('user')).rejects.toThrow(
        'Custom ID generation is not configured for this field'
      );
    });

    it('should throw error when custom handler returns invalid type', async () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: () => ({ invalid: 'object' }) as any
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      await expect(field.generateCustomId('user')).rejects.toThrow(
        'Custom handler returned invalid type: expected string or number, got object'
      );
    });

    it('should throw error when custom handler throws exception', async () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: () => {
          throw new Error('Handler failed');
        }
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      await expect(field.generateCustomId('user')).rejects.toThrow(
        'Custom handler execution failed: Handler failed'
      );
    });

    it('should throw error for import-based handlers (not yet implemented)', async () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'import',
        importPath: './handlers/customId',
        functionName: 'generateId'
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      await expect(field.generateCustomId('user')).rejects.toThrow(
        'Import-based custom handlers are not yet implemented'
      );
    });
  });

  describe('Custom ID Generation with Fallback', () => {
    it('should return custom ID when generation succeeds', async () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: (entity: string) => `working-${entity}`
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      const result = await field.generateCustomIdWithFallback('user');
      expect(result).toBe('working-user');
    });

    it('should fallback to UUID when custom handler fails', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: () => {
          throw new Error('Handler failed');
        }
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      const result = await field.generateCustomIdWithFallback('user');
      
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Custom ID generation failed for entity 'user'"),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Field Properties', () => {
    it('should return correct field type for custom format', () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: () => 'custom-id'
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      expect(field.fieldType).toBe('text');
    });

    it('should return undefined for getNewValue when format is custom', () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: () => 'custom-id'
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      expect(field.getNewValue()).toBeUndefined();
    });

    it('should generate correct schema for custom format', () => {
      const customHandler: CustomIdHandlerConfig = {
        type: 'function',
        handler: () => 'custom-id'
      };

      const field = new PrimaryField('id', {
        format: 'custom',
        customHandler
      });

      const schema = field.schema();
      expect(schema.type).toBe('text');
      expect(schema.primary).toBe(true);
      expect(schema.nullable).toBe(false);
    });
  });
});