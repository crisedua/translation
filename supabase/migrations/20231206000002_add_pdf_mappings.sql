-- Add pdf_field_mappings to document_templates
ALTER TABLE document_templates 
ADD COLUMN IF NOT EXISTS pdf_field_mappings JSONB DEFAULT '{}'::jsonb;

-- Comment
COMMENT ON COLUMN document_templates.pdf_field_mappings IS 'Mapping between extracted data keys and PDF form field names';
