# Storage Bucket Setup

## Create Storage Bucket in Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/fsqvguceukcyvyuekvbz/storage/buckets

2. Click "New bucket"

3. Create a bucket with these settings:
   - **Name**: `documents`
   - **Public**: ✅ Yes (checked)
   - **File size limit**: 20 MB
   - **Allowed MIME types**: `application/pdf,image/jpeg,image/png`

4. Click "Create bucket"

## Storage Policies (Optional - for more security)

If you want to restrict who can upload/delete files, add these policies in the Storage > Policies section:

### Allow authenticated users to upload
```sql
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');
```

### Allow public read access
```sql
CREATE POLICY "Public can read documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'documents');
```

### Allow authenticated users to delete their own files
```sql
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents' AND auth.uid() = owner);
```

## Verify Setup

After creating the bucket, you should be able to:
- Upload templates via the Template Admin page
- View uploaded templates
- Download template PDFs
