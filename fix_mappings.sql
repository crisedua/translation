-- Run this SQL in Supabase Dashboard (SQL Editor)
-- This will add the correct PDF field mappings to ALL templates

-- 1. First, let's create the correct mappings JSON
WITH correct_mappings AS (
  SELECT '{
    "Given Name(s)": ["reg_names"],
    "First Surname": ["reg_1_surname"],
    "Second Surname": ["reg_2_surname"],
    "nombres": ["reg_names"],
    "primer_apellido": ["reg_1_surname"],
    "segundo_apellido": ["reg_2_surname"],
    "Registrant''s Names": ["reg_names"],
    "NUIP": ["nuip"],
    "nuip": ["nuip"],
    "Sex": ["sex"],
    "sexo": ["sex"],
    "Blood Type": ["blood_type"],
    "grupo_sanguineo": ["blood_type"],
    "Rh Factor": ["rh_factor"],
    "factor_rh": ["rh_factor"],
    "Date of Birth": ["birth_day", "birth_month", "birth_year"],
    "fecha_nacimiento": ["birth_day", "birth_month", "birth_year"],
    "Time of Birth": ["birth_time"],
    "hora_nacimiento": ["birth_time"],
    "Date Registered": ["reg_day", "reg_month", "reg_year"],
    "fecha_registro": ["reg_day", "reg_month", "reg_year"],
    "Place of Birth": ["birth_country_dept_munic"],
    "lugar_nacimiento": ["birth_place", "birth_country_dept_munic"],
    "pais_nacimiento": ["birth_country"],
    "departamento_nacimiento": ["birth_department"],
    "municipio_nacimiento": ["birth_municipality"],
    "Country - Department - Municipality - Township and/or Police Station": ["country_dept_munic"],
    "vereda": ["birth_township"],
    "corregimiento": ["birth_corregimiento"],
    "Father''s Surnames and Full Names": ["father_surnames_names"],
    "Father''s Identification Document": ["father_id_doc"],
    "Father''s Nationality": ["father_nationality"],
    "padre_nombres": ["father_surnames_names"],
    "padre_apellidos": ["father_surnames_names"],
    "padre_identificacion": ["father_id_doc"],
    "padre_tipo_documento": ["father_doc_type"],
    "padre_nacionalidad": ["father_nationality"],
    "Mother''s Surnames and Full Names": ["mother_surnames_names"],
    "Mother''s Identification Document": ["mother_id_doc"],
    "Mother''s Nationality": ["mother_nationality"],
    "madre_nombres": ["mother_surnames_names"],
    "madre_apellidos": ["mother_surnames_names"],
    "madre_identificacion": ["mother_id_doc"],
    "madre_tipo_documento": ["mother_doc_type"],
    "madre_nacionalidad": ["mother_nationality"],
    "Declarant''s Surnames and Full Names": ["declarant_surnames_names"],
    "Declarant''s Identification Document": ["declarant_id_doc"],
    "declarante_nombres": ["declarant_surnames_names"],
    "declarante_identificacion": ["declarant_id_doc"],
    "declarante_tipo_documento": ["declarant_doc_type"],
    "First Witness''s Surnames and Full Names": ["witness1_surnames_names"],
    "First Witness''s Identification Document": ["witness1_id_doc"],
    "testigo1_nombres": ["witness1_surnames_names"],
    "testigo1_identificacion": ["witness1_id_doc"],
    "Second Witness''s Surnames and Full Names": ["witness2_surnames_names"],
    "Second Witness''s Identification Document": ["witness2_id_doc"],
    "testigo2_nombres": ["witness2_surnames_names"],
    "testigo2_identificacion": ["witness2_id_doc"],
    "Registry Office": ["registry_office"],
    "oficina": ["registry_office"],
    "tipo_oficina": ["office_type"],
    "Notary Number": ["notary_number"],
    "numero_oficina": ["notary_number"],
    "pais_registro": ["reg_country"],
    "departamento_registro": ["reg_department"],
    "municipio_registro": ["reg_municipality"],
    "ciudad_registro": ["reg_municipality"],
    "consulado": ["consulate"],
    "Code": ["reg_code"],
    "codigo": ["reg_code"],
    "Serial Indicator": ["serial_indicator"],
    "serial": ["serial_indicator"],
    "serial_indicator": ["serial_indicator"],
    "Live Birth Certificate Number": ["birth_cert_number"],
    "acta": ["birth_cert_number"],
    "numero_acta": ["birth_cert_number"],
    "tomo": ["volume"],
    "folio": ["page"],
    "libro": ["book"],
    "Notes": ["notes1"],
    "notas": ["notes1"],
    "Type of Prior Document or Witness Statement": ["prior_doc"],
    "tipo_documento_anterior": ["prior_doc"],
    "Signature": ["official_name&signature"],
    "Name and Signature of Authorizing Official": ["official_name&signature"],
    "funcionario_nombre": ["official_name"],
    "funcionario_cargo": ["official_position"],
    "Name and Signature of Official before whom the Acknowledgment is Made": ["ack_official_name&signature"]
  }'::jsonb as mappings
)

-- 2. Update ALL templates with the correct mappings
UPDATE document_templates
SET content_profile = 
  COALESCE(content_profile, '{}'::jsonb) || 
  jsonb_build_object('pdf_mappings', (SELECT mappings FROM correct_mappings))
WHERE name LIKE 'Registro%';

-- Verify the update
SELECT id, name, 
       jsonb_object_keys(content_profile->'pdf_mappings') as mapping_count
FROM document_templates
LIMIT 10;
