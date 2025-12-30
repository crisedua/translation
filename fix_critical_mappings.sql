-- =========================================================
-- CRITICAL MAPPING FIX FOR "REGISTRO NACIMIENTO NUEVO"
-- =========================================================
-- The current mappings are too broad (e.g., Father's Name mapping to "Names").
-- This script FORCES strict, logical mappings for this template.

-- Step 1: Clean up Parent Name Mappings
-- Remove generic "names" and "surnames" targets from parent fields
UPDATE document_templates
SET content_profile = jsonb_set(
    content_profile,
    '{pdf_mappings}',
    (content_profile->'pdf_mappings') || '{
        "padre_nombres": ["father_names", "Father Sales", "Nombres del Padre"],
        "padre_apellidos": ["father_surnames", "Apellidos del Padre"],
        "madre_nombres": ["mother_names", "Nombres de la Madre"],
        "madre_apellidos": ["mother_surnames", "Apellidos de la Madre"],
        "primer_apellido": ["First Surname", "Primer Apellido", "reg_1_surname"],
        "segundo_apellido": ["Second Surname", "Segundo Apellido", "reg_2_surname"],
        "nombres": ["Names", "Given Name(s)", "Nombres", "reg_names"],
        "pais_nacimiento": ["Country", "Country of Birth"],
        "departamento_nacimiento": ["Department", "Department of Birth"],
        "municipio_nacimiento": ["Municipality", "Municipality of Birth"],
        "lugar_nacimiento": ["Township/Police Station", "township_birth"]
    }'::jsonb
)
WHERE name ILIKE '%Nuevo%' OR name ILIKE '%New%';

-- Step 2: Ensure 1:1 Extraction fields are set (from previous fix)
UPDATE document_templates
SET content_profile = jsonb_set(
    content_profile,
    '{pdfFields}',
    '[
        "Names", 
        "Surnames", 
        "First Surname",
        "Second Surname",
        "Date of Birth", 
        "Sex", 
        "Country", 
        "Department", 
        "Municipality", 
        "Township/Police Station", 
        "NUIP"
    ]'::jsonb
)
WHERE name ILIKE '%Nuevo%' OR name ILIKE '%New%';

-- Step 3: Verify
SELECT 
    name, 
    content_profile->'pdf_mappings'->'padre_nombres' as fixed_father_mapping,
    content_profile->'pdf_mappings'->'nombres' as fixed_reg_names_mapping
FROM document_templates
WHERE name ILIKE '%Nuevo%' OR name ILIKE '%New%';
