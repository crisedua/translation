-- Fix RLS policies for document_requests to allow anonymous uploads

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own requests" ON document_requests;
DROP POLICY IF EXISTS "Users can insert their own requests" ON document_requests;
DROP POLICY IF EXISTS "Users can update their own requests" ON document_requests;

-- Allow anyone (including anonymous users) to insert document requests
CREATE POLICY "Allow anyone to insert document requests"
  ON document_requests FOR INSERT
  WITH CHECK (true);

-- Allow users to view their own requests, or all requests if user_id is null (anonymous)
CREATE POLICY "Allow users to view requests"
  ON document_requests FOR SELECT
  USING (
    user_id IS NULL OR 
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'admin'
    )
  );

-- Allow users to update their own requests, or admins to update any
CREATE POLICY "Allow users to update requests"
  ON document_requests FOR UPDATE
  USING (
    user_id IS NULL OR 
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'admin'
    )
  )
  WITH CHECK (
    user_id IS NULL OR 
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'admin'
    )
  );

-- Allow admins to delete requests
CREATE POLICY "Allow admins to delete requests"
  ON document_requests FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'admin'
    )
  );
