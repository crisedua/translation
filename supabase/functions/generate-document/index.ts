import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';
import { processExtractedData } from './field-processor.ts';
import { getTemplateMappings, isNotesField } from './template-field-mapper.ts';
import { getDirectMapping, isNotesFieldDirect, logMappingAttempt, DIRECT_MAPPINGS } from './direct-mapper.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    console.log("=== GENERATE-DOCUMENT FUNCTION INVOKED ===");
    console.log("Method:", req.method);
    console.log("URL:", req.url);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        console.log("Handling CORS preflight");
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { requestId } = await req.json();

        if (!requestId) {
            throw new Error("requestId is required");
        }

        console.log(`Generating document for request: ${requestId}`);

        // 1. Fetch Request Data
        const { data: request, error: reqError } = await supabase
            .from('document_requests')
            .select(`
                *,
                document_templates (
                    *
                )
            `)
            .eq('id', requestId)
            .single();

        if (reqError || !request) {
            throw new Error(`Request not found: ${reqError?.message}`);
        }

        const template = request.document_templates;
        if (!template) {
            throw new Error("No template associated with this request");
        }

        let extractedData = request.extracted_data;
        if (!extractedData) {
            throw new Error("No extracted data found available for this request");
        }

        if (!extractedData || Object.keys(extractedData).length === 0) {
            throw new Error("No extracted data found available for this request (empty object)");
        }

        // --- NEW: Process and standardize extracted data ---
        console.log("Raw extracted data keys:", Object.keys(extractedData).join(", "));

        // DEBUG: Log NUIP values before processing
        console.log(`[NUIP DEBUG] Before processing: nuip=${extractedData.nuip}, nuip_top=${extractedData.nuip_top}, NUIP=${extractedData.NUIP}`);

        try {
            extractedData = processExtractedData(extractedData);
        } catch (procError) {
            console.error("Error processing extracted data:", procError);
            throw new Error(`Failed to process extracted data: ${(procError as Error).message}`);
        }

        // DEBUG: Log NUIP values after processing
        console.log(`[NUIP DEBUG] After processing: nuip=${extractedData.nuip}, nuip_resolved=${extractedData.nuip_resolved}`);

        // DEBUG: Log ALL extracted field names and their values (first 50 chars)
        console.log("[EXTRACTED DATA DUMP]:");
        for (const [key, value] of Object.entries(extractedData)) {
            const strVal = String(value || '').substring(0, 50);
            console.log(`  "${key}": "${strVal}"${strVal.length >= 50 ? '...' : ''}`);
        }



        // POST-PROCESSING: Clear duplicate officials (robust - handles all field name variations)
        // If acknowledgment_official equals authorizing_official, clear it (likely a hallucination/duplication)

        // Try multiple field name variations
        const authVariations = ['authorizing_official', 'Authorizing Official', 'authorizingOfficial'];
        const ackVariations = ['acknowledgment_official', 'Acknowledgment Official', 'acknowledgmentOfficial'];

        let authValue = '';
        let ackValue = '';
        let ackFieldName = '';

        // Find authorizing official value
        for (const variant of authVariations) {
            if (extractedData[variant]) {
                authValue = String(extractedData[variant]).trim().toUpperCase();
                break;
            }
        }

        // Find acknowledgment official value and field name
        for (const variant of ackVariations) {
            if (extractedData[variant]) {
                ackValue = String(extractedData[variant]).trim().toUpperCase();
                ackFieldName = variant;
                break;
            }
        }

        // Clear if duplicate
        if (authValue && ackValue && authValue === ackValue && authValue.length > 0) {
            console.log(`[CLEANUP] Clearing duplicate acknowledgment_official (${ackFieldName}): "${ackValue}"`);
            extractedData[ackFieldName] = '';
        }


        console.log("Processed extracted data keys:", Object.keys(extractedData).join(", "));
        // ---------------------------------------------------

        console.log(`Using template: ${template.name}`);

        // 2. Fetch Template PDF
        let pdfBytes: ArrayBuffer;

        // Check if template_file_url is a full URL or a path
        const templateUrl = template.template_file_url;
        console.log(`Template URL: ${templateUrl}`);

        if (templateUrl.startsWith('http')) {
            // Check if it's a Supabase Storage URL and try to parse bucket/path
            const match = templateUrl.match(/\/storage\/v1\/object\/(?:sign|public)\/([^\/]+)\/(.+?)(?:\?|$)/);

            if (match) {
                const bucket = match[1];
                const path = decodeURIComponent(match[2]);
                console.log(`Detected Storage URL. Bucket: ${bucket}, Path: ${path}`);

                const { data: fileData, error: fileError } = await supabase
                    .storage
                    .from(bucket)
                    .download(path);

                if (!fileError) {
                    pdfBytes = await fileData.arrayBuffer();
                } else {
                    console.warn("Failed to download from storage using parsed path, trying fetch...", fileError);
                    const res = await fetch(templateUrl);
                    if (!res.ok) throw new Error(`Failed to fetch template PDF from URL: ${res.statusText}`);
                    pdfBytes = await res.arrayBuffer();
                }
            } else {
                const res = await fetch(templateUrl);
                if (!res.ok) throw new Error(`Failed to fetch template PDF from URL: ${res.statusText}`);
                pdfBytes = await res.arrayBuffer();
            }
        } else {
            // Assume it's a path in the 'templates' or 'documents' bucket
            console.log("Assuming path in storage...");

            // Try 'document_templates' bucket first (common for templates)
            let { data: fileData, error: fileError } = await supabase
                .storage
                .from('document_templates')
                .download(templateUrl);

            if (fileError) {
                // Try 'documents' bucket
                const { data: fileData2, error: fileError2 } = await supabase
                    .storage
                    .from('documents')
                    .download(templateUrl);

                if (fileError2) {
                    // Try 'templates' bucket
                    const { data: fileData3, error: fileError3 } = await supabase
                        .storage
                        .from('templates')
                        .download(templateUrl);

                    if (fileError3) throw new Error(`Failed to download template from storage (tried document_templates, documents, templates): ${fileError.message}`);
                    pdfBytes = await fileData3.arrayBuffer();
                } else {
                    pdfBytes = await fileData2.arrayBuffer();
                }
            } else {
                pdfBytes = await fileData.arrayBuffer();
            }
        }

        // 3. Fill PDF
        if (!pdfBytes || pdfBytes.byteLength === 0) {
            throw new Error("Downloaded PDF template is empty (0 bytes). Check storage path and permissions.");
        }
        console.log(`PDF Template loaded, size: ${pdfBytes.byteLength} bytes`);

        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        const fieldNames = fields.map(f => f.getName());

        console.log("PDF Fields found:", fieldNames.join(', '));
        console.log("Extracted Data Keys:", Object.keys(extractedData).join(', '));
        console.log("Document Type in extraction:", extractedData['tipo_documento'] || extractedData['Document Type']);

        // === DIAGNOSTIC: Parent Document Type Fields ===
        console.log("[DIAG] padre_tipo_documento:", extractedData['padre_tipo_documento'] || 'NOT_FOUND');
        console.log("[DIAG] madre_tipo_documento:", extractedData['madre_tipo_documento'] || 'NOT_FOUND');
        console.log("[DIAG] PDF fields containing 'type' or 'doc':", fieldNames.filter(f => f.toLowerCase().includes('type') || f.toLowerCase().includes('doc')).join(', '));
        console.log("[DIAG] PDF fields containing 'father' or 'mother':", fieldNames.filter(f => f.toLowerCase().includes('father') || f.toLowerCase().includes('mother')).join(', '));
        // === END DIAGNOSTIC ===

        // --- Use template-specific mappings first, then fallback to standard mappings ---
        const mappingResult = getTemplateMappings(template, fieldNames);
        console.log("Field Mappings:", JSON.stringify(mappingResult.mappings));
        console.log("Mapping sources:", JSON.stringify(mappingResult.mappingSources));
        if (mappingResult.unmappedPdf.length > 0) {
            console.log("Unmapped PDF fields:", mappingResult.unmappedPdf.join(', '));
        }

        const fieldMappings = mappingResult.mappings;
        // -----------------------------------------------------------

        let filledCount = 0;
        // Track which PDF fields have been filled to prevent overwriting
        // This is critical to stop bad mappings (e.g. official name -> Names field) from overwriting good data
        const filledPdfFields = new Set<string>();

        // Helper to sanitize text for PDF (WinAnsi encoding only supports Latin-1)
        // This removes or replaces characters that cannot be encoded
        const sanitizeForPdf = (text: string): string => {
            if (!text) return '';

            // Map of common problematic characters to their ASCII equivalents
            const replacements: Record<string, string> = {
                // Smart quotes to regular quotes
                '\u2018': "'", '\u2019': "'", '\u201B': "'",  // Single quotes
                '\u201C': '"', '\u201D': '"', '\u201E': '"',  // Double quotes
                '\u2032': "'", '\u2033': '"',                  // Prime marks
                '\u00B4': "'", '\u0060': "'",                  // Accents as quotes
                // Dashes
                '\u2013': '-', '\u2014': '-', '\u2015': '-',  // En/Em dashes
                // Ellipsis
                '\u2026': '...',
                // Spaces
                '\u00A0': ' ', '\u2003': ' ', '\u2002': ' ',  // Non-breaking spaces
                // Bullets
                '\u2022': '*', '\u2023': '>',
            };

            let result = text;

            // Apply known replacements
            for (const [char, replacement] of Object.entries(replacements)) {
                result = result.replace(new RegExp(char, 'g'), replacement);
            }

            // Remove any remaining non-Latin1 characters (anything above 0xFF)
            // But keep common accented characters (Latin-1 supplement: 0x00A0 - 0x00FF)
            result = result.replace(/[^\x00-\xFF]/g, '');

            return result;
        };

        // Helper to set text field safely with consistent font size
        const setField = (fieldName: string, value: string) => {
            try {
                // WARN: Check if field is already filled
                if (filledPdfFields.has(fieldName)) {
                    // Check if the current value is effectively empty
                    const existingField = form.getTextField(fieldName);
                    const existingText = existingField ? existingField.getText() : '';
                    if (existingText && existingText.trim().length > 0) {
                        console.warn(`[OVERWRITE BLOCKED] Field "${fieldName}" already set to "${existingText}". Skipping new value: "${String(value).substring(0, 30)}..."`);
                        return true; // Return true so flow continues as if handled
                    } else {
                        console.log(`[OVERWRITE ALLOWED] Field "${fieldName}" was previously empty/whitespace. Overwriting with: "${String(value).substring(0, 30)}..."`);
                    }
                }

                // PDF-lib is case sensitive normally, but let's try direct first
                let fieldExists = fieldNames.includes(fieldName);
                let targetName = fieldName;

                if (!fieldExists) {
                    // Try case-insensitive fallback
                    const lowerTarget = fieldName.toLowerCase();
                    const ciMatch = fieldNames.find(fn => fn.toLowerCase() === lowerTarget);
                    if (ciMatch) {
                        console.log(`[CASE-INSENSITIVE MATCH] Requested "${fieldName}", found "${ciMatch}"`);
                        targetName = ciMatch;
                        fieldExists = true;
                    }
                }

                const field = fieldExists ? form.getTextField(targetName) : null;
                if (field) {
                    // Sanitize the value before setting it
                    const sanitizedValue = sanitizeForPdf(value);
                    field.setText(sanitizedValue);

                    // Mark as filled
                    filledPdfFields.add(fieldName);

                    // Set consistent font size for all fields
                    try {
                        field.setFontSize(10);
                    } catch (fontError) {
                        // Some fields might not support font size changes
                    }
                    console.log(`Filled ${fieldName} with ${sanitizedValue.substring(0, 50)}${sanitizedValue.length > 50 ? '...' : ''}`);
                    return true;
                }
            } catch (e) {
                const msg = (e as Error).message;
                // suppress "no form field" errors as they are expected with robust mapping
                if (!msg.includes('no form field with the name')) {
                    console.warn(`Failed to set field ${fieldName}:`, msg);
                }
            }
            return false;
        };

        // Helper to parse date
        const parseDate = (dateStr: string) => {
            // Handle 01-03-2017 (DD-MM-YYYY) or 2017-03-01
            let day, month, year;
            if (!dateStr) return { day: '', month: '', year: '' };

            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                if (parts[0].length === 4) { // YYYY-MM-DD
                    [year, month, day] = parts;
                } else { // DD-MM-YYYY
                    [day, month, year] = parts;
                }
            } else if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts[0].length === 4) { // YYYY/MM/DD
                    [year, month, day] = parts;
                } else { // DD/MM/YYYY
                    [day, month, year] = parts;
                }
            }
            return { day, month, year };
        };

        // Helper to normalize apostrophes (smart quotes vs regular)
        // AI extractor may return ' (8217) while mappings use ' (39)
        const normalizeKey = (s: string) => s.replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4]/g, "'");

        // Create normalized mapping lookup
        const normalizedMappings: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(fieldMappings)) {
            normalizedMappings[normalizeKey(k)] = v;
        }

        // === PRE-PROCESSING: Combine Surnames ===
        // === DISABLED: Keep surnames separate as they are in the form ===
        // If we have separate surname fields but no combined one, create it.
        // This ensures that if the PDF has a single "Surnames" field, it gets the full value.
        /*
        if (extractedData['primer_apellido'] && extractedData['segundo_apellido'] && !extractedData['Apellidos']) {
            const combinedSurnames = `${extractedData['primer_apellido']} ${extractedData['segundo_apellido']}`.trim();
            console.log(`[PRE-PROCESS] Combining registrant surnames: "${combinedSurnames}"`);
            extractedData['Apellidos'] = combinedSurnames;
        }
        */
        console.log("[PRE-PROCESS] Registrant surnames: keeping separate (no combination)");

        // === PRE-PROCESS: Combine Parent Names ===
        // Many PDFs have a single field for "Apellidos y Nombres" of parents
        // If we extracted them separately, we MUST combine them here.

        // Father
        const fatherNames = extractedData['padre_nombres'] || extractedData['Father Names'] || '';
        const fatherSurnames = extractedData['padre_apellidos'] || extractedData['Father Surnames'] || '';

        if (fatherNames || fatherSurnames) {
            // Check if we have separate surnames for father
            let fullFatherSurnames = fatherSurnames;
            if (!fullFatherSurnames && extractedData['padre_primer_apellido']) {
                fullFatherSurnames = [extractedData['padre_primer_apellido'], extractedData['padre_segundo_apellido']].filter(Boolean).join(' ');
            }

            const fatherFull = `${fullFatherSurnames} ${fatherNames}`.trim();
            if (fatherFull) {
                console.log(`[PRE-PROCESS] Combining Father Full Name: "${fatherFull}"`);
                extractedData['padre_completo'] = fatherFull;
                extractedData["Father's Surnames and Full Names"] = fatherFull;
            }
        }

        // Mother
        const motherNames = extractedData['madre_nombres'] || extractedData['Mother Names'] || '';
        const motherSurnames = extractedData['madre_apellidos'] || extractedData['Mother Surnames'] || '';

        if (motherNames || motherSurnames) {
            // Check if we have separate surnames for mother
            let fullMotherSurnames = motherSurnames;
            if (!fullMotherSurnames && extractedData['madre_primer_apellido']) {
                fullMotherSurnames = [extractedData['madre_primer_apellido'], extractedData['madre_segundo_apellido']].filter(Boolean).join(' ');
            }

            const motherFull = `${fullMotherSurnames} ${motherNames}`.trim();
            if (motherFull) {
                console.log(`[PRE-PROCESS] Combining Mother Full Name: "${motherFull}"`);
                extractedData['madre_completo'] = motherFull;
                extractedData["Mother's Surnames and Full Names"] = motherFull;
            }
        }


        // === CRITICAL EARLY FILL: Parent Full Names and Place of Birth ===
        // These MUST be filled BEFORE the main loop to prevent partial data from blocking complete data
        console.log("[CRITICAL-FILL] Filling parent names and birth place EARLY to prevent overwrite blocking...");

        // Parent Full Names
        const motherFullName = extractedData.madre_completo || extractedData["Mother's Surnames and Full Names"];
        const fatherFullName = extractedData.padre_completo || extractedData["Father's Surnames and Full Names"];

        if (motherFullName) {
            console.log(`[CRITICAL-FILL] Mother: ${motherFullName}`);
            for (const pdfField of fieldNames) {
                const fieldLower = pdfField.toLowerCase();
                if (fieldLower.includes('mother') && (fieldLower.includes('surname') || fieldLower.includes('name') || fieldLower.includes('full'))) {
                    if (fieldLower.includes('identification') || fieldLower.includes('document') || fieldLower.includes('nationality')) continue;
                    if (setField(pdfField, motherFullName)) {
                        console.log(`[CRITICAL-FILL] SUCCESS: Mother -> "${pdfField}"`);
                        break;
                    }
                }
            }
        }

        if (fatherFullName) {
            console.log(`[CRITICAL-FILL] Father: ${fatherFullName}`);
            for (const pdfField of fieldNames) {
                const fieldLower = pdfField.toLowerCase();
                if (fieldLower.includes('father') && (fieldLower.includes('surname') || fieldLower.includes('name') || fieldLower.includes('full'))) {
                    if (fieldLower.includes('identification') || fieldLower.includes('document') || fieldLower.includes('nationality')) continue;
                    if (setField(pdfField, fatherFullName)) {
                        console.log(`[CRITICAL-FILL] SUCCESS: Father -> "${pdfField}"`);
                        break;
                    }
                }
            }
        }

        // Place of Birth
        const birthPlace = extractedData.lugar_nacimiento || extractedData.birth_location_combined;
        if (birthPlace) {
            console.log(`[CRITICAL-FILL] Birth Place: ${birthPlace}`);
            for (const pdfField of fieldNames) {
                const fieldLower = pdfField.toLowerCase();
                const isPlaceField = (
                    (fieldLower.includes('place') && fieldLower.includes('birth')) ||
                    (fieldLower.includes('lugar') && fieldLower.includes('nacimiento')) ||
                    (fieldLower.includes('birth') && fieldLower.includes('country')) ||
                    (fieldLower.includes('birth') && fieldLower.includes('department'))
                );
                if (fieldLower.includes('registro') || fieldLower.includes('registry')) continue;
                if (isPlaceField) {
                    if (setField(pdfField, birthPlace)) {
                        console.log(`[CRITICAL-FILL] SUCCESS: Birth Place -> "${pdfField}"`);
                        // Don't break - fill all matching fields
                    }
                }
            }
        }
        console.log("[CRITICAL-FILL] Early critical fills complete.");
        // === END CRITICAL EARLY FILL ===

        // Prioritize specific atomic fields over composite or fuzzy fields
        // Prioritize specific atomic fields over composite or fuzzy fields
        const priorityFields = ['nuip', 'nuip_top', 'tipo_documento', 'Document Type', 'nombres', 'Apellidos', 'apellidos', 'names', 'surnames', 'pais_registro', 'Pais Registro', 'fecha_expedicion', 'issue_date', 'issue_day', 'issue_month', 'issue_year', 'fecha_registro', 'reg_day', 'reg_month', 'reg_year', 'oficina', 'reg_office'];

        const sortedEntries = Object.entries(extractedData).sort(([keyA], [keyB]) => {
            const idxA = priorityFields.indexOf(keyA);
            const idxB = priorityFields.indexOf(keyB);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB; // Both in list, sort by index
            if (idxA !== -1) return -1; // A is in list, A comes first
            if (idxB !== -1) return 1;  // B is in list, B comes first
            return 0; // Neither in list, keep order
        });

        for (const [key, value] of sortedEntries) {
            if (value === null || value === undefined || value === '') continue;

            const strValue = String(value);
            const normalizedKey = normalizeKey(key);
            let filled = false;

            // === STRATEGY 0: Use Direct Mapper (highest priority, most reliable) ===
            const directTargets = getDirectMapping(key);
            if (directTargets.length > 0) {
                // Handle notes fields specially (distribute across multiple fields)
                if (isNotesFieldDirect(key) && directTargets.length > 1) {
                    const parts = strValue.split('\n').map(p => p.trim()).filter(p => p);
                    directTargets.forEach((target, index) => {
                        if (index < parts.length) {
                            if (setField(target, parts[index])) {
                                filled = true;
                                filledCount++;
                                logMappingAttempt(key, directTargets, true, target);
                            }
                        }
                    });
                } else {
                    // Standard: try each target until one works
                    for (const target of directTargets) {
                        if (setField(target, strValue)) {
                            filled = true;
                            filledCount++;
                            logMappingAttempt(key, directTargets, true, target);
                            break; // Stop after first success
                        }
                    }
                }
            }

            // 1. Try exact match (Canonical Key -> PDF Field Name)
            // Sometimes the extracted key IS the pdf field name
            if (!filled && setField(key, strValue)) {
                filled = true;
                filledCount++;
            }

            // 2. Try DB-configured mappings (with normalized key)
            if (!filled && normalizedMappings[normalizedKey]) {
                const targets = normalizedMappings[normalizedKey];


                // SPECIAL HANDLING: For "notes" fields, distribute text across fields instead of repeating
                // This prevents the same note from appearing 5 times in the list
                const isNoteFieldCheck = isNotesField(key);

                if (isNoteFieldCheck && targets.length > 1) {
                    console.log(`Distributing notes for ${key} across ${targets.length} fields`);

                    // Split content by newlines first
                    let parts = strValue.split('\n').map(p => p.trim()).filter(p => p);

                    // If single long line, maybe split by chunks? 
                    // For now, let's just use the parts. If only 1 part, only fill 1 field.

                    targets.forEach((target, index) => {
                        if (index < parts.length) {
                            if (setField(target, parts[index])) {
                                filled = true;
                                filledCount++;
                            }
                        } else {
                            // Clear remaining fields if possible, or just don't set them
                            // setField(target, ""); 
                        }
                    });
                } else {
                    // Standard behavior: Duplicate value to all mapped fields (e.g., Department -> birth & office)
                    for (const mappedName of targets) {
                        if (setField(mappedName, strValue)) {
                            filled = true;
                            filledCount++;
                        }
                    }
                }
            }

            // 2.5 FALLBACK: Check comprehensive defaults if still not filled
            // This ensures that even if DB mappings exist but are incomplete, we still try standard fields
            if (!filled) {
                const defaultMappings: Record<string, string[]> = {
                    // Names - using exact AI field names
                    "nombres": ["names", "reg_names"],
                    "apellidos": ["surnames", "reg_1_surname"],
                    "primer_apellido": ["first_surname", "reg_1_surname"],
                    "segundo_apellido": ["second_surname", "reg_2_surname"],
                    "First Surname": ["reg_1_surname"],
                    "Second Surname": ["reg_2_surname"],
                    "Given Name(s)": ["reg_names"],
                    "Registrant's Names": ["reg_names"],

                    // NUIP and identifiers
                    "nuip": ["nuip"], "NUIP": ["nuip"],
                    "Serial Indicator": ["serial_indicator"],
                    "Code": ["reg_code"],

                    // Sex
                    "sexo": ["sex"], "Sex": ["sex"], "Sex (in words)": ["sex"],

                    // Blood
                    "grupo_sanguineo": ["blood_type"], "Blood Type": ["blood_type"],
                    "factor_rh": ["rh_factor"], "Rh Factor": ["rh_factor"],

                    // Birth place
                    "Place of Birth": ["birth_country_dept_munic", "Place of Birth (Country - Department - Municipality - Township and/or Police Station)", "Lugar de nacimiento"],
                    "Country - Department - Municipality - Township and/or Police Station": ["country_dept_munic", "Place of Birth (Country - Department - Municipality - Township and/or Police Station)"],
                    "lugar_nacimiento": ["birth_country_dept_munic", "Place of Birth (Country - Department - Municipality - Township and/or Police Station)", "Lugar de nacimiento(Pais - Departamento - Municipio)", "Lugar de nacimiento"],

                    // Parents - using exact AI field names  
                    "Father's Surnames and Full Names": ["father_surnames_names", "Father Surnames and Full Names", "Apellidos y nombres completos padre"],
                    "Mother's Surnames and Full Names": ["mother_surnames_names", "Mother Surnames and Full Names", "Apellidos y nombres completos madre"],
                    "padre_completo": ["father_surnames_names", "Father Surnames and Full Names", "Apellidos y nombres completos padre"],
                    "madre_completo": ["mother_surnames_names", "Mother Surnames and Full Names", "Apellidos y nombres completos madre"],

                    "Father's Identification Document": ["father_id_doc"],
                    "Mother's Identification Document": ["mother_id_doc"],
                    "Father's Nationality": ["father_nationality"],
                    "Mother's Nationality": ["mother_nationality"],
                    "madre_nombres": ["mother_surnames_names"], // Fallback if complete not available
                    "padre_nombres": ["father_surnames_names"], // Fallback if complete not available
                    "padre_tipo_documento": ["father_id_type", "father_doc_type", "father_document_type", "Type of Document (Father)", "Father Document Type"],
                    "madre_tipo_documento": ["mother_id_type", "mother_doc_type", "mother_document_type", "Type of Document (Mother)", "Mother Document Type"],

                    // Office
                    "Notary Number": ["notary_number"],
                    "Registry Office": ["reg_office"],

                    // Notes - Extract multiple note formats
                    "Notes": ["notes1"],
                    "notas": ["notes1", "notes2", "notes3"],
                    "margin_notes": ["notes1", "notes2", "notes3", "notes4", "notes5", "Space For Notes"],

                    // Prior Document
                    "Type of Prior Document or Witness Statement": ["prior_doc"],
                    "tipo_documento_anterior": ["prior_doc"],

                    // Signature / Officials - use actual PDF field names
                    "Signature": ["signature"],
                    "authorizing_official": ["official_name&signature", "Name and Signature of Authorizing Official", "auth_official", "funcionario_autoriza"],
                    "acknowledgment_official": ["ack_official_name&signature", "Name and Signature of Official before whom the Acknowledgment is Made", "ack_official", "funcionario_reconocimiento"],
                    "funcionario_nombre": ["official_name&signature", "Name and Signature of Authorizing Official", "auth_official"],

                    // Witnesses - use actual PDF field names
                    "testigo1_nombres": ["witness1_surnames_names"],
                    "testigo1_identificacion": ["witness1_id_doc"],
                    "testigo2_nombres": ["witness2_surnames_names"],
                    "testigo2_identificacion": ["witness2_id_doc"],
                    "First Witness's Surnames and Full Names": ["witness1_surnames_names"],
                    "First Witness's Identification Document": ["witness1_id_doc"],
                    "Second Witness's Surnames and Full Names": ["witness2_surnames_names"],
                    "Second Witness's Identification Document": ["witness2_id_doc"]
                };

                // Normalize key for comparison (handle apostrophe variations)
                const normalizeForMatch = (s: string) => s.toLowerCase().replace(/[''`´]/g, "'").replace(/[^a-z0-9']/g, '');
                const normalizedKey = normalizeForMatch(key);

                // Try exact match first
                if (defaultMappings[key]) {
                    const targets = defaultMappings[key];
                    const isNoteField = key.toLowerCase().includes('note') || key.toLowerCase().includes('nota');

                    if (isNoteField && targets.length > 1) {
                        // Distribute notes
                        let parts = strValue.split('\n').map(p => p.trim()).filter(p => p);
                        targets.forEach((target, index) => {
                            if (index < parts.length) {
                                if (setField(target, parts[index])) {
                                    filled = true;
                                    filledCount++;
                                }
                            }
                        });
                    } else {
                        for (const mappedName of targets) {
                            if (setField(mappedName, strValue)) {
                                filled = true;
                                filledCount++;
                            }
                        }
                    }
                }

                // Try normalized match if exact didn't work
                if (!filled) {
                    for (const [mappingKey, mappedNames] of Object.entries(defaultMappings)) {
                        if (normalizeForMatch(mappingKey) === normalizedKey) {
                            for (const mappedName of mappedNames) {
                                if (setField(mappedName, strValue)) {
                                    filled = true;
                                    filledCount++;
                                    console.log(`Normalized match: "${key}" -> "${mappedName}" = "${strValue.substring(0, 30)}..."`);
                                }
                            }
                            break;
                        }
                    }
                }
            }

            // 3. Special handling for dates (day, month, year split fields)
            // This is generic logic: if a key is a date, try to fill split fields
            // We check if the key contains 'fecha', 'date', 'dob' or if it maps to a date field
            const isDateKey = key.toLowerCase().includes('fecha') || key.toLowerCase().includes('date') || key.toLowerCase().includes('dob') || key === 'Date of Issue';

            if (isDateKey) {
                const { day, month, year } = parseDate(strValue);
                if (day && month && year) {
                    const lowerKey = key.toLowerCase();

                    // CASE 1: Birth Date (nacimiento, dob)
                    if (lowerKey.includes('nacimiento') || lowerKey.includes('dob') || lowerKey.includes('birth')) {
                        setField('birth_day', day);
                        setField('birth_month', month);
                        setField('birth_year', year);
                        // Do NOT fill generic 'day' etc.
                    }

                    // CASE 2: Registration Date (registro, reg)
                    else if (lowerKey.includes('registro') || lowerKey.includes('reg_')) {
                        setField('reg_day', day);
                        setField('reg_month', month);
                        setField('reg_year', year);
                    }

                    // CASE 3: Issue/Expedition Date (expedicion, issue)
                    // These often correspond to the generic "Day", "Month", "Year" fields on the form footer
                    else if (lowerKey.includes('expedicion') || lowerKey.includes('issue')) {
                        // Fill specific maps
                        setField('issue_day', day);
                        setField('issue_month', month);
                        setField('issue_year', year);

                        // Fill generic maps (FALLBACK for Issue Date)
                        setField('day', day);
                        setField('Day', day); // Capitalized
                        setField('month', month);
                        setField('Month', month); // Capitalized
                        setField('year', year);
                        setField('Year', year); // Capitalized
                    }
                }
            }

            // 4. Try fuzzy/normalization match (fallback)
            if (!filled) {
                const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                const foundField = fieldNames.find(f => {
                    const normalizedF = f.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return normalizedF === normalizedKey || normalizedF.includes(normalizedKey);
                });

                if (foundField) {
                    if (setField(foundField, strValue)) filledCount++;
                }
            }
        }

        // === SPECIAL HANDLING: Place of Birth ===
        // CRITICAL: Ensure the FULL place of birth string (with clinic name) gets filled
        const placeOfBirthValue = extractedData.lugar_nacimiento ||
            extractedData.birth_location_combined ||
            extractedData['Place of Birth'] ||
            extractedData['Lugar Nacimiento'] ||
            extractedData.birth_place;

        if (placeOfBirthValue) {
            console.log(`[SPECIAL] Trying to fill Place of Birth with: ${placeOfBirthValue}`);

            // Try every PDF field that could be for birth place
            let birthPlaceFilled = false;
            for (const pdfField of fieldNames) {
                const fieldLower = pdfField.toLowerCase();

                // Match fields containing "place" AND "birth", OR "lugar" AND "nacimiento"
                const isPlaceField = (
                    (fieldLower.includes('place') && fieldLower.includes('birth')) ||
                    (fieldLower.includes('lugar') && fieldLower.includes('nacimiento')) ||
                    (fieldLower.includes('birth') && fieldLower.includes('country')) ||
                    (fieldLower.includes('birth') && fieldLower.includes('department'))
                );

                // Exclude registry location fields
                if (fieldLower.includes('registro') || fieldLower.includes('registry')) continue;

                if (isPlaceField) {
                    if (setField(pdfField, String(placeOfBirthValue))) {
                        console.log(`[SPECIAL] SUCCESS: Filled "${pdfField}" with place of birth`);
                        filledCount++;
                        birthPlaceFilled = true;
                        // Don't break - try all matching fields to ensure it's set
                    }
                }
            }

            if (!birthPlaceFilled) {
                console.warn(`[SPECIAL] WARNING: Could not find suitable PDF field for place of birth`);
            }
        }
        // === END SPECIAL HANDLING ===

        // === SPECIAL HANDLING: Document Type ===
        const docTypeValue = extractedData.tipo_documento || extractedData['Document Type'];
        if (docTypeValue) {
            console.log(`[SPECIAL] Trying to fill Document Type (Fallback) with: ${docTypeValue}`);
            for (const pdfField of fieldNames) {
                const fieldLower = pdfField.toLowerCase();
                if (fieldLower.includes('document') && fieldLower.includes('type')) {
                    if (setField(pdfField, String(docTypeValue))) {
                        console.log(`[SPECIAL] SUCCESS: Filled "${pdfField}" with document type`);
                        filledCount++;
                        // Don't break here, fill all instances if multiple exist
                    }
                }
            }
        }
        // === END SPECIAL HANDLING ===

        // === SPECIAL HANDLING: Parent Full Names ===
        // MOVED TO CRITICAL-FILL SECTION (before main loop) to prevent overwrite blocking
        /*
        const motherFullName = extractedData.madre_completo ||
            extractedData["Mother's Surnames and Full Names"] ||
            (extractedData.madre_apellidos && extractedData.madre_nombres
                ? `${extractedData.madre_apellidos} ${extractedData.madre_nombres}`.trim()
                : null);

        const fatherFullName = extractedData.padre_completo ||
            extractedData["Father's Surnames and Full Names"] ||
            (extractedData.padre_apellidos && extractedData.padre_nombres
                ? `${extractedData.padre_apellidos} ${extractedData.padre_nombres}`.trim()
                : null);

        if (motherFullName) {
            console.log(`[SPECIAL] Trying to fill Mother's Full Name with: ${motherFullName}`);
            for (const pdfField of fieldNames) {
                const fieldLower = pdfField.toLowerCase();
                if (fieldLower.includes('mother') &&
                    (fieldLower.includes('surname') || fieldLower.includes('name') || fieldLower.includes('full'))) {
                    if (fieldLower.includes('identification') || fieldLower.includes('document') || fieldLower.includes('nationality')) continue;

                    if (setField(pdfField, motherFullName)) {
                        console.log(`[SPECIAL] SUCCESS: Filled \"${pdfField}\" with mother's full name`);
                        filledCount++;
                        break;
                    }
                }
            }
        }

        if (fatherFullName) {
            console.log(`[SPECIAL] Trying to fill Father's Full Name with: ${fatherFullName}`);
            for (const pdfField of fieldNames) {
                const fieldLower = pdfField.toLowerCase();
                if (fieldLower.includes('father') &&
                    (fieldLower.includes('surname') || fieldLower.includes('name') || fieldLower.includes('full'))) {
                    if (fieldLower.includes('identification') || fieldLower.includes('document') || fieldLower.includes('nationality')) continue;

                    if (setField(pdfField, fatherFullName)) {
                        console.log(`[SPECIAL] SUCCESS: Filled \"${pdfField}\" with father's full name`);
                        filledCount++;
                        break;
                    }
                }
            }
        }
        */
        // === END SPECIAL HANDLING ===

        // ============================================================================
        // VERIFICATION STEP: Validate that extracted data made it into the PDF
        // ============================================================================
        console.log("\n[VERIFICATION REPORT] Validating generated document content...");
        let matchCount = 0;
        let mismatchCount = 0;
        const verificationDetails: any[] = [];
        const contentProfile = template.content_profile || {};

        for (const [key, value] of Object.entries(extractedData)) {
            if (!value || String(value).trim() === '') continue; // Skip empty fields

            // SKIP VALIDATION FOR VIRTUAL/HELPER FIELDS
            const lowerKey = key.toLowerCase();
            if (lowerKey.endsWith('_combined') ||
                lowerKey.endsWith('_resolved') ||
                lowerKey.endsWith('_top') ||
                lowerKey.endsWith('_full_name') ||
                lowerKey === 'authorizing_official' ||
                lowerKey === 'birth_place' ||
                lowerKey === 'lugar_nacimiento' ||
                lowerKey === 'place of birth' ||
                lowerKey.includes('birth_day') || lowerKey.includes('birth_month') || lowerKey.includes('birth_year') ||
                lowerKey.includes('issue_day') || lowerKey.includes('issue_month') || lowerKey.includes('issue_year') ||
                lowerKey.includes('reg_day') || lowerKey.includes('reg_month') || lowerKey.includes('reg_year') ||
                ['day', 'month', 'year'].includes(lowerKey)) {
                console.log(`[QA SKIP] Skipping virtual or split date field: ${key}`);
                continue;
            }

            const strValue = String(value).trim();
            const sanitizedExpected = sanitizeForPdf(strValue); // What we expect to be in the PDF

            // Determine where this field should have gone
            // 1. Check direct mappings
            const directTargets = getDirectMapping(key);
            // 2. Check template mappings
            let templateTargets: string[] = [];
            const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (contentProfile.pdf_mappings && contentProfile.pdf_mappings[normalizedKey]) {
                templateTargets = contentProfile.pdf_mappings[normalizedKey];
            }
            // 3. Exact match
            const exactTarget = fieldNames.includes(key) ? key : null;

            const allPotentialTargets = [...new Set([...directTargets, ...templateTargets, ...(exactTarget ? [exactTarget] : [])])];

            let foundInPdf = false;
            let actualValueInPdf = "";
            let matchedField = "";

            // Check if any of the target fields contains our expected value
            for (const targetField of allPotentialTargets) {
                try {
                    const pdfField = form.getTextField(targetField);
                    if (pdfField) {
                        const val = pdfField.getText() || "";
                        if (val.includes(sanitizedExpected) || sanitizedExpected.includes(val)) {
                            foundInPdf = true;
                            actualValueInPdf = val;
                            matchedField = targetField;
                            break;
                        } else if (filledPdfFields.has(targetField)) {
                            // It was filled, but maybe value doesn't match exactly?
                            // Keep looking, but remember this potential candidate
                            actualValueInPdf = val;
                        }
                    }
                } catch (e) {
                    // Ignore error if field type mismatch or missing
                }
            }

            if (foundInPdf) {
                matchCount++;
                verificationDetails.push({ key, status: "MATCH", expected: strValue, field: matchedField });
                console.log(`✅ MATCH: "${key}" (${strValue}) found in PDF field "${matchedField}"`);
            } else {
                mismatchCount++;
                verificationDetails.push({ key, status: "MISMATCH", expected: strValue, targets: allPotentialTargets, actual: actualValueInPdf });
                if (allPotentialTargets.length > 0) {
                    console.warn(`❌ MISMATCH: "${key}" (${strValue}) NOT found in targets [${allPotentialTargets.join(', ')}]. PDF has: "${actualValueInPdf}"`);
                } else {
                    console.warn(`⚠️ UNMAPPED: "${key}" (${strValue}) has NO mapped targets!`);
                }
            }
        }

        console.log(`[VERIFICATION SUMMARY] Matches: ${matchCount}, Mismatches/Unmapped: ${mismatchCount}`);
        console.log("===========================================================================\n");

        console.log(`Filled ${filledCount} fields`);

        // Flatten the form (optional, makes it uneditable)
        // form.flatten(); 

        const pdfOut = await pdfDoc.save();

        // 4. Upload Generated PDF
        const fileName = `generated_${requestId}_${Date.now()}.pdf`;
        const outPath = `generated/${fileName}`;

        console.log(`Uploading to documents/${outPath}...`);

        const { error: uploadError } = await supabase
            .storage
            .from('documents')
            .upload(outPath, pdfOut, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        // 5. Get URL
        // Create a signed URL valid for a long time (e.g., 1 year) to allow viewing
        const { data: urlData, error: urlError } = await supabase
            .storage
            .from('documents')
            .createSignedUrl(outPath, 60 * 60 * 24 * 365);

        if (urlError) throw new Error(`Failed to create signed URL: ${urlError.message}`);

        const generatedUrl = urlData.signedUrl;

        // 6. Update Request
        const isQaFailed = mismatchCount > 0;

        const qaErrors = verificationDetails
            .filter(d => d.status === 'MISMATCH')
            .map(d => `[GEN-QA] Field '${d.key}' mismatch: Expected '${d.expected.substring(0, 50)}...', Found '${d.actual.substring(0, 50)}...'`);

        const updatePayload: any = {
            generated_document_url: generatedUrl,
            updated_at: new Date().toISOString()
        };

        if (isQaFailed) {
            console.warn("Generation QA FAILED. Updating status to needs_correction.");
            updatePayload.status = 'needs_correction';
            updatePayload.validation_errors = qaErrors;
        }

        const { error: updateError } = await supabase
            .from('document_requests')
            .update(updatePayload)
            .eq('id', requestId);

        if (updateError) throw new Error(`Failed to update request: ${updateError.message}`);

        return new Response(
            JSON.stringify({
                success: true,
                requestId: requestId,
                generatedUrl: generatedUrl,
                filledFields: filledCount,
                verification: {
                    matches: matchCount,
                    mismatches: mismatchCount,
                    details: verificationDetails
                }
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );

    } catch (error) {
        console.error("Error generating document:", error);

        let errorMessage = "Unknown error occurred";
        let errorStack = "";

        if (error instanceof Error) {
            errorMessage = error.message;
            errorStack = error.stack || "";
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else {
            errorMessage = JSON.stringify(error);
        }

        console.error("Error Details:", errorMessage);
        if (errorStack) console.error("Stack:", errorStack);

        return new Response(
            JSON.stringify({
                success: false,
                error: errorMessage,
                stack: errorStack, // Include stack for debugging (remove in production if sensitive)
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
