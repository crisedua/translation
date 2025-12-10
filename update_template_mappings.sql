-- Run this SQL in Supabase SQL Editor to update template mappings
-- Go to: https://supabase.com/dashboard/project/fsqvguceukcyvyuekvbz/sql

-- =============================================
-- Registro Nacimiento Nuevo (9ffa61ac-84d8-4f1f-afec-21961b60a23f)
-- 30 PDF form fields, 28 mappings
-- =============================================
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
    {"name": "oficina", "type": "text", "description": "Registry office"},
    {"name": "numero_oficina", "type": "text", "description": "Office number"},
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
      "oficina": ["office_type"],
      "numero_oficina": ["office_type"],
      "departamento_registro": ["dept_office"],
      "municipio_registro": ["muni_office"],
      "fecha_registro": ["date_registration", "day", "month", "year"],
      "codigo": ["qr_code"],
      "funcionario_nombre": ["name_director"]
    }'::jsonb
  )
WHERE id = '9ffa61ac-84d8-4f1f-afec-21961b60a23f';

-- =============================================
-- Registro Nacimiento Medio (efbcf756-758f-4dea-8822-e0da888390c7)
-- 41 PDF form fields, 42 mappings
-- =============================================
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
  ]'::jsonb,
  content_profile = jsonb_set(
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

-- =============================================
-- Registro Nacimiento Antiguo (3bffb55c-41fb-413d-bc20-3f9f1072a5f2)
-- 40 PDF form fields, 26 mappings
-- =============================================
UPDATE document_templates
SET 
  field_definitions = '[
    {"name": "nombres", "type": "text", "description": "Given names"},
    {"name": "primer_apellido", "type": "text", "description": "First surname"},
    {"name": "segundo_apellido", "type": "text", "description": "Second surname"},
    {"name": "sexo", "type": "text", "description": "Sex"},
    {"name": "nuip", "type": "text", "description": "NUIP/ID"},
    {"name": "fecha_nacimiento", "type": "date", "description": "Date of birth"},
    {"name": "hora_nacimiento", "type": "text", "description": "Time of birth"},
    {"name": "pais_nacimiento", "type": "text", "description": "Country of birth"},
    {"name": "departamento_nacimiento", "type": "text", "description": "Department of birth"},
    {"name": "municipio_nacimiento", "type": "text", "description": "Municipality of birth"},
    {"name": "lugar_nacimiento", "type": "text", "description": "Place of birth"},
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
    {"name": "fecha_registro", "type": "date", "description": "Registration date"}
  ]'::jsonb,
  content_profile = jsonb_set(
    COALESCE(content_profile, '{}'::jsonb),
    '{pdf_mappings}',
    '{
      "nombres": ["given_names"],
      "primer_apellido": ["first_surname"],
      "segundo_apellido": ["second_surname"],
      "sexo": ["sexo"],
      "nuip": ["id_basic_part", "id_add_part"],
      "fecha_nacimiento": ["Text Field1", "month", "day"],
      "hora_nacimiento": ["time"],
      "pais_nacimiento": ["country"],
      "departamento_nacimiento": ["department"],
      "municipio_nacimiento": ["municipality"],
      "lugar_nacimiento": ["birth_place"],
      "padre_nombres": ["father_surname"],
      "padre_apellidos": ["father_surname"],
      "padre_identificacion": ["father_id"],
      "padre_nacionalidad": ["father_nationality"],
      "madre_nombres": ["mother_names"],
      "madre_apellidos": ["mother_surnames"],
      "madre_identificacion": ["mother_id_number"],
      "madre_nacionalidad": ["nationality_mother"],
      "declarante_nombres": ["declarant_address"],
      "declarante_identificacion": ["declarant_id"],
      "testigo1_nombres": ["witness_residence"],
      "testigo1_identificacion": ["witness_id"],
      "testigo2_nombres": ["witness2_residence"],
      "testigo2_identificacion": ["witness2_id"],
      "fecha_registro": ["date_registered"]
    }'::jsonb
  )
WHERE id = '3bffb55c-41fb-413d-bc20-3f9f1072a5f2';

-- Verify the updates
SELECT 
  name,
  jsonb_array_length(field_definitions) as field_count,
  (SELECT count(*) FROM jsonb_object_keys(content_profile->'pdf_mappings')) as mapping_count
FROM document_templates;
