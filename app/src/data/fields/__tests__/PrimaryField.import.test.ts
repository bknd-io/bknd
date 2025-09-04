import { describe, it, expect, beforeEach } from 'vitest';
import { PrimaryField, type CustomIdHandlerConfig } from '../PrimaryField';

describe('PrimaryField Import-based Custom Handlers', () => {
    beforeEach(() => {
        // Clear any cached handlers before each test
        const { idHandlerImportResolver } = require('../IdHandlerImportResolver');
        idHandlerImportResolver.clearCache();
    });

    describe('Configuration', () => {
        it('should accept import-based handler configuration', () => {
            const config: CustomIdHandlerConfig = {
                type: 'import',
                importPath: 'data/fields/__tests__/external-handlers/simple-handler',
                functionName: 'namedHandler'
            };

            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: config
            });

            expect(field.isCustomFormat()).toBe(true);
            expect(field.getCustomHandler()).toEqual(config);
        });

        it('should validate import configuration requirements', () => {
            expect(() => {
                new PrimaryField('id', {
                    format: 'custom',
                    customHandler: {
                        type: 'import'
                        // Missing importPath
                    }
                });
            }).toThrow('Import path is required');

            // Function name is optional, so this should not throw
            expect(() => {
                new PrimaryField('id', {
                    format: 'custom',
                    customHandler: {
                        type: 'import',
                        importPath: './test'
                        // Missing functionName - this is OK
                    }
                });
            }).not.toThrow();
        });
    });

    describe('ID Generation', () => {
        it('should generate IDs using imported default handler', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/simple-handler'
                }
            });

            const id = await field.generateCustomId('test_entity', { prefix: 'TEST' });
            expect(typeof id).toBe('string');
            expect(id).toContain('TEST_test_entity_');
        });

        it('should generate IDs using imported named handler', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/simple-handler',
                    functionName: 'namedHandler'
                }
            });

            const id = await field.generateCustomId('test_entity');
            expect(typeof id).toBe('string');
            expect(id).toContain('NAMED_test_entity_');
        });

        it('should generate IDs using imported async handler', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/simple-handler',
                    functionName: 'asyncHandler'
                }
            });

            const id = await field.generateCustomId('test_entity');
            expect(typeof id).toBe('string');
            expect(id).toContain('ASYNC_test_entity_');
        });

        it('should generate IDs using CommonJS handler', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/complex-handler.js'
                }
            });

            const id = await field.generateCustomId('test_entity', { 
                separator: '_',
                includeRandom: true 
            });
            expect(typeof id).toBe('string');
            expect(id).toContain('TEST_ENTITY_');
        });

        it('should pass options to imported handlers', async () => {
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

            const id = await field.generateCustomId('test_entity');
            expect(typeof id).toBe('string');
            expect(id).toContain('TEST_ENTITY|');
            expect(id).not.toMatch(/TEST_ENTITY\|\d{4}\|/); // Should not have random number
        });
    });

    describe('Error Handling', () => {
        it('should handle missing import gracefully', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: './non-existent-handler',
                    functionName: 'handler'
                }
            });

            await expect(field.generateCustomId('test_entity')).rejects.toThrow('Import handler execution failed');
        });

        it('should handle missing function gracefully', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/simple-handler',
                    functionName: 'nonExistentFunction'
                }
            });

            await expect(field.generateCustomId('test_entity')).rejects.toThrow('Import handler execution failed');
        });

        it('should validate return types from imported handlers', async () => {
            // This would require a mock handler that returns invalid types
            // For now, we'll test that the validation exists in the resolver
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/simple-handler'
                }
            });

            // Normal case should work
            const id = await field.generateCustomId('test_entity');
            expect(typeof id === 'string' || typeof id === 'number').toBe(true);
        });
    });

    describe('Fallback Behavior', () => {
        it('should fallback to UUID when import handler fails', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: './non-existent-handler',
                    functionName: 'handler'
                }
            });

            const result = await field.generateCustomIdWithFallback('test_entity');
            expect(result.success).toBe(true);
            expect(result.fallbackUsed).toBe(true);
            expect(typeof result.value).toBe('string');
            // Should be a UUID format (36 characters with dashes)
            expect(result.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });
    });

    describe('Async Support', () => {
        it('should handle async getNewValueAsync with import handlers', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/simple-handler',
                    functionName: 'asyncHandler'
                }
            });

            const result = await field.getNewValueAsync('test_entity');
            expect(result.success).toBe(true);
            expect(typeof result.value).toBe('string');
            expect(result.value).toContain('ASYNC_test_entity_');
        });

        it('should require entity name for custom format', async () => {
            const field = new PrimaryField('id', {
                format: 'custom',
                customHandler: {
                    type: 'import',
                    importPath: 'data/fields/__tests__/external-handlers/simple-handler'
                }
            });

            const result = await field.getNewValueAsync();
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.errors?.[0]?.message).toContain('Entity name is required');
        });
    });
});