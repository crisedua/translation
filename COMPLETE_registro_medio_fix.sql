-- =============================================
-- COMPLETE FIX FOR REGISTRO NACIMIENTO MEDIO
-- Updates BOTH extraction instructions AND field mappings
-- Run this COMPLETE SQL in Supabase SQL Editor
-- =============================================

-- STEP 1: Update extraction instructions
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

-- STEP 2: Update field definitions
UPDATE document_templates
SET 
  field_definitions = '[
    {"name": "nombres", "type": "text", "description": "Given names"},
    {"name": "primer_apellido", "type": "text", "description": "First surname"},
    {"name": "segundo_apellido", "type": "text", "description": "Second surname"},
    {"name": "nuip", "type": "text", "description": "NUIP"},
    {"name": "nuip_top", "type": "text", "description": "NUIP from top"},
    {"name": "nuip_bottom", "type": "text", "description": "NUIP from bottom"},
    {"name": "serial_indicator", "type": "text", "description": "Serial indicator"},
    {"name": "sexo", "type": "text", "description": "Sex"},
    {"name": "grupo_sanguineo", "type": "text", "description": "Blood type"},
    {"name": "factor_rh", "type": "text", "description": "Rh factor"},
    {"name": "fecha_nacimiento", "type": "date", "description": "Date of birth"},
    {"name": "pais_nacimiento", "type": "text", "description": "Country of birth"},
    {"name": "departamento_nacimiento", "type": "text", "description": "Department of birth"},
    {"name": "municipio_nacimiento", "type": "text", "description": "Municipality of birth"},
    {"name": "birth_location_combined", "type": "text", "description": "Complete birth location as written in form"},
    {"name": "lugar_nacimiento", "type": "text", "description": "Place of birth with clinic"},
    {"name": "padre_nombres", "type": "text", "description": "Father names"},
    {"name": "padre_apellidos", "type": "text", "description": "Father surnames"},
    {"name": "padre_identificacion", "type": "text", "description": "Father ID"},
    {"name": "padre_nacionalidad", "type": "text", "description": "Father nationality"},
    {"name": "madre_nombres", "type": "text", "description": "Mother names"},
    {"name": "madre_apellidos", "type": "text", "description": "Mother surnames"},
    {"name": "madre_identificacion", "type": "text", "description": "Mother ID"},
    {"name": "madre_nacionalidad", "type": "text", "description": "Mother nationality"},
    {"name": "declarante_nombres", "type": "text", "description": "Declarant names"},
    {"name": "declarante_identificacion", "type": "text", "description": "Declarant ID"},
    {"name": "testigo1_nombres", "type": "text", "description": "Witness 1 names"},
    {"name": "testigo1_identificacion", "type": "text", "description": "Witness 1 ID"},
    {"name": "testigo2_nombres", "type": "text", "description": "Witness 2 names"},
    {"name": "testigo2_identificacion", "type": "text", "description": "Witness 2 ID"},
    {"name": "oficina", "type": "text", "description": "Office"},
    {"name": "numero_oficina", "type": "text", "description": "Office number"},
    {"name": "registry_location_combined", "type": "text", "description": "Registry location from country_dept_munic form field (e.g., COLOMBIA.VALLE.CALI)"},
    {"name": "departamento_registro", "type": "text", "description": "Registration department"},
    {"name": "municipio_registro", "type": "text", "description": "Registration municipality"},
    {"name": "fecha_registro", "type": "date", "description": "Registration date"},
    {"name": "codigo", "type": "text", "description": "Code"},
    {"name": "acta", "type": "text", "description": "Certificate number"},
    {"name": "numero_acta", "type": "text", "description": "Certificate number"},
    {"name": "notas", "type": "text", "description": "Notes"},
    {"name": "margin_notes", "type": "text", "description": "Margin notes"},
    {"name": "authorizing_official", "type": "text", "description": "Authorizing official"},
    {"name": "acknowledgment_official", "type": "text", "description": "Acknowledgment official"},
    {"name": "funcionario_nombre", "type": "text", "description": "Official name"},
    {"name": "tipo_documento_anterior", "type": "text", "description": "Prior document type"}
  ]'::jsonb
WHERE id = 'efbcf756-758f-4dea-8822-e0da888390c7';

-- STEP 3: Update PDF mappings
UPDATE document_templates
SET content_profile = jsonb_set(
    COALESCE(content_profile, '{}'::jsonb),
    '{pdf_mappings}',
    '{
      "nombres": ["reg_names"],
      "primer_apellido": ["reg_1_surname"],
      "segundo_apellido": ["reg_2_surname"],
      "nuip": ["nuip"],
      "nuip_top": ["nuip"],
      "nuip_bottom": ["nuip"],
      "serial_indicator": ["serial_indicator"],
      "sexo": ["sex"],
      "grupo_sanguineo": ["blood_type"],
      "factor_rh": ["rh_factor"],
      "fecha_nacimiento": ["birth_year", "birth_month", "birth_day"],
      "lugar_nacimiento": ["birth_place"],
      "birth_location_combined": ["birth_country_dept_munic"],
      "pais_nacimiento": ["birth_country_dept_munic"],
      "departamento_nacimiento": ["birth_country_dept_munic"],
      "municipio_nacimiento": ["birth_country_dept_munic"],
      "padre_nombres": ["father_surnames_names"],
      "padre_apellidos": ["father_surnames_names"],
      "padre_identificacion": ["father_id_doc"],
      "padre_nacionalidad": ["father_nationality"],
      "madre_nombres": ["mother_surnames_names"],
      "madre_apellidos": ["mother_surnames_names"],
      "madre_identificacion": ["mother_id_doc"],
      "madre_nacionalidad": ["mother_nationality"],
      "declarante_nombres": ["declarant_surnames_names"],
      "declarante_identificacion": ["declarant_id_doc"],
      "testigo1_nombres": ["witness1_surnames_names"],
      "testigo1_identificacion": ["witness1_id_doc"],
      "testigo2_nombres": ["witness2_surnames_names"],
      "testigo2_identificacion": ["witness2_id_doc"],
      "oficina": ["notary_number"],
      "numero_oficina": ["notary_number"],
      "registry_location_combined": ["country_dept_munic"],
      "departamento_registro": ["country_dept_munic"],
      "municipio_registro": ["country_dept_munic"],
      "fecha_registro": ["reg_year", "reg_month", "reg_day"],
      "codigo": ["reg_code"],
      "acta": ["birth_cert_number"],
      "numero_acta": ["birth_cert_number"],
      "notas": ["notes1", "notes2", "notes3", "notes4", "notes5", "notes6", "notes7"],
      "margin_notes": ["notes1", "notes2", "notes3", "notes4", "notes5", "notes6", "notes7"],
      "authorizing_official": ["official_name&signature"],
      "acknowledgment_official": ["ack_official_name&signature"],
      "funcionario_nombre": ["official_name&signature"],
      "tipo_documento_anterior": ["prior_doc"]
    }'::jsonb
)
WHERE id = 'efbcf756-758f-4dea-8822-e0da888390c7';

-- Verify the updates
SELECT 
    name,
    content_profile->'extraction_instructions'->>'registry_location_combined' as extraction_instruction,
    content_profile->'pdf_mappings'->>'registry_location_combined' as pdf_mapping
FROM document_templates
WHERE id = 'efbcf756-758f-4dea-8822-e0da888390c7';
