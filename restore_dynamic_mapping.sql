-- RESTORE DYNAMIC MAPPING LOGIC
-- Run this script to REMOVE the incorrect database mappings that are overriding the code.
-- This will unblock the dynamic mapping system so "COLOMBIA.VALLE.CALI" is extracted correctly.

UPDATE document_templates
SET content_profile = jsonb_set(
    content_profile,
    '{pdf_mappings}',
    (content_profile->'pdf_mappings')
    -- Remove bad registry location overrides (let code handle it)
    - 'departamento_registro'
    - 'municipio_registro'
    -- Remove bad birth location overrides
    - 'pais_nacimiento'
    - 'departamento_nacimiento'
    - 'municipio_nacimiento'
)
WHERE id = 'efbcf756-758f-4dea-8822-e0da888390c7';

-- Verify they are gone
SELECT 
    jsonb_exists(content_profile->'pdf_mappings', 'departamento_registro') as has_dept_reg_mapping,
    jsonb_exists(content_profile->'pdf_mappings', 'country_dept_munic') as has_correct_mapping
FROM document_templates
WHERE id = 'efbcf756-758f-4dea-8822-e0da888390c7';
