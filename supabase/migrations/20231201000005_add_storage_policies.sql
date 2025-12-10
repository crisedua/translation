-- Storage policies for the 'documents' bucket

-- Allow anyone to upload files to the documents bucket
CREATE POLICY "Allow anyone to upload documents"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'documents');

-- Allow anyone to read files from the documents bucket
CREATE POLICY "Allow public read access to documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'documents');

-- Allow authenticated users to update their own files
CREATE POLICY "Allow authenticated users to update documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- Allow authenticated users to delete files
CREATE POLICY "Allow authenticated users to delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
