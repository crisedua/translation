-- Add fields needed for template analysis and matching
ALTER TABLE document_templates 
ADD COLUMN IF NOT EXISTS full_template_text text,
ADD COLUMN IF NOT EXISTS content_profile jsonb;

-- Add comment to explain the fields
COMMENT ON COLUMN document_templates.full_template_text IS 'Full extracted text from the template PDF for matching purposes';
COMMENT ON COLUMN document_templates.content_profile IS 'Enhanced JSON object for template matching:
{
  "documentType": "birth_certificate|passport|marriage_certificate|dian|other",
  "keywords": ["array of distinctive keywords from template"],
  "formatIndicators": {
    "version": "old|new|standard|unknown",
    "specificMarkers": ["format-specific terms like libro, folio, NUIP"],
    "description": "what makes this format unique"
  },
  "semanticDescription": "detailed description of template purpose",
  "structuralPatterns": ["layout and structure descriptions"]
}';
