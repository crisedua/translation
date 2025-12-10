# Extracted Data Not Inserting - Issue Analysis and Fix

## Problem Summary
The extracted data was appearing on screen but not being saved to the database.

## Root Cause
The issue was in the `DocumentUpload.tsx` component. When creating a new document request:

1. **Missing `user_id`**: The initial database insert (lines 87-101) was NOT including the `user_id` field
2. **Missing `userId` parameter**: The Edge Function call (lines 106-115) was NOT passing the `userId` parameter

This caused the `process-document-v2` Edge Function to fail when trying to update the request with extracted data, because:
- The `user_id` field in the database was NULL
- The Edge Function couldn't properly associate the extracted data with a user

## The Fix

### Changes Made to `DocumentUpload.tsx`:

1. **Added user authentication** (lines 68-72):
```typescript
// 0. Get current user
const { data: { user }, error: userError } = await supabase.auth.getUser();

if (userError || !user) {
    throw new Error('You must be logged in to upload documents');
}
```

2. **Added `user_id` to database insert** (line 100):
```typescript
const { data: requestData, error: insertError } = await supabase
    .from('document_requests')
    .insert({
        user_id: user.id, // ← ADDED THIS
        category: category,
        delivery_timeline: timeline,
        original_file_url: fileUrl,
        status: 'processing'
    })
```

3. **Added `userId` to Edge Function call** (line 119):
```typescript
const { error: functionError } = await supabase.functions
    .invoke('process-document-v2', {
        body: {
            fileUrl: fileUrl,
            fileName: file.name,
            userId: user.id, // ← ADDED THIS
            categoryId: category,
            timeline: timeline,
            requestId: requestData.id
        }
    });
```

## How the Flow Works Now

1. User uploads document → `DocumentUpload.tsx`
2. Component gets current authenticated user
3. Creates document request with `user_id` in database
4. Calls `process-document-v2` Edge Function with `userId`
5. Edge Function processes document and extracts data
6. Edge Function updates the request with `extracted_data` (lines 119-136 in `process-document-v2/index.ts`)
7. Extracted data is now properly saved to the database ✅

## Testing
To verify the fix works:
1. Upload a document through the UI
2. Check that the extracted data appears on screen
3. Check the database `document_requests` table - the `extracted_data` field should now be populated
4. The `user_id` field should also be populated with the authenticated user's ID

## Database Schema Reference
From `supabase/migrations/20231201000000_initial_schema.sql`:
```sql
create table if not exists document_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),  -- This was NULL before the fix
  template_id uuid references document_templates(id),
  status text default 'pending',
  original_file_url text,
  extracted_data jsonb,  -- This wasn't being populated
  ocr_text text,
  validation_errors jsonb,
  delivery_timeline text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```
