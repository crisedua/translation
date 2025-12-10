# Validation Error Fix - Field Name Flexibility

## Issue
Users were seeing validation warnings:
- "Missing required field: nombres"
- "Missing required field: apellidos"

Even though the data was being extracted correctly by the AI.

## Root Cause
The validator (`validator.ts`) was too strict and only checked for exact Spanish field names:
- `nombres`
- `apellidos`

However, the AI extractor often returns English field names or variations:
- `Given Name(s)`
- `Registrant's Names`
- `names`
- `reg_names`
- `Registrant's Surnames`
- `surnames`
- `First Surname`

## Solution
Modified the validator to accept **alternative field names**:

### Before:
```typescript
const requiredFields = ['nombres', 'apellidos'];

requiredFields.forEach(field => {
    if (!data[field] || data[field].trim() === '') {
        errors.push(`Missing required field: ${field}`);
    }
});
```

### After:
```typescript
// Helper function to check if any of the alternative field names exist
const hasAnyField = (alternatives: string[]): boolean => {
    return alternatives.some(field => data[field] && String(data[field]).trim() !== '');
};

// Check for required fields with alternative names
// nombres can be: nombres, Given Name(s), Registrant's Names, names, reg_names
if (!hasAnyField(['nombres', 'Given Name(s)', "Registrant's Names", 'names', 'reg_names', 'primer_nombre'])) {
    errors.push(`Missing required field: nombres`);
}

// apellidos can be: apellidos, Registrant's Surnames, surnames, First Surname + Second Surname
if (!hasAnyField(['apellidos', "Registrant's Surnames", 'surnames', 'First Surname', 'primer_apellido'])) {
    errors.push(`Missing required field: apellidos`);
}
```

## Changes Made

**File**: `supabase/functions/process-document-v2/validator.ts`

1. **Added helper function** `hasAnyField()` (lines 9-11)
   - Checks if any of the alternative field names exist in the data
   - Returns true if at least one variant is found with a non-empty value

2. **Updated nombres validation** (lines 14-16)
   - Now accepts: `nombres`, `Given Name(s)`, `Registrant's Names`, `names`, `reg_names`, `primer_nombre`

3. **Updated apellidos validation** (lines 19-21)
   - Now accepts: `apellidos`, `Registrant's Surnames`, `surnames`, `First Surname`, `primer_apellido`

## Deployment

✅ **Deployed to Supabase** (Dec 8, 2025 10:12 AM)
- Command: `npx supabase functions deploy process-document-v2`
- Status: Success
- Dashboard: https://supabase.com/dashboard/project/fsqvguceukcyvyuekvbz/functions

## Benefits

✅ **No more false validation errors** - Accepts both Spanish and English field names  
✅ **Backward compatible** - Still accepts original Spanish field names  
✅ **More robust** - Handles variations in AI extraction output  
✅ **Better user experience** - Documents won't be marked as "needs correction" unnecessarily

## Testing

To verify the fix:

1. **Upload a new document** through the UI
2. **Check validation result**:
   - Should pass validation if names/surnames are present in any format
   - No more "Missing required field" errors for nombres/apellidos
3. **Verify in database**:
   - `validation_errors` should be empty or minimal
   - `status` should be `pending_review` instead of `needs_correction`

## Related Issues

This fix addresses the field name mismatch between:
- **AI Extractor**: Returns both Spanish and English field names
- **Validator**: Previously only checked Spanish field names
- **PDF Generator**: Handles both via multi-layer mapping

Now all three components work harmoniously with flexible field naming.
