-- =============================================
-- Add extraction_instructions to existing templates
-- Run this in Supabase SQL Editor
-- =============================================

-- Registro Nacimiento Medio (efbcf756-758f-4dea-8822-e0da888390c7)
-- The MEDIUM format with NUIP V2A pattern
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
        "registry_location_combined": "CRITICAL: Extract EXACTLY what you see in the ''Pais-Departamento-Municipio'' form field. This is a SINGLE field that already contains the complete location string. Copy it as-is. Example: COLOMBIA.VALLE.CALI",
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


-- Registro Nacimiento Antiguo (3bffb55c-41fb-413d-bc20-3f9f1072a5f2)
-- The OLD format with LIBRO/FOLIO
UPDATE document_templates
SET content_profile = jsonb_set(
    COALESCE(content_profile, '{}'::jsonb),
    '{extraction_instructions}',
    '{
        "nuip": "Extract from ''IDENTIFICATION No.'' or ''No. Identificación'' field. May be split into basic and additional parts.",
        "primer_apellido": "Extract from ''First Surname'' or ''Primer Apellido'' column in registrant section",
        "segundo_apellido": "Extract from ''Second Surname'' or ''Segundo Apellido'' column - adjacent to first surname",
        "nombres": "Extract from ''Given Names'' or ''Nombres'' field",
        "lugar_nacimiento": "Extract complete place of birth from ''PLACE OF BIRTH'' section including any clinic name",
        "pais_nacimiento": "Extract country from birth location (usually COLOMBIA)",
        "departamento_nacimiento": "Extract department from ''Department'' field",
        "municipio_nacimiento": "Extract municipality from ''Municipality'' field",
        "authorizing_official": "Extract official name from bottom section near signature area",
        "padre_nombres": "Father''s names from ''FATHER'' section",
        "padre_apellidos": "Father''s surnames from ''FATHER'' section",
        "madre_nombres": "Mother''s names from ''MOTHER'' section",
        "madre_apellidos": "Mother''s surnames from ''MOTHER'' section",
        "fecha_nacimiento": "Extract from ''Date of Birth'' fields (day, month, year)",
        "fecha_registro": "Extract from ''Date Registered'' field",
        "libro": "Extract ''LIBRO'' number if present",
        "folio": "Extract ''FOLIO'' number if present"
    }'::jsonb
)
WHERE id = '3bffb55c-41fb-413d-bc20-3f9f1072a5f2';


-- Registro Nacimiento Nuevo (9ffa61ac-84d8-4f1f-afec-21961b60a23f)
-- The NEW digital format with QR
UPDATE document_templates
SET content_profile = jsonb_set(
    COALESCE(content_profile, '{}'::jsonb),
    '{extraction_instructions}',
    '{
        "nuip": "Extract NUIP from prominently displayed field. This is the primary identifier.",
        "nuip_top": "NUIP displayed at top of document",
        "nuip_bottom": "NUIP repeated at bottom for verification",
        "primer_apellido": "Extract from ''Apellidos'' field - first surname only",
        "segundo_apellido": "Extract from ''Apellidos'' field - second surname",
        "nombres": "Extract from ''Nombres'' field",
        "lugar_nacimiento": "Extract from ''Corregimiento/Inspección'' or place field",
        "pais_nacimiento": "Country of birth from location section",
        "departamento_nacimiento": "Department from ''Departamento'' field",
        "municipio_nacimiento": "Municipality from ''Municipio'' field",
        "authorizing_official": "Extract from digital signature section or ''Nombre del Director'' field",
        "funcionario_nombre": "Same as authorizing_official",
        "padre_nombres": "Father''s names from parent information section",
        "padre_apellidos": "Father''s surnames from parent information section",
        "padre_identificacion": "Father''s document number from ''No. Documento'' field",
        "madre_nombres": "Mother''s names from parent information section",
        "madre_apellidos": "Mother''s surnames from parent information section",
        "madre_identificacion": "Mother''s document number from ''No. Documento'' field",
        "fecha_nacimiento": "Date of birth from ''Fecha de nacimiento'' - may be in day/month/year format",
        "fecha_registro": "Registration date from ''Fecha de expedición'' section",
        "serial_indicator": "Extract serial indicator from top section",
        "tipo_oficina": "CRITICAL: Extract the type of registry office from the checkboxes in ''Registry Office Information - Type of Office''. Look for which checkbox is marked (X): Notary, Consulate, etc. Return the office type name (e.g., ''Notary'', ''Consulate'')",
        "numero_oficina": "CRITICAL: Extract the office number from ''Registry Office Information''. This appears as a number next to the office type checkbox (e.g., ''21''). Extract ONLY the number.",
        "pais_registro": "Extract the country from ''Country - Department - Municipality - Township and/or Police Station'' field in Registry Office section (e.g., ''COLOMBIA'')",
        "departamento_registro": "Extract the department from ''Country - Department - Municipality - Township and/or Police Station'' field in Registry Office section (e.g., ''VALLE'')",
        "municipio_registro": "Extract the municipality from ''Country - Department - Municipality - Township and/or Police Station'' field in Registry Office section (e.g., ''CALI'')"
    }'::jsonb
)
WHERE id = '9ffa61ac-84d8-4f1f-afec-21961b60a23f';


-- Verify the updates
SELECT 
    name,
    content_profile->>'extractionInstructionCount' as instruction_count,
    jsonb_object_keys(content_profile->'extraction_instructions') as sample_fields
FROM document_templates
WHERE id IN (
    'efbcf756-758f-4dea-8822-e0da888390c7',
    '3bffb55c-41fb-413d-bc20-3f9f1072a5f2',
    '9ffa61ac-84d8-4f1f-afec-21961b60a23f'
)
LIMIT 5;
