/**
 * Template Field Mapper Module
 * 
 * Centralized field mapping logic that:
 * 1. Prioritizes template-specific mappings from the database
 * 2. Falls back to standard mappings only when needed
 * 3. Provides debug info about unmapped fields
 * 4. Handles multi-value fields (notes split across PDF fields)
 */

// ============================================================================
// TYPES
// ============================================================================

interface Template {
    id: string;
    name: string;
    content_profile?: {
        pdfFields?: string[];
        pdf_mappings?: Record<string, string[]>;
        documentType?: string;
        [key: string]: any;
    };
    field_definitions?: Array<{
        name: string;
        description?: string;
        type?: string;
    }>;
}

export interface FieldMappingResult {
    /** Primary mappings: extracted field name -> PDF field names */
    mappings: Record<string, string[]>;
    /** Reverse mappings: PDF field name -> extracted field name (for debugging) */
    reverseMappings: Record<string, string>;
    /** Extracted fields that couldn't be mapped */
    unmappedExtracted: string[];
    /** PDF fields that have no mapping */
    unmappedPdf: string[];
    /** Source of each mapping for debugging */
    mappingSources: Record<string, 'template' | 'standard' | 'fuzzy'>;
}

// ============================================================================
// STANDARD MAPPINGS (Fallback when template-specific mappings don't exist)
// These map Spanish extraction field names to common English PDF field patterns
// ============================================================================

const STANDARD_FIELD_MAPPINGS: Record<string, string[]> = {
    // Registrant Names
    "nombres": ["names", "given_names", "reg_names", "first_names", "nombre"],
    "primer_apellido": ["first_surname", "reg_1_surname", "surname1", "apellido1"],
    "segundo_apellido": ["second_surname", "reg_2_surname", "surname2", "apellido2"],

    // NUIP and Identifiers
    "nuip": ["nuip", "id_basic_part"],
    "nuip_top": ["nuip", "id_basic_part", "id_add_part"],
    "nuip_resolved": ["nuip"],
    "serial_indicator": ["serial_indicator", "serial", "indicativo"],
    "codigo": ["reg_code", "code", "qr_code"],
    "acta": ["birth_cert_number", "cert_number"],

    // Personal Data
    "sexo": ["sex", "sexo", "gender"],
    "grupo_sanguineo": ["blood_type", "blood", "tipo_sangre"],
    "factor_rh": ["rh_factor", "rh", "factor"],

    // Birth Details
    "fecha_nacimiento": ["date_of_birth", "birth_date"],
    "birth_day": ["birth_day", "day"],
    "birth_month": ["birth_month", "month"],
    "birth_year": ["birth_year", "year"],
    "hora_nacimiento": ["time", "birth_time", "hora"],
    "pais_nacimiento": ["country_birth", "country", "birth_country_dept_munic"],
    "departamento_nacimiento": ["dept_birth", "department", "birth_country_dept_munic"],
    "municipio_nacimiento": ["muni_birth", "municipality", "birth_country_dept_munic"],
    "lugar_nacimiento": ["township_birth", "birth_place", "place", "birth_country_dept_munic"],
    "birth_location_combined": ["birth_country_dept_munic", "place_of_birth", "birth_place"],

    // Father Information
    "padre_nombres": ["father_names", "father_surnames_names"],
    "padre_apellidos": ["father_surnames", "father_surnames_names"],
    "padre_identificacion": ["father_doc_number", "father_id_doc", "father_id"],
    "padre_tipo_documento": ["father_id_type", "father_doc_type", "father_type_id"],
    "padre_nacionalidad": ["father_nationality"],
    "father_full_name": ["father_surnames_names"],

    // Mother Information
    "madre_nombres": ["mother_names", "mother_surnames_names"],
    "madre_apellidos": ["mother_surnames", "mother_surnames_names"],
    "madre_identificacion": ["mother_doc_number", "mother_id_doc", "mother_id_number"],
    "madre_tipo_documento": ["mother_id_type", "mother_doc_type", "mother_type_id"],
    "madre_nacionalidad": ["mother_nationality"],
    "mother_full_name": ["mother_surnames_names"],

    // Declarant Information
    "declarante_nombres": ["declarant_surnames_names", "declarant_name"],
    "declarante_identificacion": ["declarant_id_doc", "declarant_id"],

    // Witness Information
    "testigo1_nombres": ["witness1_surnames_names", "witness1_name"],
    "testigo1_identificacion": ["witness1_id_doc", "witness1_id"],
    "testigo2_nombres": ["witness2_surnames_names", "witness2_name"],
    "testigo2_identificacion": ["witness2_id_doc", "witness2_id"],

    // Registry Information
    "oficina": ["office_type", "notary_number", "office"],
    "numero_oficina": ["notary_number", "office_number"],
    "departamento_registro": ["dept_office", "country_dept_munic"],
    "municipio_registro": ["muni_office", "country_dept_munic"],
    "fecha_registro": ["date_registration", "date_registered"],
    "reg_day": ["reg_day"],
    "reg_month": ["reg_month"],
    "reg_year": ["reg_year"],
    "registry_location_combined": ["country_dept_munic"],

    // Notes (special handling - distributes across multiple fields)
    "notas": ["notes1", "notes2", "notes3", "notes4", "notes5", "notes6", "notes7", "notes"],
    "margin_notes": ["notes1", "notes2", "notes3", "notes4", "notes5", "notes6", "notes7", "Space For Notes"],
    "notes_combined": ["notes1", "notes2", "notes3", "notes4", "notes5"],

    // Officials
    "authorizing_official": ["official_name&signature", "official_name", "funcionario"],
    "acknowledgment_official": ["ack_official_name&signature", "ack_official"],
    "funcionario_nombre": ["official_name&signature", "name_director"],

    // Document References
    "tipo_documento_anterior": ["prior_doc", "prior_document"],
    "tomo": ["tomo", "volume"],
    "folio": ["folio", "page"],
    "libro": ["libro", "book"]
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize a field name for comparison (lowercase, remove special chars)
 */
function normalizeFieldName(name: string): string {
    return name.toLowerCase()
        .replace(/[''`´]/g, "'")
        .replace(/[^a-z0-9'_]/g, '')
        .replace(/_+/g, '_');
}

/**
 * Check if two field names match (case-insensitive, normalized)
 */
function fieldsMatch(pdfField: string, pattern: string): boolean {
    const normPdf = normalizeFieldName(pdfField);
    const normPattern = normalizeFieldName(pattern);

    // Exact match
    if (normPdf === normPattern) return true;

    // Contains match (pdf field contains pattern or vice versa)
    if (normPdf.includes(normPattern) || normPattern.includes(normPdf)) {
        // Avoid too short matches (at least 3 chars)
        return normPattern.length >= 3 && normPdf.length >= 3;
    }

    return false;
}

/**
 * Find all PDF fields that match a pattern
 */
function findMatchingPdfFields(
    pattern: string,
    pdfFieldNames: string[],
    usedFields: Set<string>,
    excludePatterns: string[] = []
): string[] {
    const matches: string[] = [];

    for (const pdfField of pdfFieldNames) {
        // Skip already used fields to avoid duplicates
        if (usedFields.has(pdfField)) continue;

        // Check exclusions
        const shouldExclude = excludePatterns.some(excl =>
            normalizeFieldName(pdfField).includes(normalizeFieldName(excl))
        );
        if (shouldExclude) continue;

        // Check if matches
        if (fieldsMatch(pdfField, pattern)) {
            matches.push(pdfField);
        }
    }

    // Sort matches (prefer exact matches, then by field number if present)
    return matches.sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '') || '0');
        const numB = parseInt(b.replace(/\D/g, '') || '0');
        if (numA !== numB) return numA - numB;
        return a.localeCompare(b);
    });
}

// ============================================================================
// MAIN MAPPING FUNCTION
// ============================================================================

/**
 * Get the complete field mappings for a template
 * 
 * Priority:
 * 1. Template-specific mappings from content_profile.pdf_mappings
 * 2. Standard mappings (STANDARD_FIELD_MAPPINGS)
 * 3. Fuzzy matching as last resort
 */
export function getTemplateMappings(
    template: Template,
    pdfFieldNames: string[]
): FieldMappingResult {
    const result: FieldMappingResult = {
        mappings: {},
        reverseMappings: {},
        unmappedExtracted: [],
        unmappedPdf: [...pdfFieldNames],
        mappingSources: {}
    };

    const usedPdfFields = new Set<string>();

    // Create a lookup map for PDF fields (case-insensitive)
    const pdfFieldLookup = new Map<string, string>();
    pdfFieldNames.forEach(name => {
        pdfFieldLookup.set(normalizeFieldName(name), name);
    });

    // -------------------------------------------------------------------------
    // PHASE 1: Apply template-specific mappings (highest priority)
    // -------------------------------------------------------------------------
    const templateMappings = template.content_profile?.pdf_mappings || {};

    console.log(`[TemplateMapper] Template: ${template.name}`);
    console.log(`[TemplateMapper] PDF fields: ${pdfFieldNames.length}`);
    console.log(`[TemplateMapper] Template mappings: ${Object.keys(templateMappings).length}`);

    for (const [extractedField, pdfTargets] of Object.entries(templateMappings)) {
        if (!Array.isArray(pdfTargets) || pdfTargets.length === 0) continue;

        // Validate that the PDF fields actually exist in this template
        const validTargets = pdfTargets.filter(target => {
            const normalized = normalizeFieldName(target);
            return pdfFieldLookup.has(normalized) || pdfFieldNames.some(pf =>
                normalizeFieldName(pf) === normalized
            );
        });

        // Get the actual field names (proper case)
        const actualTargets = validTargets.map(target => {
            const normalized = normalizeFieldName(target);
            return pdfFieldLookup.get(normalized) ||
                pdfFieldNames.find(pf => normalizeFieldName(pf) === normalized) ||
                target;
        });

        if (actualTargets.length > 0) {
            result.mappings[extractedField] = actualTargets;
            result.mappingSources[extractedField] = 'template';

            // Track used fields and create reverse mappings
            actualTargets.forEach(pdfField => {
                usedPdfFields.add(pdfField);
                result.reverseMappings[pdfField] = extractedField;
            });
        }
    }

    // -------------------------------------------------------------------------
    // PHASE 2: Apply standard mappings for fields not yet mapped
    // -------------------------------------------------------------------------
    for (const [extractedField, patterns] of Object.entries(STANDARD_FIELD_MAPPINGS)) {
        // Skip if already mapped from template
        if (result.mappings[extractedField]) continue;

        const matchedFields: string[] = [];

        // Define exclusions based on field type
        let exclusions: string[] = [];
        if (['nombres', 'primer_apellido', 'segundo_apellido'].includes(extractedField)) {
            exclusions = ['witness', 'testigo', 'declarant', 'declarante', 'father', 'mother', 'padre', 'madre'];
        } else if (['authorizing_official', 'funcionario_nombre'].includes(extractedField)) {
            exclusions = ['acknowledgment', 'reconocimiento', 'ack_'];
        } else if (extractedField === 'registry_location_combined') {
            exclusions = ['birth'];
        }

        for (const pattern of patterns) {
            const matches = findMatchingPdfFields(pattern, pdfFieldNames, usedPdfFields, exclusions);
            matches.forEach(m => {
                if (!matchedFields.includes(m)) {
                    matchedFields.push(m);
                }
            });
        }

        if (matchedFields.length > 0) {
            result.mappings[extractedField] = matchedFields;
            result.mappingSources[extractedField] = 'standard';

            matchedFields.forEach(pdfField => {
                usedPdfFields.add(pdfField);
                if (!result.reverseMappings[pdfField]) {
                    result.reverseMappings[pdfField] = extractedField;
                }
            });
        }
    }

    // -------------------------------------------------------------------------
    // PHASE 3: Update unmapped lists
    // -------------------------------------------------------------------------
    result.unmappedPdf = pdfFieldNames.filter(pf => !usedPdfFields.has(pf));

    // Log summary
    console.log(`[TemplateMapper] Final mappings: ${Object.keys(result.mappings).length}`);
    console.log(`[TemplateMapper] Unmapped PDF fields: ${result.unmappedPdf.length}`);
    if (result.unmappedPdf.length > 0 && result.unmappedPdf.length <= 10) {
        console.log(`[TemplateMapper] Unmapped: ${result.unmappedPdf.join(', ')}`);
    }

    return result;
}

/**
 * Get mapping for a specific extracted field
 */
export function getMappingForField(
    extractedFieldName: string,
    mappingResult: FieldMappingResult
): string[] {
    // Try exact match
    if (mappingResult.mappings[extractedFieldName]) {
        return mappingResult.mappings[extractedFieldName];
    }

    // Try normalized match
    const normalized = normalizeFieldName(extractedFieldName);
    for (const [key, targets] of Object.entries(mappingResult.mappings)) {
        if (normalizeFieldName(key) === normalized) {
            return targets;
        }
    }

    return [];
}

/**
 * Check if a field is a "notes" type field (requires special distribution handling)
 */
export function isNotesField(fieldName: string): boolean {
    const lower = fieldName.toLowerCase();
    return lower.includes('note') || lower.includes('nota') || lower.includes('margin');
}
