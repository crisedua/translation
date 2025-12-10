-- Add generated_document_url column to document_requests
ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS generated_document_url TEXT;
