-- CHECK TEMPLATE MAPPINGS CONFIGURATION
-- Run this in Supabase SQL Editor to verify templates are properly configured

-- 1. Check which templates have pdf_mappings and pdfFields
SELECT 
    id,
    name,
    content_profile->>'documentType' as doc_type,
    
    -- Check pdf_mappings
    CASE 
        WHEN content_profile->'pdf_mappings' IS NULL THEN '❌ NULL'
        WHEN content_profile->'pdf_mappings' = '{}'::jsonb THEN '❌ EMPTY'
        ELSE '✅ ' || (SELECT COUNT(*) FROM jsonb_object_keys(content_profile->'pdf_mappings'))::text || ' mappings'
    END as pdf_mappings_status,
    
    -- Check pdfFields
    CASE 
        WHEN content_profile->'pdfFields' IS NULL THEN '❌ NULL'
        WHEN content_profile->'pdfFields' = '[]'::jsonb THEN '❌ EMPTY'
        ELSE '✅ ' || jsonb_array_length(content_profile->'pdfFields')::text || ' fields'
    END as pdf_fields_status,
    
    -- Was it reanalzed?
    content_profile->>'reanalyzedAt' as reanalyzed_at
    
FROM document_templates
ORDER BY created_at DESC;

-- 2. View the actual pdf_mappings content (for the first template)
SELECT 
    name,
    jsonb_pretty(content_profile->'pdf_mappings') as pdf_mappings_content
FROM document_templates
ORDER BY created_at DESC
LIMIT 1;

-- 3. View the pdfFields list
SELECT 
    name,
    content_profile->'pdfFields' as pdf_field_list
FROM document_templates
ORDER BY created_at DESC
LIMIT 1;

-- 4. Check the most recent request's extracted_data keys vs template's pdf_mappings keys
WITH recent_request AS (
    SELECT 
        r.id as request_id,
        r.template_id,
        r.extracted_data,
        t.name as template_name,
        t.content_profile->'pdf_mappings' as pdf_mappings
    FROM document_requests r
    JOIN document_templates t ON r.template_id = t.id
    ORDER BY r.created_at DESC
    LIMIT 1
)
SELECT 
    request_id,
    template_name,
    
    -- List extracted_data keys
    (SELECT array_agg(key) FROM jsonb_object_keys(extracted_data) as key) as extracted_keys,
    
    -- List pdf_mappings keys  
    CASE 
        WHEN pdf_mappings IS NULL THEN ARRAY[]::text[]
        ELSE (SELECT array_agg(key) FROM jsonb_object_keys(pdf_mappings) as key)
    END as mapping_keys
    
FROM recent_request;
