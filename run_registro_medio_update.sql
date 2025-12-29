-- =============================================
-- UPDATE REGISTRO NACIMIENTO MEDIO EXTRACTION INSTRUCTIONS
-- Run this complete SQL in Supabase SQL Editor
-- =============================================

UPDATE document_templates
SET content_profile = jsonb_set(
    COALESCE(content_profile, '{}'::jsonb),
    '{extraction_instructions}',
    '{
        "nuip": "CRITICAL: Look in box labeled ''NUIP'' near top-left. Format is LETTERS+NUMBERS (e.g., V2A0001156). The prefix letters (V2A) are REQUIRED - do NOT omit them.",
        "nuip_top": "Same as nuip - extract from top box including ALL leading letters",
        "primer_apellido": "Extract from box labeled ''Primer Apellido'' in ''Datos del inscrito'' section. Example: QUEVEDO",
        "segundo_apellido": "CRITICAL: Extract from box labeled ''Segundo Apellido'' - this is the box IMMEDIATELY TO THE RIGHT of primer_apellido. NEVER leave empty if there is text. Example: HERRERA",
        "nombres": "Extract from box labeled ''Nombre(s)'' below the surname boxes. Example: KATERINE",
        "lugar_nacimiento": "CRITICAL: Extract the COMPLETE text from ''Lugar de nacimiento'' row EXACTLY as it appears. MUST include clinic/hospital name AND location in parentheses. Example: CLINICA MATERNO INFANTIL FARALLONES (COLOMBIA.VALLE.CALI)",
        "birth_location_combined": "Same as lugar_nacimiento - extract the COMPLETE text exactly as written",
        "registry_location_combined": "CRITICAL: Read the SINGLE form field ''Pais-Departamento-Municipio''. Copy its value EXACTLY as written - do NOT split, parse, or combine with other fields. If it says ''COLOMBIA'', copy ''COLOMBIA''. If it says ''COLOMBIA.VALLE.CALI'', copy ''COLOMBIA.VALLE.CALI''.",
        "authorizing_official": "CRITICAL: Extract COMPLETE name from bottom section near ''Nombre y firma del funcionario que autoriza''. Officials have 3-4 name parts - extract ALL of them. Example: HOLMES RACEL CAROLINA MONTOYA",
        "acknowledgment_official": "Only extract if ''Reconocimiento paterno'' section has a name filled in. If section is empty or not applicable, return empty string.",
        "funcionario_nombre": "Same as authorizing_official - extract complete official name with all parts",
        "padre_nombres": "Father''s given names from ''Datos del padre'' section (e.g., HARVEY ABAD)",
        "padre_apellidos": "Father''s surnames from ''Datos del padre'' section (e.g., QUEVEDO MEDINA)",
        "padre_identificacion": "Father''s ID including type and location (e.g., C.C. 10481.354 DE SANTANDER DE QUILICHAO)",
        "madre_nombres": "Mother''s given names from ''Datos de la madre'' section (e.g., ALBA YOLANDA)",
        "madre_apellidos": "Mother''s surnames from ''Datos de la madre'' section (e.g., HERRERA HERRERA)",
        "madre_identificacion": "Mother''s ID including type and location (e.g., C.C. 31928.038 DE CALI (VALLE))",
        "fecha_nacimiento": "Date of birth from ''Fecha de nacimiento'' row. Extract exactly as written.",
        "fecha_registro": "Registration date from ''Fecha de inscripción'' row at bottom",
        "serial_indicator": "Extract ''Indicativo Serial'' from top-right area (e.g., 29734419)",
        "codigo": "Extract code from ''Código'' box - may have parts like 97 0 2, combine to 9702"
    }'::jsonb
)
WHERE id = 'efbcf756-758f-4dea-8822-e0da888390c7';

-- Verify the update
SELECT name, content_profile->'extraction_instructions'->>'registry_location_combined' as registry_instruction
FROM document_templates
WHERE id = 'efbcf756-758f-4dea-8822-e0da888390c7';
