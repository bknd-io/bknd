import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IdHandlerValidator } from '../IdHandlerValidator';
import type { CustomIdHandlerConfig } from '../PrimaryField';
import type { IdHandler } from '../IdHandlerRegistry';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('IdHandlerValidator', () => {
  let validator: IdHandlerValidator;
  const testDir = join(process.cwd(), 'test-handlers');

  beforeEach(() => {
    validator = new IdHandlerValidator();
    
    // Create test directory
    try {
      mkdirSync(testDir, { recursive: true });
    } catch {
      // Directory might already exist
    }
  });

  afterEach(() => {
    // Clean up test files
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  describe('Configuration Validation', () => {
    describe('Basic Structure Validation', () => {
      it('should validate valid function-type configuration', () => {
        const config: CustomIdHandlerConfig = {
          type: 'function',
          handler: (entity: string) => `${entity}-${Date.now()}`
        };

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate valid import-type configuration', () => {
        const config: CustomIdHandlerConfig = {
          type: 'import',
          importPath: './handlers/custom-id',
          functionName: 'generateId'
        };

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject configuration without type', () => {
        const config = {} as CustomIdHandlerConfig;

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Handler type is required');
      });

      it('should reject configuration with invalid type', () => {
        const config = {
          type: 'invalid'
        } as any;

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Handler type must be 'function' or 'import'");
      });
    });

    describe('Function Type Validation', () => {
      it('should require handler function for function type', () => {
        const config: CustomIdHandlerConfig = {
          type: 'function'
        };

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Handler function is required when type is 'function'");
      });

      it('should reject non-function handler for function type', () => {
        const config = {
          type: 'function',
          handler: 'not-a-function'
        } as any;

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Handler must be a function when type is 'function'");
      });

      it('should warn about unused import fields for function type', () => {
        const config: CustomIdHandlerConfig = {
          type: 'function',
          handler: () => 'test',
          importPath: './unused',
          functionName: 'unused'
        };

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain("importPath is ignored when type is 'function'");
        expect(result.warnings).toContain("functionName is ignored when type is 'function'");
      });
    });

    describe('Import Type Validation', () => {
      it('should require importPath for import type', () => {
        const config: CustomIdHandlerConfig = {
          type: 'import',
          functionName: 'generateId'
        };

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("importPath is required when type is 'import'");
      });

      it('should require functionName for import type', () => {
        const config: CustomIdHandlerConfig = {
          type: 'import',
          importPath: './handler'
        };

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("functionName is required when type is 'import'");
      });

      it('should reject empty functionName', () => {
        const config: CustomIdHandlerConfig = {
          type: 'import',
          importPath: './handler',
          functionName: ''
        };

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("functionName must be a non-empty string");
      });

      it('should warn about unused handler function for import type', () => {
        const config: CustomIdHandlerConfig = {
          type: 'import',
          importPath: './handler',
          functionName: 'generateId',
          handler: () => 'unused'
        };

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain("handler function is ignored when type is 'import'");
      });
    });

    describe('Options Validation', () => {
      it('should accept valid options object', () => {
        const config: CustomIdHandlerConfig = {
          type: 'function',
          handler: () => 'test',
          options: { prefix: 'TEST', length: 10 }
        };

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(true);
      });

      it('should reject non-object options', () => {
        const config = {
          type: 'function',
          handler: () => 'test',
          options: 'invalid'
        } as any;

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("options must be a plain object");
      });

      it('should reject array options', () => {
        const config = {
          type: 'function',
          handler: () => 'test',
          options: ['invalid']
        } as any;

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("options must be a plain object");
      });

      it('should reject null options', () => {
        const config = {
          type: 'function',
          handler: () => 'test',
          options: null
        } as any;

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("options must be a plain object");
      });
    });
  });

  describe('Handler Function Validation', () => {
    it('should validate simple handler function', () => {
      const handler = (entity: string) => `${entity}-id`;
      
      const result = validator.validateHandler(handler);
      expect(result.valid).toBe(true);
    });

    it('should warn about too many parameters', () => {
      const handler = (entity: string, data: any, extra1: any, extra2: any) => 'test';
      
      const result = validator.validateHandler(handler);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("Handler function has 4 parameters, only 'entity' and 'data' are passed");
    });

    it('should warn about async functions', () => {
      const handler = async (entity: string) => `${entity}-async`;
      
      const result = validator.validateHandler(handler);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("Handler is async, ensure proper error handling in production");
    });

    it('should warn about Math.random usage', () => {
      const handler = (entity: string) => `${entity}-${Math.random()}`;
      
      const result = validator.validateHandler(handler);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("Handler uses Math.random(), consider using crypto.randomUUID() for better uniqueness");
    });

    it('should warn about Date.now usage', () => {
      const handler = (entity: string) => `${entity}-${Date.now()}`;
      
      const result = validator.validateHandler(handler);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("Handler uses Date.now(), ensure this provides sufficient uniqueness for your use case");
    });

    it('should warn about console statements', () => {
      const handler = (entity: string) => {
        console.log('Generating ID for', entity);
        return `${entity}-id`;
      };
      
      const result = validator.validateHandler(handler);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("Handler contains console statements, consider removing for production");
    });
  });

  describe('Import Path Validation', () => {
    it('should validate relative import paths', async () => {
      const result = await validator.validateImport('./relative/path.js');
      // Should not error on path format, but will error on file not existing
      expect(result.errors.some(e => e.includes('Import file does not exist'))).toBe(true);
    });

    it('should warn about absolute paths', async () => {
      const result = await validator.validateImport('/absolute/path.js');
      expect(result.warnings).toContain("Absolute paths may not be portable across environments");
    });

    it('should warn about missing file extensions', async () => {
      const result = await validator.validateImport('./handler');
      expect(result.warnings).toContain("Consider specifying file extension (.js, .ts, .mjs, .cjs)");
    });

    it('should reject paths with invalid characters', async () => {
      const result = await validator.validateImport('./path<>:"|?*.js');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Import path contains invalid characters");
    });

    it('should reject empty import paths', async () => {
      const result = await validator.validateImport('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Import path cannot be empty");
    });

    it('should validate existing file with valid function', async () => {
      // Create a test file
      const testFile = join(testDir, 'valid-handler.js');
      writeFileSync(testFile, `
        exports.generateId = function(entity) {
          return entity + '-' + Date.now();
        };
      `);

      const result = await validator.validateImport(testFile, 'generateId');
      expect(result.valid).toBe(true);
    });

    it('should error when function not found in module', async () => {
      // Create a test file without the expected function
      const testFile = join(testDir, 'no-function.js');
      writeFileSync(testFile, `
        exports.otherFunction = function() {
          return 'test';
        };
      `);

      const result = await validator.validateImport(testFile, 'generateId');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Function 'generateId' not found in module");
    });

    it('should error when export is not a function', async () => {
      // Create a test file with non-function export
      const testFile = join(testDir, 'not-function.js');
      writeFileSync(testFile, `
        exports.generateId = 'not a function';
      `);

      const result = await validator.validateImport(testFile, 'generateId');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Export 'generateId' is not a function");
    });

    it('should handle default exports', async () => {
      // Create a test file with default export
      const testFile = join(testDir, 'default-export.js');
      writeFileSync(testFile, `
        module.exports = function(entity) {
          return entity + '-default';
        };
      `);

      const result = await validator.validateImport(testFile);
      expect(result.valid).toBe(true);
    });

    it('should warn when no default export and no function name', async () => {
      // Create a test file without default export
      const testFile = join(testDir, 'no-default.js');
      writeFileSync(testFile, `
        exports.someFunction = function() {
          return 'test';
        };
      `);

      const result = await validator.validateImport(testFile);
      expect(result.warnings).toContain("No default export found in module");
    });
  });

  describe('Handler Testing', () => {
    it('should test synchronous handler successfully', async () => {
      const handler: IdHandler = {
        id: 'test-sync',
        name: 'Test Sync Handler',
        handler: (entity: string, data?: any) => `${entity}-${data?.suffix || 'default'}`
      };

      const result = await validator.testGeneration(handler, 'user', { suffix: 'test' });
      expect(result.valid).toBe(true);
    });

    it('should test asynchronous handler successfully', async () => {
      const handler: IdHandler = {
        id: 'test-async',
        name: 'Test Async Handler',
        handler: async (entity: string) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return `${entity}-async`;
        }
      };

      const result = await validator.testGeneration(handler, 'product');
      expect(result.valid).toBe(true);
    });

    it('should error when handler returns invalid type', async () => {
      const handler: IdHandler = {
        id: 'test-invalid',
        name: 'Test Invalid Handler',
        handler: () => ({ invalid: 'object' }) as any
      };

      const result = await validator.testGeneration(handler, 'entity');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('returned invalid type object'))).toBe(true);
    });

    it('should error when handler returns empty string', async () => {
      const handler: IdHandler = {
        id: 'test-empty',
        name: 'Test Empty Handler',
        handler: () => ''
      };

      const result = await validator.testGeneration(handler, 'entity');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('returned empty string'))).toBe(true);
    });

    it('should warn about very long strings', async () => {
      const handler: IdHandler = {
        id: 'test-long',
        name: 'Test Long Handler',
        handler: () => 'x'.repeat(300)
      };

      const result = await validator.testGeneration(handler, 'entity');
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('very long string'))).toBe(true);
    });

    it('should error when handler returns non-finite number', async () => {
      const handler: IdHandler = {
        id: 'test-infinite',
        name: 'Test Infinite Handler',
        handler: () => Number.POSITIVE_INFINITY
      };

      const result = await validator.testGeneration(handler, 'entity');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('non-finite number'))).toBe(true);
    });

    it('should warn about negative numbers', async () => {
      const handler: IdHandler = {
        id: 'test-negative',
        name: 'Test Negative Handler',
        handler: () => -123
      };

      const result = await validator.testGeneration(handler, 'entity');
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('negative number'))).toBe(true);
    });

    it('should error when handler throws exception', async () => {
      const handler: IdHandler = {
        id: 'test-error',
        name: 'Test Error Handler',
        handler: () => {
          throw new Error('Handler failed');
        }
      };

      const result = await validator.testGeneration(handler, 'entity');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Handler execution failed'))).toBe(true);
    });

    it('should warn about slow handlers', async () => {
      const handler: IdHandler = {
        id: 'test-slow',
        name: 'Test Slow Handler',
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 150));
          return 'slow-id';
        }
      };

      const result = await validator.testGeneration(handler, 'entity');
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('took') && w.includes('ms'))).toBe(true);
    });

    it('should warn about very slow handlers', async () => {
      const handler: IdHandler = {
        id: 'test-very-slow',
        name: 'Test Very Slow Handler',
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 1100));
          return 'very-slow-id';
        }
      };

      const result = await validator.testGeneration(handler, 'entity');
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('is slow') && w.includes('consider optimization'))).toBe(true);
    });
  });

  describe('Complete Configuration Validation', () => {
    it('should validate complete function configuration with testing', async () => {
      const config: CustomIdHandlerConfig = {
        type: 'function',
        handler: (entity: string) => `${entity}-complete`
      };

      const result = await validator.validateCompleteConfig(config, 'test-entity');
      expect(result.valid).toBe(true);
    });

    it('should validate complete import configuration with testing', async () => {
      // Create a test file
      const testFile = join(testDir, 'complete-handler.js');
      writeFileSync(testFile, `
        exports.generateCompleteId = function(entity) {
          return entity + '-complete-' + Date.now();
        };
      `);

      const config: CustomIdHandlerConfig = {
        type: 'import',
        importPath: testFile,
        functionName: 'generateCompleteId'
      };

      const result = await validator.validateCompleteConfig(config, 'test-entity');
      expect(result.valid).toBe(true);
    });

    it('should return config errors without testing if config is invalid', async () => {
      const config = {
        type: 'invalid'
      } as any;

      const result = await validator.validateCompleteConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Handler type must be 'function' or 'import'");
    });

    it('should combine config and testing errors', async () => {
      const config: CustomIdHandlerConfig = {
        type: 'function',
        handler: () => ({ invalid: 'return' }) as any,
        options: 'invalid-options' as any
      };

      const result = await validator.validateCompleteConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('options must be a plain object'))).toBe(true);
      expect(result.errors.some(e => e.includes('returned invalid type'))).toBe(true);
    });

    it('should handle testing errors gracefully', async () => {
      const config: CustomIdHandlerConfig = {
        type: 'function',
        handler: () => {
          throw new Error('Testing error');
        }
      };

      const result = await validator.validateCompleteConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Handler execution failed'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle handler with no parameters', () => {
      const handler = () => 'static-id';
      
      const result = validator.validateHandler(handler);
      expect(result.valid).toBe(true);
    });

    it('should handle handler with exactly 2 parameters', () => {
      const handler = (entity: string, data: any) => `${entity}-${data}`;
      
      const result = validator.validateHandler(handler);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle whitespace-only import paths', async () => {
      const result = await validator.validateImport('   ');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Import path cannot be empty");
    });

    it('should handle null/undefined function names', async () => {
      const result = await validator.validateImport('./test', null as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("functionName must be a non-empty string");
    });
  });
});