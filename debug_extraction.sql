-- COMPREHENSIVE DEBUG SCRIPT FOR EXTRACTION ISSUES
-- Run in Supabase SQL Editor

-- ============================================================
-- STEP 1: Check the most recent document request
-- ============================================================
SELECT 
    id,
    status,
    template_id,
    created_at,
    CASE 
        WHEN extracted_data IS NULL THEN 'NULL'
        WHEN extracted_data = '{}'::jsonb THEN 'EMPTY OBJECT'
        ELSE 'HAS DATA: ' || (SELECT COUNT(*) FROM jsonb_object_keys(extracted_data))::text || ' keys'
    END as extraction_status,
    CASE 
        WHEN ocr_text IS NULL THEN 'NULL'
        WHEN LENGTH(ocr_text) = 0 THEN 'EMPTY'
        ELSE 'HAS TEXT: ' || LENGTH(ocr_text)::text || ' chars'
    END as ocr_status,
    CASE 
        WHEN validation_errors IS NULL THEN 'NULL'
        WHEN validation_errors = '[]'::jsonb THEN 'NO ERRORS'
        ELSE 'HAS ERRORS'
    END as validation_status
FROM document_requests
ORDER BY created_at DESC
LIMIT 3;

-- ============================================================
-- STEP 2: Check the matched template's configuration
-- ============================================================
SELECT 
    t.id,
    t.name,
    t.category_id,
    CASE WHEN t.field_definitions IS NULL THEN 'NULL'
         WHEN jsonb_array_length(t.field_definitions) = 0 THEN 'EMPTY ARRAY'
         ELSE 'HAS ' || jsonb_array_length(t.field_definitions)::text || ' fields'
    END as field_definitions_status,
    CASE WHEN t.content_profile IS NULL THEN 'NULL'
         ELSE 'HAS PROFILE'
    END as content_profile_status,
    t.content_profile->>'documentType' as doc_type,
    CASE WHEN t.content_profile->'pdf_mappings' IS NULL THEN 'NULL'
         ELSE 'HAS ' || (SELECT COUNT(*) FROM jsonb_object_keys(t.content_profile->'pdf_mappings'))::text || ' mappings'
    END as pdf_mappings_status,
    CASE WHEN t.content_profile->'pdfFields' IS NULL THEN 'NULL'
         ELSE 'HAS ' || jsonb_array_length(t.content_profile->'pdfFields')::text || ' fields'
    END as pdf_fields_status
FROM document_templates t
WHERE t.id IN (
    SELECT template_id FROM document_requests 
    WHERE template_id IS NOT NULL
    ORDER BY created_at DESC LIMIT 1
);

-- ============================================================
-- STEP 3: View actual extracted_data content
-- ============================================================
SELECT 
    id,
    jsonb_pretty(extracted_data) as extracted_data_pretty
FROM document_requests
ORDER BY created_at DESC
LIMIT 1;

-- ============================================================
-- STEP 4: Check ALL templates configuration
-- ============================================================
SELECT 
    id,
    name,
    CASE WHEN field_definitions IS NULL THEN 0 
         ELSE jsonb_array_length(field_definitions) 
    END as field_count,
    content_profile->>'documentType' as doc_type,
    CASE WHEN content_profile->'pdfFields' IS NULL THEN 0
         ELSE jsonb_array_length(content_profile->'pdfFields')
    END as pdf_field_count,
    CASE WHEN content_profile->'pdf_mappings' IS NULL THEN 0
         ELSE (SELECT COUNT(*) FROM jsonb_object_keys(content_profile->'pdf_mappings'))
    END as mapping_count
FROM document_templates
ORDER BY created_at DESC;

-- ============================================================
-- STEP 5: Check if there's OCR text (if no text, AI can't extract)
-- ============================================================
SELECT 
    id,
    LEFT(ocr_text, 500) as ocr_preview
FROM document_requests
ORDER BY created_at DESC
LIMIT 1;
