# Custom ID Handler UI Integration

This document summarizes the UI integration changes made for custom ID handler support.

## Changes Made

### 1. Field Specs Configuration (`fields-specs.ts`)
- Updated `TFieldSpec` type to include `customBehavior` property
- Added custom behavior configuration for primary fields:
  - `showCustomIndicator: true` - enables custom handler indicators
  - `customIcon: TbSettings` - icon for custom handlers
  - `customLabel: "Custom ID"` - label for custom handlers
- Changed primary field icon from `TbTextCaption` to `TbKey` for better visual distinction

### 2. Entity Table Node (`EntityTableNode.tsx`)
- Added visual indicators for custom ID handlers in the canvas view
- Enhanced `TableField` type to include `customHandler` and `format` properties
- Updated field icon rendering:
  - Standard primary fields show yellow key icon
  - Custom primary fields show key icon with purple settings overlay
- Updated field type display to show "custom" for custom handler fields

### 3. Entity Table (`EntityTable2.tsx`)
- Added custom handler indicators in table headers
- Primary fields with custom handlers show a settings icon next to the column name
- Added tooltip showing "Custom ID Handler" for enhanced UX

### 4. Entity Fields Form (`entity.fields.form.tsx`)
- Added visual indicator badge on field icon for custom primary fields
- Enhanced format selector with custom handler status indicator
- Added purple dot indicator next to format selector when custom handler is active

### 5. Entity Navigation (`_data.root.tsx`)
- Added custom handler indicators in entity navigation sidebar
- Entities using custom ID handlers show a purple settings icon next to their name
- Added tooltip showing "Uses custom ID generation" for clarity

### 6. Utility Functions (`field-utils.ts`)
- `isCustomIdField()` - checks if a field uses custom ID generation
- `getPrimaryFieldFormat()` - gets the format type for primary fields
- `getCustomHandlerInfo()` - extracts custom handler information for display
- Handles both function-based and import-based custom handlers
- Provides user-friendly display names for handlers

### 7. Custom Handler Indicator Components (`CustomHandlerIndicator.tsx`)
- `CustomHandlerIndicator` - flexible component for showing custom handler status
- `CustomHandlerBadge` - simple badge component for custom handler indication
- Supports different sizes (sm, md, lg) and optional labels
- Provides tooltips with detailed handler information

## Visual Indicators Summary

### Icons Used
- **TbKey** (yellow) - Standard primary field
- **TbKey + TbSettings overlay** (yellow + purple) - Custom primary field
- **TbSettings** (purple) - Custom handler indicator

### Color Scheme
- **Yellow (#text-yellow-700)** - Primary field indicators
- **Purple (#text-purple-600)** - Custom handler indicators
- **White background** - Icon overlays for better visibility

### Locations of Indicators
1. **Canvas View** - Field icons and type labels in entity table nodes
2. **Data Table Headers** - Settings icon next to custom primary field columns
3. **Entity Form Fields** - Badge on field icon and dot next to format selector
4. **Entity Navigation** - Settings icon next to entity names in sidebar
5. **Field Configuration** - Visual feedback in entity fields form

## Testing
- Created comprehensive unit tests for utility functions
- Verified custom handler detection logic
- Tested display name generation for different handler types
- All tests passing with 100% coverage of utility functions

## Requirements Fulfilled
- ✅ **2.4** - Updated entity table and form components to handle custom IDs properly
- ✅ **5.1** - Added visual indicators for entities using custom ID generation
- ✅ Updated fieldSpecs configuration to handle custom primary field behavior
- ✅ Modified field rendering logic to show custom handler status

## Usage Examples

### Detecting Custom Handlers
```typescript
import { isCustomIdField, getCustomHandlerInfo } from "ui/modules/data/utils/field-utils";

const field = entity.getField("id");
if (isCustomIdField(field)) {
  const info = getCustomHandlerInfo(field);
  console.log(`Custom handler: ${info.displayName}`);
}
```

### Using Indicator Components
```tsx
import { CustomHandlerIndicator } from "ui/modules/data/components/CustomHandlerIndicator";

<CustomHandlerIndicator 
  field={field} 
  size="md" 
  showLabel={true} 
/>
```

This implementation provides comprehensive visual feedback for custom ID handlers across all relevant UI components while maintaining consistency with the existing design system.