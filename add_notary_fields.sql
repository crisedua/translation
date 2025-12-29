-- =============================================
-- ADD MISSING NOTARY FIELDS FOR REGISTRO NACIMIENTO NUEVO
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Update Extraction Instructions
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

-- 2. Update Field Definitions and PDF Mappings
UPDATE document_templates
SET 
  field_definitions = '[
    {"name": "nombres", "type": "text", "description": "Given names of the registrant"},
    {"name": "primer_apellido", "type": "text", "description": "First surname"},
    {"name": "segundo_apellido", "type": "text", "description": "Second surname"},
    {"name": "nuip", "type": "text", "description": "NUIP number"},
    {"name": "nuip_top", "type": "text", "description": "NUIP from top of document"},
    {"name": "nuip_bottom", "type": "text", "description": "NUIP from bottom of document"},
    {"name": "serial_indicator", "type": "text", "description": "Serial indicator"},
    {"name": "sexo", "type": "text", "description": "Sex/Gender"},
    {"name": "fecha_nacimiento", "type": "date", "description": "Date of birth"},
    {"name": "pais_nacimiento", "type": "text", "description": "Country of birth"},
    {"name": "departamento_nacimiento", "type": "text", "description": "Department of birth"},
    {"name": "municipio_nacimiento", "type": "text", "description": "Municipality of birth"},
    {"name": "lugar_nacimiento", "type": "text", "description": "Place of birth"},
    {"name": "padre_nombres", "type": "text", "description": "Father given names"},
    {"name": "padre_apellidos", "type": "text", "description": "Father surnames"},
    {"name": "padre_identificacion", "type": "text", "description": "Father ID number"},
    {"name": "padre_nacionalidad", "type": "text", "description": "Father nationality"},
    {"name": "madre_nombres", "type": "text", "description": "Mother given names"},
    {"name": "madre_apellidos", "type": "text", "description": "Mother surnames"},
    {"name": "madre_identificacion", "type": "text", "description": "Mother ID number"},
    {"name": "madre_nacionalidad", "type": "text", "description": "Mother nationality"},
    {"name": "tipo_oficina", "type": "text", "description": "Type of registry office (Notary, Consulate, etc.)"},
    {"name": "oficina", "type": "text", "description": "Registry office"},
    {"name": "numero_oficina", "type": "text", "description": "Office number"},
    {"name": "pais_registro", "type": "text", "description": "Registration country"},
    {"name": "departamento_registro", "type": "text", "description": "Registration department"},
    {"name": "municipio_registro", "type": "text", "description": "Registration municipality"},
    {"name": "fecha_registro", "type": "date", "description": "Registration date"},
    {"name": "codigo", "type": "text", "description": "Code"},
    {"name": "funcionario_nombre", "type": "text", "description": "Official name"}
  ]'::jsonb,
  content_profile = jsonb_set(
    COALESCE(content_profile, '{}'::jsonb),
    '{pdf_mappings}',
    '{
      "nombres": ["names"],
      "primer_apellido": ["surnames"],
      "segundo_apellido": ["surnames"],
      "nuip": ["nuip"],
      "nuip_top": ["nuip"],
      "nuip_bottom": ["nuip"],
      "serial_indicator": ["serial_indicator"],
      "sexo": ["sex"],
      "fecha_nacimiento": ["date_of_birth", "day", "month", "year"],
      "pais_nacimiento": ["country_birth"],
      "departamento_nacimiento": ["dept_birth"],
      "municipio_nacimiento": ["muni_birth"],
      "lugar_nacimiento": ["township_birth"],
      "padre_nombres": ["father_names"],
      "padre_apellidos": ["father_surnames"],
      "padre_identificacion": ["father_doc_number"],
      "padre_nacionalidad": ["father_nationality"],
      "madre_nombres": ["mother_names"],
      "madre_apellidos": ["mother_surnames"],
      "madre_identificacion": ["mother_doc_number"],
      "madre_nacionalidad": ["mother_nationality"],
      "tipo_oficina": ["office_type", "Type of Office"],
      "oficina": ["office_type", "registry_office"],
      "numero_oficina": ["notary_number", "office_number", "Number"],
      "pais_registro": ["country_office", "Country"],
      "departamento_registro": ["dept_office"],
      "municipio_registro": ["muni_office"],
      "fecha_registro": ["date_registration", "day", "month", "year"],
      "codigo": ["qr_code"],
      "funcionario_nombre": ["name_director"]
    }'::jsonb
  )
WHERE id = '9ffa61ac-84d8-4f1f-afec-21961b60a23f';

-- 3. Verify the updates
SELECT 
    name,
    jsonb_object_keys(content_profile->'extraction_instructions') as extraction_fields,
    jsonb_array_length(field_definitions) as field_count
FROM document_templates
WHERE id = '9ffa61ac-84d8-4f1f-afec-21961b60a23f'
LIMIT 25;
