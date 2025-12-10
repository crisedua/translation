-- Allow deletion of templates by setting template_id to NULL in document_requests
-- This allows templates to be deleted even if they have associated requests
ALTER TABLE document_requests 
DROP CONSTRAINT IF EXISTS document_requests_template_id_fkey;

ALTER TABLE document_requests
ADD CONSTRAINT document_requests_template_id_fkey 
FOREIGN KEY (template_id) 
REFERENCES document_templates(id) 
ON DELETE SET NULL;
