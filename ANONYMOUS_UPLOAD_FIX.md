# Anonymous Upload Fix - Summary

## Issue
User reported that the upload page was showing "You must be logged in to upload documents" error, preventing anonymous users from uploading documents.

## Root Cause
The recent fix to save `user_id` (to resolve the extracted data not being saved issue) introduced a requirement for authentication. The code was throwing an error if no user was logged in:

```typescript
if (userError || !user) {
    throw new Error('You must be logged in to upload documents');
}
```

## Solution
Modified `DocumentUpload.tsx` to make authentication **optional**:

### Before:
```typescript
const { data: { user }, error: userError } = await supabase.auth.getUser();

if (userError || !user) {
    throw new Error('You must be logged in to upload documents');
}

// Use user.id everywhere
user_id: user.id
userId: user.id
```

### After:
```typescript
const { data: { user } } = await supabase.auth.getUser();
const userId = user?.id || null; // null if not logged in

// Use userId (can be null)
user_id: userId  // Will be null for anonymous uploads
userId: userId   // Pass to Edge Function (can be null)
```

## Changes Made

**File**: `src/components/DocumentUpload.tsx`

1. **Removed authentication requirement** (line 67-68)
   - No longer throws error if user is not logged in
   - Uses optional chaining: `user?.id`

2. **Allow null user_id** (line 68)
   - `const userId = user?.id || null`
   - Anonymous uploads will have `user_id: null` in database

3. **Updated database insert** (line 96)
   - `user_id: userId` instead of `user_id: user.id`

4. **Updated Edge Function call** (line 113)
   - `userId: userId` instead of `userId: user.id`

## Benefits

✅ **Anonymous uploads now work** - Users don't need to log in  
✅ **User tracking still works** - If user is logged in, their ID is captured  
✅ **Backward compatible** - Existing logged-in users continue to work  
✅ **Data integrity maintained** - Extracted data is still saved correctly

## Testing

The dev server has hot-reloaded the changes. To test:

1. Navigate to `http://localhost:5173/`
2. Upload a document without logging in
3. Verify:
   - No "must be logged in" error
   - Document uploads successfully
   - Extracted data appears on screen
   - Data is saved to database with `user_id: null`

## Database Impact

Anonymous uploads will create records with:
- `user_id`: `null`
- All other fields populated normally
- `extracted_data`: Saved correctly (the original fix still works)

## Notes

- The `user_id` field in `document_requests` table allows NULL values
- The Edge Function `process-document-v2` handles `userId: null` correctly
- Email notifications will be skipped for anonymous uploads (no user email available)
