import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';
import { processExtractedData, getRobustMappings } from './field-processor.ts';

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
        try {
            extractedData = processExtractedData(extractedData);
        } catch (procError) {
            console.error("Error processing extracted data:", procError);
            throw new Error(`Failed to process extracted data: ${(procError as Error).message}`);
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

        // --- NEW: Use robust mappings based on ACTUAL PDF fields ---
        // This takes precedence over DB mappings and default mappings
        const robustMappings = getRobustMappings(fieldNames);
        console.log("Robust Mappings:", JSON.stringify(robustMappings));

        // Combine DB mappings with robust mappings (robust wins)
        const contentProfile = template.content_profile || {};
        const dbMappings = contentProfile.pdf_mappings || {};

        const fieldMappings: Record<string, string[]> = { ...dbMappings, ...robustMappings };
        console.log("Final Field Mappings:", JSON.stringify(fieldMappings));
        // -----------------------------------------------------------

        let filledCount = 0;

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
                // PDF-lib is case sensitive normally, but let's try direct first
                const field = form.getTextField(fieldName);
                if (field) {
                    // Sanitize the value before setting it
                    const sanitizedValue = sanitizeForPdf(value);
                    field.setText(sanitizedValue);
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
                console.warn(`Failed to set field ${fieldName}:`, (e as Error).message);
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

        // === SPECIAL HANDLING: Ensure place of birth gets filled ===
        // This is a critical field that often fails due to mapping issues
        const placeOfBirthValue = extractedData.birth_location_combined ||
            extractedData['Place of Birth'] ||
            extractedData.lugar_nacimiento ||
            extractedData['Lugar Nacimiento'] ||
            extractedData.birth_place;

        if (placeOfBirthValue) {
            console.log(`[SPECIAL] Trying to fill Place of Birth with: ${placeOfBirthValue}`);

            // Try every PDF field name directly
            for (const pdfField of fieldNames) {
                const fieldLower = pdfField.toLowerCase();
                // Check if this field is related to birth place
                if (fieldLower.includes('place') ||
                    fieldLower.includes('birth') ||
                    fieldLower.includes('country') ||
                    fieldLower.includes('nacimiento') ||
                    fieldLower.includes('lugar')) {

                    // Exclude fields that are for registry location, not birth location
                    if (fieldLower.includes('registro') || fieldLower.includes('registry')) continue;

                    console.log(`[SPECIAL] Attempting field: ${pdfField}`);
                    if (setField(pdfField, String(placeOfBirthValue))) {
                        console.log(`[SPECIAL] SUCCESS: Filled "${pdfField}" with place of birth`);
                        filledCount++;
                        break; // Stop after first successful fill
                    }
                }
            }
        }
        // === END SPECIAL HANDLING ===

        for (const [key, value] of Object.entries(extractedData)) {
            if (value === null || value === undefined || value === '') continue;

            const strValue = String(value);
            const normalizedKey = normalizeKey(key);
            let filled = false;

            // 1. Try exact match (Canonical Key -> PDF Field Name)
            // Sometimes the extracted key IS the pdf field name
            if (setField(key, strValue)) {
                filled = true;
                filledCount++;
            }

            // 2. Try DB-configured mappings (with normalized key)
            if (normalizedMappings[normalizedKey]) {
                const targets = normalizedMappings[normalizedKey];

                // SPECIAL HANDLING: For "notes" fields, distribute text across fields instead of repeating
                // This prevents the same note from appearing 5 times in the list
                const isNoteField = key.toLowerCase().includes('note') || key.toLowerCase().includes('nota');

                if (isNoteField && targets.length > 1) {
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
                    "Place of Birth": ["birth_country_dept_munic"],
                    "Country - Department - Municipality - Township and/or Police Station": ["country_dept_munic"],
                    "lugar_nacimiento": ["birth_country_dept_munic"],

                    // Parents - using exact AI field names  
                    "Father's Surnames and Full Names": ["father_surnames_names"],
                    "Mother's Surnames and Full Names": ["mother_surnames_names"],
                    "Father's Identification Document": ["father_id_doc"],
                    "Mother's Identification Document": ["mother_id_doc"],
                    "Father's Nationality": ["father_nationality"],
                    "Mother's Nationality": ["mother_nationality"],
                    "madre_nombres": ["mother_surnames_names"],
                    "padre_nombres": ["father_surnames_names"],

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

                    // Signature / Officials
                    "Signature": ["signature"],
                    "authorizing_official": ["Name and Signature of Authorizing Official", "auth_official", "funcionario_autoriza"],
                    "acknowledgment_official": ["Name and Signature of Official before whom the Acknowledgment is Made", "ack_official", "funcionario_reconocimiento"],
                    "funcionario_nombre": ["Name and Signature of Authorizing Official", "auth_official"]
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
                    // Try standard names
                    setField('day', day);
                    setField('month', month);
                    setField('year', year);

                    // Try birth_ prefixed
                    setField('birth_day', day);
                    setField('birth_month', month);
                    setField('birth_year', year);

                    // Try reg_ prefixed
                    setField('reg_day', day);
                    setField('reg_month', month);
                    setField('reg_year', year);
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
        const { error: updateError } = await supabase
            .from('document_requests')
            .update({
                generated_document_url: generatedUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (updateError) throw new Error(`Failed to update request: ${updateError.message}`);

        return new Response(
            JSON.stringify({
                success: true,
                requestId: requestId,
                generatedUrl: generatedUrl,
                filledFields: filledCount
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
