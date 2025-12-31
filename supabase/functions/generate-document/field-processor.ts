/**
 * Field Processor Module
 * 
 * Centralizes all field processing logic to ensure consistent and robust
 * handling of extracted data before PDF generation.
 */

interface ProcessedData {
    [key: string]: string | undefined;
}

const MONTH_MAP: Record<string, string> = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
    'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12',
    'january': '01', 'february': '02', 'march': '03', 'april': '04', 'may': '05', 'june': '06',
    'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12'
};

function normalizeMonth(m: string): string {
    if (!m) return m;
    const low = m.toLowerCase().trim();
    if (/^\d+$/.test(low)) return low.padStart(2, '0');
    for (const [name, num] of Object.entries(MONTH_MAP)) {
        if (low.startsWith(name.substring(0, 3))) return num;
    }
    return m;
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
    } else {
        // Try splitting by space
        const parts = dateStr.split(/\s+/).filter(p => !['de', 'del'].includes(p.toLowerCase()));
        if (parts.length === 3) {
            [day, month, year] = parts;
        }
    }

    if (month) month = normalizeMonth(month);
    if (day) day = day.padStart(2, '0');

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
            let valStr = String(value);

            // Normalize months for ANY field that looks like a month field
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('month') || lowerKey.includes('mes')) {
                valStr = normalizeMonth(valStr);
            }

            processed[key] = valStr;
        }
    }

    // =========================================================================
    // 1. NUIP PRIORITY HANDLING
    // =========================================================================
    const nuipTop = extractedData.nuip_top;
    const nuipBottom = extractedData.nuip_bottom;
    const nuipLegacy = extractedData.nuip;

    let finalNuip = '';
    if (nuipTop && isAlphanumeric(String(nuipTop))) {
        finalNuip = String(nuipTop);
    } else if (nuipTop && String(nuipTop).trim()) {
        finalNuip = String(nuipTop);
    } else if (nuipBottom && String(nuipBottom).trim()) {
        finalNuip = String(nuipBottom);
    } else if (nuipLegacy && String(nuipLegacy).trim()) {
        finalNuip = String(nuipLegacy);
    }

    processed.nuip_resolved = finalNuip;

    // =========================================================================
    // 1b. NOTARY NUMBER HANDLING
    // =========================================================================
    // Ensure notary_number and numero_oficina are synced
    const notaryNum = extractedData.notary_number || extractedData.numero_oficina || extractedData.oficina_numero;
    if (notaryNum && String(notaryNum).trim()) {
        // Extract just the number if it contains text like "NOTARIA 21"
        const numMatch = String(notaryNum).match(/\d+/);
        const cleanNumber = numMatch ? numMatch[0] : String(notaryNum).trim();
        processed.notary_number = cleanNumber;
        processed.numero_oficina = cleanNumber;
        console.log(`[FieldProcessor] Set notary_number and numero_oficina to: ${cleanNumber}`);
    }

    // =========================================================================
    // 2. BIRTH LOCATION COMBINING
    // =========================================================================
    const birthLocationParts = [
        extractedData.pais_nacimiento,
        extractedData.departamento_nacimiento,
        extractedData.municipio_nacimiento
    ].filter(Boolean);

    if (extractedData.lugar_nacimiento && String(extractedData.lugar_nacimiento).length > 10) {
        processed.birth_location_combined = String(extractedData.lugar_nacimiento);
    } else if (birthLocationParts.length > 0) {
        processed.birth_location_combined = birthLocationParts.join(' - ');
    }

    if (extractedData.lugar_nacimiento) {
        processed.birth_place = String(extractedData.lugar_nacimiento);
        processed['Place of Birth'] = String(extractedData.lugar_nacimiento);
    }

    // =========================================================================
    // 3. REGISTRY LOCATION
    // =========================================================================
    if (extractedData.country_dept_munic) {
        processed.country_dept_munic = String(extractedData.country_dept_munic);
    } else if (extractedData.registry_location_combined) {
        processed.country_dept_munic = String(extractedData.registry_location_combined);
    }

    // =========================================================================
    // 4. PARENT NAME COMBINING
    // =========================================================================
    const fatherSurnames = extractedData.padre_apellidos || '';
    const fatherNames = extractedData.padre_nombres || '';
    if (fatherSurnames || fatherNames) {
        processed.father_full_name = [fatherSurnames, fatherNames].filter(Boolean).join(' ');
    }

    const motherSurnames = extractedData.madre_apellidos || '';
    const motherNames = extractedData.madre_nombres || '';
    if (motherSurnames || motherNames) {
        processed.mother_full_name = [motherSurnames, motherNames].filter(Boolean).join(' ');
    }

    // =========================================================================
    // 5. DATE PARSING
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
    // 6. SERIAL INDICATOR
    // =========================================================================
    if (extractedData.serial_indicator) {
        processed.serial_indicator = String(extractedData.serial_indicator);
    }
    if (!processed.serial_indicator && extractedData.indicador_serial) {
        processed.serial_indicator = String(extractedData.indicador_serial);
    }

    // =========================================================================
    // 7. NOTES HANDLING
    // =========================================================================
    const uniqueLines = new Set<string>();
    const finalNotes: string[] = [];

    const addToNotes = (val: any) => {
        if (!val) return;
        const noteStr = String(val).trim();
        if (!noteStr) return;

        const lines = noteStr.split('\n').map(l => l.trim()).filter(l => l);
        lines.forEach(line => {
            if (!uniqueLines.has(line)) {
                uniqueLines.add(line);
                finalNotes.push(line);
            }
        });
    };

    addToNotes(extractedData.margin_notes);
    addToNotes(extractedData.notas);
    addToNotes(extractedData.notes_combined);
    addToNotes(extractedData['SPACE FOR NOTES']);
    addToNotes(extractedData['Space For Notes']);

    // Add nuip_notes if it was extracted separately and not already in notes
    if (extractedData.nuip_notes) {
        const nuipNum = String(extractedData.nuip_notes).trim();
        // Check if any existing note line contains this number
        const alreadyHasNuip = Array.from(uniqueLines).some(line => line.includes(nuipNum));
        if (!alreadyHasNuip && nuipNum) {
            console.log(`[FieldProcessor] Adding nuip_notes to combined notes: ${nuipNum}`);
            addToNotes(nuipNum);
        }
    }

    // =========================================================================
    // PATTERN MATCHING: If notes contain "NUIP NUEVO" but no 10-digit number,
    // try to find a 10-digit number from other extracted data
    // =========================================================================
    const allNotesText = finalNotes.join(' ').toUpperCase();
    const hasNuipNuevo = allNotesText.includes('NUIP NUEVO');
    const has10DigitNumber = /\d{10}/.test(allNotesText);

    if (hasNuipNuevo && !has10DigitNumber) {
        console.log(`[FieldProcessor] Notes contain 'NUIP NUEVO' but no 10-digit number. Searching for number...`);

        // Look for 10-digit numbers in other extracted fields
        let foundNumber: string | null = null;

        // First, check nuip_notes explicitly
        if (extractedData.nuip_notes) {
            const match = String(extractedData.nuip_notes).match(/\d{10}/);
            if (match) foundNumber = match[0];
        }

        // Check notes_line4 (common location for handwritten NUIP)
        if (!foundNumber && extractedData.notes_line4) {
            const match = String(extractedData.notes_line4).match(/\d{10}/);
            if (match) foundNumber = match[0];
        }

        // Check all notes_line fields
        if (!foundNumber) {
            for (let i = 1; i <= 7; i++) {
                const lineVal = extractedData[`notes_line${i}`];
                if (lineVal) {
                    const match = String(lineVal).match(/\d{10}/);
                    if (match) {
                        foundNumber = match[0];
                        break;
                    }
                }
            }
        }

        // Check serial_indicator (sometimes confused with notes NUIP)
        if (!foundNumber && extractedData.serial_indicator) {
            const serialStr = String(extractedData.serial_indicator);
            if (/^\d{10}$/.test(serialStr)) {
                // Only use if it looks like a pure 10-digit number
                foundNumber = serialStr;
            }
        }

        // If we found a number, append it to notes
        if (foundNumber) {
            console.log(`[FieldProcessor] Found 10-digit number to append: ${foundNumber}`);
            // Find the line with NUIP NUEVO and append the number
            for (let i = 0; i < finalNotes.length; i++) {
                if (finalNotes[i].toUpperCase().includes('NUIP NUEVO') && !/\d{10}/.test(finalNotes[i])) {
                    finalNotes[i] = finalNotes[i] + ' ' + foundNumber;
                    console.log(`[FieldProcessor] Updated line ${i}: ${finalNotes[i]}`);
                    break;
                }
            }
        }
    }

    if (finalNotes.length > 0) {
        processed.notes_combined = finalNotes.join('\n');
    }

    return processed;
}

export function getRobustMappings(pdfFieldNames: string[]): Record<string, string[]> {
    const pdfFieldLookup = new Map<string, string>();
    pdfFieldNames.forEach(name => {
        pdfFieldLookup.set(name.toLowerCase(), name);
    });

    const findFields = (pattern: string, excludePatterns: string[] = []): string[] => {
        const lower = pattern.toLowerCase();
        const matches: Set<string> = new Set();
        if (pdfFieldLookup.has(lower)) {
            matches.add(pdfFieldLookup.get(lower)!);
        }
        for (const [key, value] of pdfFieldLookup) {
            const shouldExclude = excludePatterns.some(excl =>
                key.toLowerCase().includes(excl.toLowerCase())
            );
            if (shouldExclude) continue;
            if (key.includes(lower) || lower.includes(key)) {
                matches.add(value);
            }
        }
        return Array.from(matches).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, '') || '0');
            const numB = parseInt(b.replace(/\D/g, '') || '0');
            if (numA !== numB) return numA - numB;
            return a.localeCompare(b);
        });
    };

    const mappings: Record<string, string[]> = {};
    const fieldPatterns: Record<string, string[]> = {
        "nuip_resolved": ["nuip"],
        // === REGISTRANT SURNAMES ===
        "apellidos": ["surnames", "Surnames"],
        "primer_apellido": ["first_surname", "reg_1_surname"],
        "segundo_apellido": ["second_surname", "reg_2_surname"],
        // === ATOMIC BIRTH LOCATION MAPPINGS ===
        "pais_nacimiento": ["Country", "country_birth", "birth_country"],
        "departamento_nacimiento": ["dept_birth", "Department"],
        "municipio_nacimiento": ["muni_birth", "Municipality"],
        "corregimiento": ["township_birth", "Township/Police Station"],
        // Combined locations (only for combined PDF fields)
        "birth_location_combined": ["birth_country_dept_munic", "place_of_birth", "birth_place"],
        "Place of Birth": ["birth_country_dept_munic", "place_of_birth"],
        // NOTE: lugar_nacimiento removed - ambiguous field
        "registry_location_combined": ["country_dept_munic"],
        // === PARENT NAME MAPPINGS (STRICT) ===
        "father_full_name": ["father_surnames_names"],
        "mother_full_name": ["mother_surnames_names"],
        "notes_combined": ["notes1", "notes", "notas", "space for notes", "spacefornotes", "margin notes", "marginnotes", "observaciones"],
        "margin_notes": ["notes1", "notes", "notas", "space for notes", "spacefornotes", "margin notes", "marginnotes", "observaciones"],
        "nombres": ["reg_names", "given_names", "names"],
        "nuip": ["nuip"],
        "serial_indicator": ["serial_indicator", "serial"],
        "sexo": ["sex", "sexo"],
        "grupo_sanguineo": ["blood_type"],
        "factor_rh": ["rh_factor"],
        "birth_day": ["birth_day", "day"],
        "birth_month": ["birth_month", "month"],
        "birth_year": ["birth_year", "year"],
        "reg_day": ["reg_day"],
        "reg_month": ["reg_month"],
        "reg_year": ["reg_year"],
        "padre_nombres": ["father_names"],
        "padre_apellidos": ["father_surnames"],
        "padre_identificacion": ["father_id_doc", "father_doc_number"],
        "padre_nacionalidad": ["father_nationality"],
        "madre_nombres": ["mother_names"],
        "madre_apellidos": ["mother_surnames"],
        "madre_identificacion": ["mother_id_doc", "mother_id_number"],
        "madre_nacionalidad": ["mother_nationality"],
        "declarante_nombres": ["declarant_surnames_names"],
        "declarante_identificacion": ["declarant_id_doc"],
        "testigo1_nombres": ["witness1_surnames_names"],
        "testigo1_identificacion": ["witness1_id_doc"],
        "testigo2_nombres": ["witness2_surnames_names"],
        "testigo2_identificacion": ["witness2_id_doc"],
        "oficina": ["notary_number"],
        "numero_oficina": ["notary_number"],
        "codigo": ["reg_code"],
        "acta": ["birth_cert_number"],
        "authorizing_official": ["official_name&signature"],
        "funcionario_nombre": ["official_name&signature"],
        "acknowledgment_official": ["ack_official_name&signature"],
        "tipo_documento_anterior": ["prior_doc"]
    };

    for (const [extractedField, patterns] of Object.entries(fieldPatterns)) {
        const matchedFields: Set<string> = new Set();
        let exclusions: string[] = [];
        if (['nombres', 'primer_apellido', 'segundo_apellido', 'apellidos', 'reg_names', 'given_names'].includes(extractedField)) {
            exclusions = ['witness', 'testigo', 'declarant', 'declarante'];
        } else if (['authorizing_official', 'funcionario_nombre', 'funcionario_autoriza'].includes(extractedField)) {
            exclusions = ['acknowledgment', 'reconocimiento', 'ack_'];
        }
        for (const pattern of patterns) {
            const foundList = findFields(pattern, exclusions);
            foundList.forEach(f => matchedFields.add(f));
        }
        if (extractedField === 'registry_location_combined') {
            const filtered = Array.from(matchedFields).filter(f => !f.toLowerCase().includes('birth'));
            matchedFields.clear();
            filtered.forEach(f => matchedFields.add(f));
        }
        if (matchedFields.size > 0) {
            mappings[extractedField] = Array.from(matchedFields);
        }
    }
    return mappings;
}
