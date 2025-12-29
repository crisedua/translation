-- =============================================
-- CHECK AND FIX REGISTRO NACIMIENTO NUEVO TEMPLATE MAPPINGS
-- Run this in Supabase SQL Editor
-- =============================================

-- Step 1: Find the template and see current mappings
SELECT 
    id,
    name,
    content_profile->'field_mappings'->'pais_nacimiento' as pais_nacimiento_mapping,
    content_profile->'field_mappings'->'departamento_nacimiento' as depto_nacimiento_mapping,
    content_profile->'field_mappings'->'municipio_nacimiento' as muni_nacimiento_mapping,
    content_profile->'field_mappings'->'lugar_nacimiento' as lugar_nacimiento_mapping
FROM document_templates 
WHERE name ILIKE '%nuevo%' OR name ILIKE '%nacimiento%';

-- Step 2: Fix pais_nacimiento to map ONLY to Country field
UPDATE document_templates
SET content_profile = jsonb_set(
    content_profile,
    '{field_mappings,pais_nacimiento}',
    '["Country"]'::jsonb
)
WHERE name ILIKE '%nuevo%';

-- Step 3: Fix departamento_nacimiento to map ONLY to Department field
UPDATE document_templates
SET content_profile = jsonb_set(
    content_profile,
    '{field_mappings,departamento_nacimiento}',
    '["Department"]'::jsonb
)
WHERE name ILIKE '%nuevo%';

-- Step 4: Fix municipio_nacimiento to map ONLY to Municipality field
UPDATE document_templates
SET content_profile = jsonb_set(
    content_profile,
    '{field_mappings,municipio_nacimiento}',
    '["Municipality"]'::jsonb
)
WHERE name ILIKE '%nuevo%';

-- Step 5: Fix lugar_nacimiento to map to Township/Police Station
UPDATE document_templates
SET content_profile = jsonb_set(
    content_profile,
    '{field_mappings,lugar_nacimiento}',
    '["Township/Police Station", "township_birth"]'::jsonb
)
WHERE name ILIKE '%nuevo%';

-- Step 6: Remove any combined location field that might be overwriting
-- (Check if country_dept_munic, birth_location_combined exist)
UPDATE document_templates
SET content_profile = jsonb_set(
    content_profile,
    '{field_mappings,country_dept_munic}',
    '[]'::jsonb
)
WHERE name ILIKE '%nuevo%';

UPDATE document_templates
SET content_profile = jsonb_set(
    content_profile,
    '{field_mappings,birth_location_combined}',
    '[]'::jsonb
)
WHERE name ILIKE '%nuevo%';

-- Step 7: Verify the fix
SELECT 
    name,
    content_profile->'field_mappings'->'pais_nacimiento' as pais_should_be_country_only,
    content_profile->'field_mappings'->'departamento_nacimiento' as depto_should_be_department_only,
    content_profile->'field_mappings'->'municipio_nacimiento' as muni_should_be_municipality_only,
    content_profile->'field_mappings'->'lugar_nacimiento' as lugar_should_be_township
FROM document_templates 
WHERE name ILIKE '%nuevo%';
