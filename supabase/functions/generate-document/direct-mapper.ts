/**
 * DIRECT FIELD MAPPER
 * 
 * Simple, reliable direct mapping from extracted field names to PDF field names.
 * No pattern matching, no complex validation - just straightforward lookup.
 */

// ============================================================================
// COMPREHENSIVE MAPPING TABLE
// Key: Extracted field name (from AI extractor)
// Value: Array of PDF field names to fill (tries each until success)
// ============================================================================

export const DIRECT_MAPPINGS: Record<string, string[]> = {
    // === REGISTRANT NAMES (Spanish and English variations) ===
    "nombres": ["names", "reg_names", "given_names", "first_names", "nombre", "Given Name(s)"],
    "Nombres": ["names", "reg_names", "given_names", "first_names", "nombre", "Given Name(s)"],
    "Apellidos": ["surnames", "first_surname", "second_surname", "Apellidos"],
    "primer_apellido": ["first_surname", "reg_1_surname", "surname1", "apellido1", "First Surname"],
    "segundo_apellido": ["second_surname", "reg_2_surname", "surname2", "apellido2", "Second Surname"],
    "Registrant's Names": ["names", "reg_names", "given_names"],
    "First Surname": ["first_surname", "reg_1_surname"],
    "Second Surname": ["second_surname", "reg_2_surname"],
    "Given Name(s)": ["names", "reg_names"],
    "Names": ["names", "reg_names"],
    "Surnames": ["surnames", "first_surname"],


    // === NUIP AND IDENTIFIERS ===
    "nuip": ["nuip", "NUIP", "id_basic_part"],
    "nuip_top": ["nuip", "NUIP", "id_basic_part", "id_add_part"],
    "nuip_resolved": ["nuip", "NUIP"],
    "serial_indicator": ["serial_indicator", "serial", "indicativo", "Serial Indicator"],
    "Serial Indicator": ["serial_indicator", "serial"],
    "codigo": ["reg_code", "code", "qr_code", "Code"],
    "Code": ["reg_code", "code"],
    "acta": ["birth_cert_number", "cert_number", "Acta"],

    // === PERSONAL DATA ===
    "sexo": ["sex", "sexo", "gender", "Sex (in words)"],
    "Sex": ["sex", "sexo"],
    "Sex (in words)": ["sex", "sexo"],
    "grupo_sanguineo": ["blood_type", "blood", "tipo_sangre", "Blood Type"],
    "Blood Type": ["blood_type", "blood"],
    "factor_rh": ["rh_factor", "rh", "factor", "Rh Factor"],
    "Rh Factor": ["rh_factor", "rh"],

    // === BIRTH DATE ===
    "fecha_nacimiento": ["date_of_birth", "birth_date", "Date of Birth"],
    "Date of Birth": ["date_of_birth", "birth_date"],
    "birth_day": ["birth_day", "Day"],
    "birth_month": ["birth_month", "Month"],
    "birth_year": ["birth_year", "Year"],
    "hora_nacimiento": ["time", "birth_time", "hora"],
    "Time": ["time", "birth_time"],

    // === BIRTH LOCATION ===
    "pais_nacimiento": ["country_birth", "birth_country", "Country"],
    "departamento_nacimiento": ["dept_birth", "birth_department", "Department"],
    "municipio_nacimiento": ["muni_birth", "birth_municipality", "Municipality"],
    "birth_location_combined": ["birth_country_dept_munic", "place_of_birth", "birth_place", "Place of Birth", "Lugar de nacimiento", "birth_country", "Birth Country"],
    "lugar_nacimiento": ["birth_country_dept_munic", "Place of Birth", "birth_place", "place", "township_birth", "Lugar de nacimiento"],
    "Place of Birth": ["birth_country_dept_munic", "place_of_birth", "birth_place", "Place of Birth"],
    "Place of Birth (Country - Department - Municipality - Township and/or Police Station)": ["birth_country_dept_munic", "place_of_birth", "Place of Birth"],

    // === FATHER INFORMATION ===
    "padre_nombres": ["father_names"],
    "padre_apellidos": ["father_surnames"],
    "padre_identificacion": ["father_doc_number", "father_id_doc", "father_id"],
    "padre_tipo_documento": ["father_id_type", "father_doc_type", "father_type_id"],
    "padre_nacionalidad": ["father_nationality"],
    "father_full_name": ["father_surnames_names", "dad_surnames_names", "father_names", "father_surnames"],
    "Father's Surnames and Full Names": ["father_surnames_names", "dad_surnames_names", "father_names"],
    "Father's Identification Document": ["father_id_doc", "father_doc_number"],
    "Father's Identification Document (Type and Number)": ["father_id_doc", "father_doc_number"],
    "Father's Nationality": ["father_nationality"],

    // === MOTHER INFORMATION ===
    "madre_nombres": ["mother_names"],
    "madre_apellidos": ["mother_surnames"],
    "madre_identificacion": ["mother_doc_number", "mother_id_doc", "mother_id_number"],
    "madre_tipo_documento": ["mother_id_type", "mother_doc_type", "mother_type_id"],
    "madre_nacionalidad": ["mother_nationality"],
    "mother_full_name": ["mother_surnames_names", "mom_surnames_names", "mother_names", "mother_surnames"],
    "Mother's Surnames and Full Names": ["mother_surnames_names", "mom_surnames_names", "mother_names"],
    "Mother's Identification Document": ["mother_id_doc", "mother_doc_number"],
    "Mother's Identification Document (Type and Number)": ["mother_id_doc", "mother_doc_number"],
    "Mother's Nationality": ["mother_nationality"],

    // === DECLARANT INFORMATION ===
    "declarante_nombres": ["declarant_name"], // Removed declarant_surnames_names to prevent partial fill
    "declarante_identificacion": ["declarant_id_doc", "declarant_id"],
    "declarant_full_name": ["declarant_surnames_names", "declarant_name", "Declarant's Surnames and Full Names"],
    "declarante_nombre_completo_raw": ["declarant_surnames_names", "declarant_name", "Declarant's Surnames and Full Names"],
    "Declarant's Surnames and Full Names": ["declarant_surnames_names", "declarant_full_name", "declarante_nombre_completo_raw"],
    "Declarant's Identification Document": ["declarant_id_doc", "declarant_id"],
    "Declarant's Identification Document (Type and Number)": ["declarant_id_doc", "declarant_id"],

    // === WITNESS INFORMATION ===
    "testigo1_nombres": ["witness1_surnames_names", "witness1_name"],
    "testigo1_identificacion": ["witness1_id_doc", "witness1_id"],
    "testigo2_nombres": ["witness2_surnames_names", "witness2_name"],
    "testigo2_identificacion": ["witness2_id_doc", "witness2_id"],
    "First Witness's Surnames and Full Names": ["witness1_surnames_names", "witness1_name"],
    "First Witness's Identification Document": ["witness1_id_doc", "witness1_id"],
    "First Witness's Identification Document (Type and Number)": ["witness1_id_doc", "witness1_id"],
    "Second Witness's Surnames and Full Names": ["witness2_surnames_names", "witness2_name"],
    "Second Witness's Identification Document": ["witness2_id_doc", "witness2_id"],
    "Second Witness's Identification Document (Type and Number)": ["witness2_id_doc", "witness2_id"],

    // === REGISTRY INFORMATION ===
    "tipo_oficina": ["office_type", "Type of Office", "type_office", "tipo_oficina"],
    "oficina": ["office_type", "office", "registry_office"],
    "numero_oficina": ["notary_number", "office_number", "Number", "office_num"],
    "notary_number": ["notary_number", "Number", "office_number", "office_num"],
    "numero": ["notary_number", "Number", "office_number"],
    "Número": ["notary_number", "Number", "office_number"],
    "Notary Number": ["notary_number", "office_number", "Number"],
    "Type of Office": ["office_type", "tipo_oficina"],
    "Registry Office": ["reg_office", "office"],
    "pais_registro": ["country_office", "country", "pais", "Country"],
    "Pais Registro": ["country_office", "country", "pais", "Country"],
    "departamento_registro": ["dept_office", "Department"],
    "municipio_registro": ["muni_office", "Municipality"],
    "fecha_registro": ["date_registration", "date_registered"],
    "Date Registered": ["date_registration", "reg_date"],
    "reg_day": ["reg_day", "date_registration", "reg_date"],
    "reg_month": ["reg_month", "date_registration", "reg_date"],
    "reg_year": ["reg_year", "date_registration", "reg_date"],
    "registry_location_combined": ["country_dept_munic"],
    "country_dept_munic": ["country_dept_munic"],
    "Country - Department - Municipality - Township and/or Police Station": ["country_dept_munic"],

    // === NOTES ===
    "notas": ["notes1", "notes2", "notes3", "notes4", "notes5", "notes", "Space For Notes"],
    "margin_notes": ["notes1", "notes2", "notes3", "notes4", "notes5", "notes6", "notes7", "Space For Notes"],
    "notes_combined": ["notes1", "notes2", "notes3", "notes4", "notes5"],
    "Notes": ["notes1", "notes", "Space For Notes"],
    "SPACE FOR NOTES": ["notes1", "notes2", "Space For Notes"],

    // === OFFICIALS ===
    "authorizing_official": ["official_name&signature", "official_name", "funcionario", "Name and Signature of Authorizing Official"],
    "acknowledgment_official": ["ack_official_name&signature", "ack_official", "Name and Signature of Official before whom the Acknowledgment is Made"],
    "funcionario_nombre": ["official_name&signature", "name_director", "official_name"],
    "Name and Signature of Authorizing Official": ["official_name&signature", "official_name"],
    "Name and Signature of Official before whom the Acknowledgment is Made": ["ack_official_name&signature", "ack_official"],

    // === PRIOR DOCUMENT ===
    "tipo_documento_anterior": ["prior_doc", "prior_document"],
    "Type of Prior Document or Witness Statement": ["prior_doc", "prior_document"],

    // === DOCUMENT METADATA ===
    "tipo_documento": ["Document Type", "doc_type", "type", "document_type_header", "Document Type_1", "Document Type_2", "Document Type_3", "Type of Document", "TypeofDocument"],
    "Document Type": ["Document Type", "doc_type", "document_type_header", "Document Type_1", "Document Type_2", "Document Type_3", "Type of Document", "TypeofDocument"],

    // === ISSUE DATE (Expedition) ===
    "fecha_expedicion": ["issue_date", "date_issue", "Date of Issue", "Fecha de expedición", "expedition_date", "Day", "Month", "Year"],
    "issue_day": ["issue_day", "Day", "Issue_Day", "expedition_day", "Día"],
    "issue_month": ["issue_month", "Month", "Issue_Month", "expedition_month", "Mes"],
    "issue_year": ["issue_year", "Year", "Issue_Year", "expedition_year", "Año"],
    "Live Birth Certificate Number": ["live_birth_cert", "birth_cert_number"],

    // === OTHER ===
    "tomo": ["tomo", "volume"],
    "folio": ["folio", "page"],
    "libro": ["libro", "book"],
    "Paternal Recognition": ["paternal_recognition", "recognition"]
};

/**
 * Find PDF field targets for an extracted field name
 */
export function getDirectMapping(extractedFieldName: string): string[] {
    // Try exact match first
    if (DIRECT_MAPPINGS[extractedFieldName]) {
        return DIRECT_MAPPINGS[extractedFieldName];
    }

    // Try case-insensitive match
    const lower = extractedFieldName.toLowerCase();
    for (const [key, targets] of Object.entries(DIRECT_MAPPINGS)) {
        if (key.toLowerCase() === lower) {
            return targets;
        }
    }

    // Try normalized match (remove special chars)
    const normalized = extractedFieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [key, targets] of Object.entries(DIRECT_MAPPINGS)) {
        const keyNorm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (keyNorm === normalized) {
            return targets;
        }
    }

    return [];
}

/**
 * Check if a field name is a notes-type field (needs special distribution)
 */
export function isNotesFieldDirect(fieldName: string): boolean {
    const lower = fieldName.toLowerCase();
    return lower.includes('note') ||
        lower.includes('nota') ||
        lower.includes('margin') ||
        lower.includes('observation') ||
        lower.includes('observacion') ||
        lower.includes('space') ||
        lower.includes('espacio');
}

/**
 * Log mapping result for debugging
 */
export function logMappingAttempt(extractedField: string, pdfTargets: string[], success: boolean, filledField?: string) {
    if (success) {
        console.log(`✅ MAPPED: "${extractedField}" -> "${filledField}"`);
    } else if (pdfTargets.length > 0) {
        console.log(`❌ FAILED: "${extractedField}" -> tried [${pdfTargets.slice(0, 3).join(', ')}...] but no match in PDF`);
    } else {
        console.log(`⚠️ NO MAPPING: "${extractedField}" has no mapping defined`);
    }
}
