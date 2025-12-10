-- Add category column to document_requests for easier filtering
ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS category text;

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_document_requests_category ON document_requests(category);
