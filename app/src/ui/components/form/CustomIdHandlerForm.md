# CustomIdHandlerForm Component

A React component for configuring custom ID generation handlers in the bknd framework.

## Features

- **Handler Type Selection**: Choose between inline function or import-based handlers
- **Inline Function Editor**: Code editor with JavaScript syntax highlighting for writing custom ID generation functions
- **Import Configuration**: Configure external module imports with path and function name
- **Real-time Validation**: Immediate feedback on configuration errors and warnings
- **Examples and Help**: Built-in examples and documentation for common use cases

## Props

```typescript
interface CustomIdHandlerFormProps {
   value?: CustomIdHandlerConfig;           // Current configuration value
   onChange: (config: CustomIdHandlerConfig) => void;  // Called when configuration changes
   entityName: string;                      // Name of the entity for context
   disabled?: boolean;                      // Whether the form is disabled
}
```

## Usage

```tsx
import { CustomIdHandlerForm } from "ui/components/form";

function EntityConfiguration() {
   const [customHandler, setCustomHandler] = useState<CustomIdHandlerConfig>();

   return (
      <CustomIdHandlerForm
         value={customHandler}
         onChange={setCustomHandler}
         entityName="user"
         disabled={false}
      />
   );
}
```

## Handler Types

### Inline Function
- Write JavaScript functions directly in the code editor
- Supports both synchronous and asynchronous functions
- Real-time syntax validation and compilation checking
- Built-in examples for common patterns

### Import
- Reference external modules containing ID generation functions
- Supports both relative paths and npm packages
- Validates import path format and function name requirements

## Validation

The component provides comprehensive validation:

### Function Validation
- Syntax checking and compilation validation
- Parameter count warnings
- Performance and security warnings (e.g., Math.random usage)

### Import Validation
- Import path format validation
- Required field checking
- Module resolution hints

## Examples

### Prefixed ID Generator
```javascript
(entity) => `${entity.toUpperCase()}_${Date.now()}`
```

### Sequential ID Generator
```javascript
(entity, data) => `${entity}_${(data?.lastId || 0) + 1}`
```

### External Module
```typescript
// ./utils/id-generators.ts
export function generateCustomId(entity: string, data?: any): string {
  return `${entity.toUpperCase()}_${Date.now()}`;
}
```

## Integration

This component is designed to be integrated into the EntityFieldsForm when the primary field format is set to "custom". It works in conjunction with:

- `PrimaryField` class for ID generation execution
- `IdHandlerRegistry` for handler management
- Entity configuration persistence system

## Accessibility

- Proper form labeling and descriptions
- Keyboard navigation support
- Screen reader compatible error messages
- Focus management for form interactions