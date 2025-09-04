# External ID Handler Examples

This directory contains example external ID handlers that demonstrate how to create and use import-based custom ID handlers in bknd.

## Files

### `simple-handler.ts`
TypeScript module with multiple export types:
- **Default export**: Simple handler with prefix support
- **Named export** (`namedHandler`): Handler with "NAMED" prefix
- **Async export** (`asyncHandler`): Asynchronous handler example

### `complex-handler.js`
CommonJS module demonstrating:
- Complex ID generation with options
- Separator customization
- Random number inclusion/exclusion
- Compatible with both CommonJS and ES module imports

## Usage Examples

### Using Default Export
```typescript
const field = new PrimaryField('id', {
  format: 'custom',
  customHandler: {
    type: 'import',
    importPath: 'path/to/your/handler'
    // No functionName needed - uses default export
  }
});
```

### Using Named Export
```typescript
const field = new PrimaryField('id', {
  format: 'custom',
  customHandler: {
    type: 'import',
    importPath: 'path/to/your/handler',
    functionName: 'namedHandler'
  }
});
```

### Using Handler with Options
```typescript
const field = new PrimaryField('id', {
  format: 'custom',
  customHandler: {
    type: 'import',
    importPath: 'path/to/your/handler',
    options: {
      separator: '|',
      includeRandom: false
    }
  }
});
```

## Handler Function Signature

All ID handlers must follow this signature:

```typescript
function handler(entity: string, data?: any): string | number | Promise<string | number>
```

- **entity**: The name of the entity for which the ID is being generated
- **data**: Optional data object that can contain runtime options and handler configuration options
- **Returns**: A string or number ID, can be synchronous or asynchronous

## Error Handling

- If the import path cannot be resolved, the system will fall back to UUID generation
- If the specified function name is not found, an error will be thrown with available exports
- If the handler function throws an error, it will be caught and re-thrown with context
- Invalid return types (not string or number) will cause validation errors

## Best Practices

1. **Always validate inputs** in your handler functions
2. **Handle edge cases** gracefully
3. **Use TypeScript** for better type safety
4. **Test your handlers** thoroughly before deployment
5. **Consider performance** - handlers are called for every new entity creation
6. **Make handlers pure** when possible (avoid side effects)
7. **Document your handler options** clearly