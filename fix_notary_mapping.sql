-- =============================================
-- DIRECT FIX: Replace oficina mapping completely
-- Run this in Supabase SQL Editor
-- =============================================

-- Step 1: Check what the current oficina mapping value is
SELECT 
    content_profile->'field_mappings'->'oficina' as current_oficina_value
FROM document_templates 
WHERE id = 'efbcf756-758f-4dea-8822-e0da888390c7';

-- Step 2: Use jsonb_set to REPLACE the oficina mapping
UPDATE document_templates
SET content_profile = jsonb_set(
    content_profile,
    '{field_mappings,oficina}',
    '["office_type", "Type of Office"]'::jsonb
)
WHERE id = 'efbcf756-758f-4dea-8822-e0da888390c7';

-- Step 3: Add notary_number mapping
UPDATE document_templates
SET content_profile = jsonb_set(
    content_profile,
    '{field_mappings,notary_number}',
    '["notary_number", "Number", "office_number"]'::jsonb
)
WHERE id = 'efbcf756-758f-4dea-8822-e0da888390c7';

-- Step 4: Add numero_oficina mapping
UPDATE document_templates
SET content_profile = jsonb_set(
    content_profile,
    '{field_mappings,numero_oficina}',
    '["notary_number", "Number", "office_number"]'::jsonb
)
WHERE id = 'efbcf756-758f-4dea-8822-e0da888390c7';

-- Step 5: Verify the fix
SELECT 
    content_profile->'field_mappings'->'oficina' as oficina_should_be_office_type,
    content_profile->'field_mappings'->'notary_number' as notary_number_mapping,
    content_profile->'field_mappings'->'numero_oficina' as numero_oficina_mapping
FROM document_templates 
WHERE id = 'efbcf756-758f-4dea-8822-e0da888390c7';
