-- =========================================================
-- QUICK FIX FOR "REGISTRO NACIMIENTO NUEVO" (No Re-upload needed)
-- =========================================================
-- This script manually updates the 'pdfFields' list for the Nuevo template.
-- This enables the new "1:1 Extraction System" to target these exact fields
-- without you having to re-upload the PDF template.

UPDATE document_templates
SET content_profile = jsonb_set(
    COALESCE(content_profile, '{}'::jsonb),
    '{pdfFields}',
    '[
        "Names", 
        "Surnames", 
        "Date of Birth", 
        "Sex", 
        "Country", 
        "Department", 
        "Municipality", 
        "Township/Police Station", 
        "NUIP",
        "Serial",
        "Place of Birth"
    ]'::jsonb
)
WHERE name ILIKE '%Nuevo%' OR name ILIKE '%New%';

-- Verify the update
SELECT name, content_profile->'pdfFields' as pdf_fields
FROM document_templates
WHERE name ILIKE '%Nuevo%' OR name ILIKE '%New%';
