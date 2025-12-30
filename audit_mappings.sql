-- =========================================================
-- AUDIT REPORT: Current Field Mappings for All Templates
-- =========================================================

SELECT 
    name as "Template Name",
    jsonb_pretty(content_profile->'pdf_mappings') as "Mappings (DB Config)",
    jsonb_pretty(content_profile->'pdfFields') as "Detected PDF Fields"
FROM document_templates
ORDER BY name;
