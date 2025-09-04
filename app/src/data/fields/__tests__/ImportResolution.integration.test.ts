import { describe, it, expect, beforeEach } from 'vitest';
import { PrimaryField } from '../PrimaryField';
import { idHandlerImportResolver } from '../IdHandlerImportResolver';

describe('Import Resolution Integration Tests', () => {
    beforeEach(() => {
        idHandlerImportResolver.clearCache();
    });

    describe('End-to-End Import Resolution', () => {
        it('should successfully import and execute TypeScript default export', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/simple-handler'
                }
            });

            const id = await field.getNewValueAsync('user', { prefix: 'USR' });
            expect(typeof id).toBe('string');
            expect(id).toContain('USR_user_');
        });

        it('should successfully import and execute TypeScript named export', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/simple-handler',
                    functionName: 'namedHandler'
                }
            });

            const id = await field.getNewValueAsync('product');
            expect(typeof id).toBe('string');
            expect(id).toContain('NAMED_product_');
        });

        it('should successfully import and execute async TypeScript handler', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/simple-handler',
                    functionName: 'asyncHandler'
                }
            });

            const id = await field.getNewValueAsync('order');
            expect(typeof id).toBe('string');
            expect(id).toContain('ASYNC_order_');
        });

        it('should successfully import and execute CommonJS handler', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/complex-handler.js'
                }
            });

            const id = await field.getNewValueAsync('invoice', { 
                separator: '_',
                includeRandom: false 
            });
            expect(typeof id).toBe('string');
            expect(id).toContain('INVOICE_');
            expect(id).not.toMatch(/INVOICE_\d{4}_/); // Should not have random number
        });

        it('should pass options from handler config to imported handler', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/complex-handler.js',
                    options: {
                        separator: '|',
                        includeRandom: false
                    }
                }
            });

            const id = await field.getNewValueAsync('customer');
            expect(typeof id).toBe('string');
            expect(id).toContain('CUSTOMER|');
            expect(id).not.toMatch(/CUSTOMER\|\d{4}\|/); // Should not have random number
        });

        it('should merge handler options with runtime data', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/complex-handler.js',
                    options: {
                        separator: '|',
                        includeRandom: false
                    }
                }
            });

            // Runtime data should override handler options
            const id = await field.getNewValueAsync('customer', { 
                separator: '_',
                includeRandom: true 
            });
            expect(typeof id).toBe('string');
            expect(id).toContain('CUSTOMER_');
            expect(id).toMatch(/CUSTOMER_\d+_/); // Should have random number
        });
    });

    describe('Error Handling and Fallback', () => {
        it('should fallback to UUID when import fails', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'non-existent-module',
                    functionName: 'handler'
                }
            });

            const id = await field.getNewValueAsync('test');
            expect(typeof id).toBe('string');
            // Should be a UUID format (36 characters with dashes)
            expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });

        it('should fallback to UUID when function not found', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/simple-handler',
                    functionName: 'nonExistentFunction'
                }
            });

            const id = await field.getNewValueAsync('test');
            expect(typeof id).toBe('string');
            // Should be a UUID format
            expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });

        it('should throw error when generateCustomId is used (no fallback)', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'non-existent-module',
                    functionName: 'handler'
                }
            });

            await expect(field.generateCustomId('test')).rejects.toThrow('Import handler execution failed');
        });
    });

    describe('Caching Behavior', () => {
        it('should cache imported handlers for performance', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/simple-handler'
                }
            });

            // First call should import and cache
            const id1 = await field.getNewValueAsync('test1');
            expect(typeof id1).toBe('string');

            // Second call should use cache
            const id2 = await field.getNewValueAsync('test2');
            expect(typeof id2).toBe('string');

            // Both should be valid but different (due to timestamp)
            expect(id1).not.toBe(id2);
            expect(id1).toContain('ID_test1_');
            expect(id2).toContain('ID_test2_');
        });

        it('should handle cache clearing correctly', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/simple-handler'
                }
            });

            // Import and cache
            await field.getNewValueAsync('test1');
            expect(idHandlerImportResolver.getCachedHandlers().length).toBeGreaterThan(0);

            // Clear cache
            idHandlerImportResolver.clearCache();
            expect(idHandlerImportResolver.getCachedHandlers().length).toBe(0);

            // Should still work after cache clear (re-import)
            const id = await field.getNewValueAsync('test2');
            expect(typeof id).toBe('string');
            expect(id).toContain('ID_test2_');
        });
    });

    describe('Path Resolution', () => {
        it('should handle different import path formats', async () => {
            // Test the working path format
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/simple-handler'
                }
            });

            const id = await field.getNewValueAsync('test');
            expect(typeof id).toBe('string');
            expect(id).toContain('ID_test_');

            // Test that relative paths fall back gracefully
            idHandlerImportResolver.clearCache();
            const field2 = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: './non-working-relative-path'
                }
            });

            const id2 = await field2.getNewValueAsync('test');
            expect(typeof id2).toBe('string');
            // Should fallback to UUID
            expect(id2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });
    });
});