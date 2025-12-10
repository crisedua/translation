-- Fix RLS policies to allow deletion
-- Run this in the Supabase Dashboard SQL Editor

-- 1. Allow users to delete their OWN requests
CREATE POLICY "Allow users to delete own requests"
ON document_requests FOR DELETE
USING (
  auth.uid() = user_id
);

-- 2. Allow authenticated users to delete ANONYMOUS requests (user_id is NULL)
-- This fixes the issue where you can't delete requests uploaded without logging in
CREATE POLICY "Allow authenticated to delete anonymous requests"
ON document_requests FOR DELETE
USING (
  auth.role() = 'authenticated' AND user_id IS NULL
);
