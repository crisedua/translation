/**
 * Field Processor Module
 * 
 * Centralizes all field processing logic to ensure consistent and robust
 * handling of extracted data before PDF generation.
 * 
 * Key responsibilities:
 * 1. NUIP Priority - alphanumeric (nuip_top) over numeric (nuip_bottom)
 * 2. Location Combining - merge country/dept/municipality into single string
 * 3. Date Normalization - ensure consistent format
 * 4. Field Name Normalization - handle variations in field names
 */

interface ProcessedData {
    [key: string]: string | undefined;
}

/**
 * Check if a string contains letters (alphanumeric vs pure numeric)
 */
function isAlphanumeric(value: string): boolean {
    if (!value) return false;
    return /[a-zA-Z]/.test(value);
}

/**
 * Parse date from various formats and return components
 */
function parseDate(dateStr: string): { day: string; month: string; year: string } | null {
    if (!dateStr) return null;

    let day = '', month = '', year = '';

    // Handle DD/MM/YYYY or DD-MM-YYYY
    if (dateStr.includes('/') || dateStr.includes('-')) {
        const separator = dateStr.includes('/') ? '/' : '-';
        const parts = dateStr.split(separator);

        if (parts.length === 3) {
            if (parts[0].length === 4) {
                // YYYY-MM-DD or YYYY/MM/DD
                [year, month, day] = parts;
            } else {
                // DD-MM-YYYY or DD/MM/YYYY
                [day, month, year] = parts;
            }
        }
    }

    if (day && month && year) {
        return { day, month, year };
    }
    return null;
}

/**
 * Main processing function - transforms extracted data for PDF filling
 */
export function processExtractedData(extractedData: Record<string, any>): ProcessedData {
    const processed: ProcessedData = {};

    // Copy all existing fields first
    for (const [key, value] of Object.entries(extractedData)) {
        if (value !== null && value !== undefined) {
            processed[key] = String(value);
        }
    }

    // =========================================================================
    // 1. NUIP PRIORITY HANDLING
    // =========================================================================
    // Priority: alphanumeric nuip_top > numeric nuip_top > nuip_bottom > nuip
    const nuipTop = extractedData.nuip_top;
    const nuipBottom = extractedData.nuip_bottom;
    const nuipLegacy = extractedData.nuip;

    let finalNuip = '';

    // First preference: alphanumeric nuip_top (like "3HXSP3L3EZRFL")
    if (nuipTop && isAlphanumeric(String(nuipTop))) {
        finalNuip = String(nuipTop);
        console.log(`[FieldProcessor] Using alphanumeric nuip_top: ${finalNuip}`);
    }
    // Second: any nuip_top value
    else if (nuipTop && String(nuipTop).trim()) {
        finalNuip = String(nuipTop);
        console.log(`[FieldProcessor] Using nuip_top: ${finalNuip}`);
    }
    // Third: nuip_bottom
    else if (nuipBottom && String(nuipBottom).trim()) {
        finalNuip = String(nuipBottom);
        console.log(`[FieldProcessor] Using nuip_bottom: ${finalNuip}`);
    }
    // Fallback: legacy nuip field
    else if (nuipLegacy && String(nuipLegacy).trim()) {
        finalNuip = String(nuipLegacy);
        console.log(`[FieldProcessor] Using legacy nuip: ${finalNuip}`);
    }

    processed.nuip_resolved = finalNuip;
    processed.nuip = finalNuip; // Also set nuip for direct mapping

    // =========================================================================
    // 2. BIRTH LOCATION COMBINING
    // =========================================================================
    // Priority: Include the actual place name (clinic/hospital) + location parts
    const lugarNacimiento = extractedData.lugar_nacimiento || extractedData['Place of Birth'] || '';
    const birthLocationParts = [
        extractedData.pais_nacimiento || extractedData.country || 'COLOMBIA',
        extractedData.departamento_nacimiento || extractedData.department,
        extractedData.municipio_nacimiento || extractedData.municipality
    ].filter(Boolean);

    // Build full place of birth: "CLINIC NAME (COUNTRY - DEPT - MUNICIPALITY)" or just location
    let fullPlaceOfBirth = '';

    if (lugarNacimiento && String(lugarNacimiento).trim()) {
        const placeVal = String(lugarNacimiento).trim();
        const locationStr = birthLocationParts.join(' - ');

        // Check if the place value already contains location info to avoid duplication
        // (The AI extractor is often instructed to include full location in lugar_nacimiento)
        let alreadyHasLocation = false;

        if (locationStr) {
            // Check if it contains the municipality (most specific part)
            const muni = extractedData.municipio_nacimiento || extractedData.municipality;
            if (muni && placeVal.toLowerCase().includes(String(muni).toLowerCase())) {
                alreadyHasLocation = true;
            }
            // Fallback: Check for parentheses which usually indicate included location
            else if (placeVal.includes('(') && placeVal.includes(')')) {
                alreadyHasLocation = true;
            }
        }

        if (!alreadyHasLocation && locationStr) {
            fullPlaceOfBirth = `${placeVal} (${locationStr})`;
        } else {
            fullPlaceOfBirth = placeVal;
        }
    } else if (birthLocationParts.length > 0) {
        // Just location parts, no specific place
        fullPlaceOfBirth = birthLocationParts.join(' - ');
    }

    if (fullPlaceOfBirth) {
        processed.birth_location_combined = fullPlaceOfBirth;
        processed['Place of Birth'] = fullPlaceOfBirth; // Also set with English key
        console.log(`[FieldProcessor] Full place of birth: ${fullPlaceOfBirth}`);
    }

    // Also keep lugar_nacimiento separately for templates that have a dedicated field
    if (lugarNacimiento) {
        processed.birth_place = String(lugarNacimiento);
        processed.lugar_nacimiento = String(lugarNacimiento);
    }

    // =========================================================================
    // 3. REGISTRY LOCATION COMBINING
    // =========================================================================
    const regLocationParts = [
        extractedData.pais_registro || 'COLOMBIA',
        extractedData.departamento_registro,
        extractedData.municipio_registro
    ].filter(Boolean);

    if (regLocationParts.length > 0) {
        processed.registry_location_combined = regLocationParts.join(' - ');
        console.log(`[FieldProcessor] Combined registry location: ${processed.registry_location_combined}`);
    }

    // =========================================================================
    // 4. PARENT NAME COMBINING (for templates that have combined fields)
    // =========================================================================
    // Father: combine apellidos + nombres
    const fatherSurnames = extractedData.padre_apellidos || '';
    const fatherNames = extractedData.padre_nombres || '';
    if (fatherSurnames || fatherNames) {
        processed.father_full_name = [fatherSurnames, fatherNames].filter(Boolean).join(' ');
    }

    // Mother: combine apellidos + nombres
    const motherSurnames = extractedData.madre_apellidos || '';
    const motherNames = extractedData.madre_nombres || '';
    if (motherSurnames || motherNames) {
        processed.mother_full_name = [motherSurnames, motherNames].filter(Boolean).join(' ');
    }

    // =========================================================================
    // 5. DATE PARSING - Extract components for split date fields
    // =========================================================================
    if (extractedData.fecha_nacimiento) {
        const birthDate = parseDate(String(extractedData.fecha_nacimiento));
        if (birthDate) {
            processed.birth_day = birthDate.day;
            processed.birth_month = birthDate.month;
            processed.birth_year = birthDate.year;
        }
    }

    if (extractedData.fecha_registro) {
        const regDate = parseDate(String(extractedData.fecha_registro));
        if (regDate) {
            processed.reg_day = regDate.day;
            processed.reg_month = regDate.month;
            processed.reg_year = regDate.year;
        }
    }

    // =========================================================================
    // 6. SERIAL INDICATOR - ensure it's captured
    // =========================================================================
    if (extractedData.serial_indicator) {
        processed.serial_indicator = String(extractedData.serial_indicator);
    }
    // Sometimes serial indicator might be in a different field
    if (!processed.serial_indicator && extractedData.indicador_serial) {
        processed.serial_indicator = String(extractedData.indicador_serial);
    }

    // =========================================================================
    // 7. NOTES HANDLING - combine margin_notes with notas
    // =========================================================================
    const allNotes: string[] = [];
    if (extractedData.margin_notes) allNotes.push(String(extractedData.margin_notes));
    if (extractedData.notas) allNotes.push(String(extractedData.notas));
    if (allNotes.length > 0) {
        processed.notes_combined = allNotes.join('\n');
    }

    return processed;
}

/**
 * Get the robust field mappings - maps processed fields to PDF form fields
 * This is the definitive mapping that should be used for all templates
 */
export function getRobustMappings(pdfFieldNames: string[]): Record<string, string[]> {
    // Create a lowercase lookup for PDF fields
    const pdfFieldLookup = new Map<string, string>();
    pdfFieldNames.forEach(name => {
        pdfFieldLookup.set(name.toLowerCase(), name);
    });

    // Helper to find actual PDF field names (case-insensitive, returns ALL matches)
    const findFields = (pattern: string): string[] => {
        const lower = pattern.toLowerCase();
        const matches: Set<string> = new Set();

        // Check exact match first
        if (pdfFieldLookup.has(lower)) {
            matches.add(pdfFieldLookup.get(lower)!);
        }

        // Check partial matches
        for (const [key, value] of pdfFieldLookup) {
            // "notes" should match "Notes 1", "Notes_2", "SpaceForNotes"
            // But we want to be careful not to match "footnotes" if we are looking for "notes" (maybe too greedy? for now let's be greedy as fallback is tough)
            if (key.includes(lower) || lower.includes(key)) {
                matches.add(value);
            }
        }

        // Sort matches to ensure order (e.g. Notes 1, Notes 2, Notes 3)
        // This is important for sequential filling
        return Array.from(matches).sort((a, b) => {
            // Try to sort by embedded numbers if present
            const numA = parseInt(a.replace(/\D/g, '') || '0');
            const numB = parseInt(b.replace(/\D/g, '') || '0');
            if (numA !== numB) return numA - numB;
            return a.localeCompare(b);
        });
    };

    const mappings: Record<string, string[]> = {};

    // Define the comprehensive field mappings
    const fieldPatterns: Record<string, string[]> = {
        // Resolved/Combined fields (highest priority)
        "nuip_resolved": ["nuip"],
        "birth_location_combined": ["birth_country_dept_munic", "place_of_birth", "birth_place"],
        "Place of Birth": ["birth_country_dept_munic", "place_of_birth"],
        "lugar_nacimiento": ["birth_country_dept_munic", "place_of_birth", "birth_place"],
        "registry_location_combined": ["country_dept_munic"],
        "father_full_name": ["father_surnames_names"],
        "mother_full_name": ["mother_surnames_names"],
        "notes_combined": ["notes1", "notes", "notas", "space for notes", "spacefornotes", "margin notes", "marginnotes", "observaciones"],
        "margin_notes": ["notes1", "notes", "notas", "space for notes", "spacefornotes", "margin notes", "marginnotes", "observaciones"],

        // Names
        "nombres": ["reg_names", "given_names", "names"],
        "primer_apellido": ["reg_1_surname", "first_surname"],
        "segundo_apellido": ["reg_2_surname", "second_surname"],

        // Personal Info
        "nuip": ["nuip"],
        "serial_indicator": ["serial_indicator", "serial"],
        "sexo": ["sex", "sexo"],
        "grupo_sanguineo": ["blood_type"],
        "factor_rh": ["rh_factor"],

        // Birth Date Components
        "birth_day": ["birth_day", "day"],
        "birth_month": ["birth_month", "month"],
        "birth_year": ["birth_year", "year"],

        // Registration Date Components
        "reg_day": ["reg_day"],
        "reg_month": ["reg_month"],
        "reg_year": ["reg_year"],

        // Parents - Individual Fields
        "padre_nombres": ["father_names", "father_surnames_names"],
        "padre_apellidos": ["father_surnames", "father_surnames_names"],
        "padre_identificacion": ["father_id_doc", "father_doc_number"],
        "padre_nacionalidad": ["father_nationality"],
        "madre_nombres": ["mother_names", "mother_surnames_names"],
        "madre_apellidos": ["mother_surnames", "mother_surnames_names"],
        "madre_identificacion": ["mother_id_doc", "mother_doc_number"],
        "madre_nacionalidad": ["mother_nationality"],

        // Declarant
        "declarante_nombres": ["declarant_surnames_names"],
        "declarante_identificacion": ["declarant_id_doc"],

        // Witnesses
        "testigo1_nombres": ["witness1_surnames_names"],
        "testigo1_identificacion": ["witness1_id_doc"],
        "testigo2_nombres": ["witness2_surnames_names"],
        "testigo2_identificacion": ["witness2_id_doc"],

        // Registry Office
        "oficina": ["notary_number"],
        "numero_oficina": ["notary_number"],

        // Document IDs
        "codigo": ["reg_code"],
        "acta": ["birth_cert_number"],

        // Officials
        "authorizing_official": ["official_name&signature"],
        "funcionario_nombre": ["official_name&signature"],
        "acknowledgment_official": ["ack_official_name&signature"],

        // Prior Document
        "tipo_documento_anterior": ["prior_doc"]
    };

    // Build mappings based on what PDF fields actually exist
    for (const [extractedField, patterns] of Object.entries(fieldPatterns)) {
        const matchedFields: Set<string> = new Set();
        for (const pattern of patterns) {
            const foundList = findFields(pattern);
            foundList.forEach(f => matchedFields.add(f));
        }
        if (matchedFields.size > 0) {
            // Convert to array and sort again to be safe
            mappings[extractedField] = Array.from(matchedFields).sort((a, b) => {
                const numA = parseInt(a.replace(/\D/g, '') || '0');
                const numB = parseInt(b.replace(/\D/g, '') || '0');
                if (numA !== numB) return numA - numB;
                return a.localeCompare(b);
            });
        }
    }

    return mappings;
}
