import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// STANDARD FIELD MAPPINGS
// Maps extracted data field names (Spanish snake_case) to common PDF field patterns
// ============================================================================
const STANDARD_MAPPINGS: Record<string, string[]> = {
    // Registrant Information
    "nombres": ["names", "given_names", "reg_names", "first_names", "nombre"],
    "primer_apellido": ["surnames", "first_surname", "reg_1_surname", "apellido1", "surname1"],
    "segundo_apellido": ["surnames", "second_surname", "reg_2_surname", "apellido2", "surname2"],
    // IMPORTANT: Only nuip_top maps to the nuip PDF field to ensure alphanumeric NUIP is used
    // nuip and nuip_bottom are NOT mapped to avoid overwriting the alphanumeric value
    "nuip_top": ["nuip", "id_basic_part", "id_add_part"],
    "serial_indicator": ["serial_indicator", "serial", "indicativo"],
    "sexo": ["sex", "sexo", "gender"],
    "grupo_sanguineo": ["blood_type", "blood", "sangre", "tipo_sangre"],
    "factor_rh": ["rh_factor", "rh", "factor"],

    // Birth Details
    "fecha_nacimiento": ["date_of_birth", "birth_date", "birth_year", "birth_month", "birth_day", "day", "month", "year", "Text Field1"],
    "hora_nacimiento": ["time", "birth_time", "hora", "hour"],
    "pais_nacimiento": ["country_birth", "country", "pais", "birth_country_dept_munic"],
    "departamento_nacimiento": ["dept_birth", "department", "dept", "departamento", "birth_country_dept_munic"],
    "municipio_nacimiento": ["muni_birth", "municipality", "muni", "municipio", "birth_country_dept_munic"],
    "lugar_nacimiento": ["township_birth", "birth_place", "place", "lugar"],

    // Father Information
    "padre_nombres": ["father_names", "father_surnames_names", "father_surname"],
    "padre_apellidos": ["father_surnames", "father_surnames_names", "father_surname"],
    "padre_identificacion": ["father_doc_number", "father_id_doc", "father_id"],
    "padre_tipo_documento": ["father_id_type", "father_doc_type", "father_type_id"],
    "padre_nacionalidad": ["father_nationality", "father_nation"],

    // Mother Information
    "madre_nombres": ["mother_names", "mother_surnames_names"],
    "madre_apellidos": ["mother_surnames", "mother_surnames_names"],
    "madre_identificacion": ["mother_doc_number", "mother_id_doc", "mother_id_number"],
    "madre_tipo_documento": ["mother_id_type", "mother_doc_type", "mother_type_id"],
    "madre_nacionalidad": ["mother_nationality", "nationality_mother"],

    // Declarant Information
    "declarante_nombres": ["declarant_surnames_names", "declarant_name", "declarant_address"],
    "declarante_identificacion": ["declarant_id_doc", "declarant_id"],

    // Witness Information
    "testigo1_nombres": ["witness1_surnames_names", "witness_residence", "witness1_name"],
    "testigo1_identificacion": ["witness1_id_doc", "witness_id", "witness1_id"],
    "testigo2_nombres": ["witness2_surnames_names", "witness2_residence", "witness2_name"],
    "testigo2_identificacion": ["witness2_id_doc", "witness2_id"],

    // Registry Office Information
    "oficina": ["office_type", "notary_number", "office", "notaria"],
    "numero_oficina": ["notary_number", "office_number"],
    "departamento_registro": ["dept_office", "country_dept_munic", "reg_dept"],
    "municipio_registro": ["muni_office", "country_dept_munic", "reg_muni"],
    "fecha_registro": ["date_registration", "date_registered", "reg_year", "reg_month", "reg_day"],

    // Document Identifiers
    "codigo": ["reg_code", "code", "qr_code", "codigo"],
    "acta": ["birth_cert_number", "cert_number", "acta"],
    "numero_acta": ["birth_cert_number", "cert_number"],
    "tomo": ["tomo", "volume"],
    "folio": ["folio", "page"],
    "libro": ["libro", "book"],

    // Notes and Officials
    "notas": ["notes1", "notes2", "notes3", "notes4", "notes5", "notes6", "notes7", "notes"],
    "margin_notes": ["notes1", "notes2", "notes3", "notes4", "notes5", "notes6", "notes7"],
    "authorizing_official": ["official_name&signature", "official_name", "funcionario"],
    "acknowledgment_official": ["ack_official_name&signature", "ack_official"],
    "funcionario_nombre": ["official_name&signature", "name_director", "funcionario"],

    // Prior Document
    "tipo_documento_anterior": ["prior_doc", "prior_document", "documento_anterior"]
};

// ============================================================================
// INTELLIGENT FIELD MAPPING FUNCTION
// ============================================================================
function createMappingsFromPDFFields(pdfFieldNames: string[]): Record<string, string[]> {
    const mappings: Record<string, string[]> = {};
    const normalizedPdfFields = pdfFieldNames.map(f => ({
        original: f,
        normalized: f.toLowerCase().replace(/[^a-z0-9]/g, '')
    }));

    for (const [extractedField, possiblePatterns] of Object.entries(STANDARD_MAPPINGS)) {
        const matchingFields: string[] = [];

        for (const pattern of possiblePatterns) {
            const normalizedPattern = pattern.toLowerCase().replace(/[^a-z0-9]/g, '');

            // Find PDF fields that match this pattern
            for (const pdfField of normalizedPdfFields) {
                // Exact match (case-insensitive)
                if (pdfField.normalized === normalizedPattern) {
                    if (!matchingFields.includes(pdfField.original)) {
                        matchingFields.push(pdfField.original);
                    }
                }
                // Partial match (pattern contained in field name)
                else if (pdfField.normalized.includes(normalizedPattern) ||
                    normalizedPattern.includes(pdfField.normalized)) {
                    if (!matchingFields.includes(pdfField.original) && pdfField.normalized.length > 2) {
                        matchingFields.push(pdfField.original);
                    }
                }
            }
        }

        if (matchingFields.length > 0) {
            mappings[extractedField] = matchingFields;
        }
    }

    return mappings;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { templateUrl, templateName, categoryId, openaiApiKey } = await req.json();

        // Override env var if key passed from frontend (Vercel env)
        if (openaiApiKey) Deno.env.set("OPENAI_API_KEY", openaiApiKey);

        if (!templateUrl || !templateName) {
            throw new Error("templateUrl and templateName are required");
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`ANALYZING TEMPLATE: ${templateName}`);
        console.log('='.repeat(60));

        // ====================================================================
        // STEP 1: Download the template PDF
        // ====================================================================
        console.log("\n[1/5] Downloading template PDF...");
        const pdfResponse = await fetch(templateUrl);
        if (!pdfResponse.ok) {
            throw new Error("Failed to download template PDF");
        }
        const pdfBuffer = await pdfResponse.arrayBuffer();
        console.log(`   ✓ Downloaded: ${pdfBuffer.byteLength} bytes`);

        // ====================================================================
        // STEP 2: Extract ALL PDF Form Fields (Primary Source)
        // ====================================================================
        console.log("\n[2/5] Extracting PDF form fields...");
        let pdfFieldNames: string[] = [];
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const form = pdfDoc.getForm();
            const fields = form.getFields();
            pdfFieldNames = fields.map(f => f.getName());
            console.log(`   ✓ Found ${pdfFieldNames.length} PDF form fields`);
            if (pdfFieldNames.length > 0) {
                console.log(`   Fields: ${pdfFieldNames.slice(0, 10).join(', ')}${pdfFieldNames.length > 10 ? '...' : ''}`);
            }
        } catch (e) {
            console.warn("   ⚠ No PDF form fields found (may be scanned document)");
        }

        // ====================================================================
        // STEP 3: Extract text from PDF using PDF.co
        // ====================================================================
        console.log("\n[3/5] Extracting text with OCR...");
        const pdfCoKey = Deno.env.get("PDF_CO_API_KEY");
        if (!pdfCoKey) {
            throw new Error("PDF_CO_API_KEY not set");
        }

        const extractResponse = await fetch("https://api.pdf.co/v1/pdf/convert/to/text", {
            method: 'POST',
            headers: { "x-api-key": pdfCoKey, "Content-Type": "application/json" },
            body: JSON.stringify({
                url: templateUrl,
                async: false,
                ocrMode: "Auto",
                lang: "spa",
                inline: true
            })
        });

        const extractData = await extractResponse.json();
        if (extractData.error) throw new Error(`PDF.co error: ${extractData.message}`);

        const templateText = extractData.body || "";
        console.log(`   ✓ Extracted ${templateText.length} characters of text`);

        // ====================================================================
        // STEP 4: Generate PDF Mappings (Rule-based + AI Enhanced)
        // ====================================================================
        console.log("\n[4/5] Generating field mappings...");

        // First, apply rule-based mappings
        let pdfMappings = createMappingsFromPDFFields(pdfFieldNames);
        console.log(`   ✓ Rule-based mappings: ${Object.keys(pdfMappings).length} fields`);

        // Then, enhance with AI for any PDF fields not yet mapped
        const openaiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openaiKey) {
            throw new Error("OPENAI_API_KEY not set");
        }

        // Identify unmapped PDF fields
        const mappedPdfFields = new Set(Object.values(pdfMappings).flat());
        const unmappedPdfFields = pdfFieldNames.filter(f => !mappedPdfFields.has(f));

        if (unmappedPdfFields.length > 0 || Object.keys(pdfMappings).length < 20) {
            console.log(`   → Enhancing with AI (${unmappedPdfFields.length} unmapped fields)...`);

            const mappingPrompt = `You are an expert at mapping Colombian civil registry document fields.

PDF FORM FIELDS IN THIS TEMPLATE:
${JSON.stringify(pdfFieldNames, null, 2)}

EXTRACTED DATA FIELD NAMES (from OCR/AI extraction):
These are the Spanish snake_case field names we extract from documents:
- nombres, primer_apellido, segundo_apellido (registrant name parts)
- nuip, nuip_top, nuip_bottom, serial_indicator
- sexo, grupo_sanguineo, factor_rh (personal data)
- fecha_nacimiento, hora_nacimiento, pais_nacimiento, departamento_nacimiento, municipio_nacimiento, lugar_nacimiento
- padre_nombres, padre_apellidos, padre_identificacion, padre_nacionalidad
- madre_nombres, madre_apellidos, madre_identificacion, madre_nacionalidad
- declarante_nombres, declarante_identificacion
- testigo1_nombres, testigo1_identificacion, testigo2_nombres, testigo2_identificacion
- oficina, numero_oficina, departamento_registro, municipio_registro, fecha_registro
- codigo, acta, numero_acta, tomo, folio, libro
- notas, margin_notes, authorizing_official, acknowledgment_official, funcionario_nombre
- tipo_documento_anterior

Create a JSON mapping where:
- Each KEY is an extracted data field name (Spanish snake_case)
- Each VALUE is an array of PDF field names that should receive that data

Map by MEANING. For example:
- "father_surnames_names" in PDF → padre_nombres AND padre_apellidos
- "birth_year", "birth_month", "birth_day" in PDF → fecha_nacimiento

Return ONLY the JSON object with ALL applicable mappings.`;

            try {
                const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${openaiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: "gpt-4o",
                        messages: [
                            { role: "system", content: "You are an expert at data mapping for Colombian documents. Return only valid JSON." },
                            { role: "user", content: mappingPrompt }
                        ],
                        temperature: 0.1,
                        response_format: { type: "json_object" }
                    }),
                });

                if (aiResponse.ok) {
                    const aiData = await aiResponse.json();
                    const aiMappings = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");

                    // Merge AI mappings (only add new ones or validate existing)
                    for (const [key, value] of Object.entries(aiMappings)) {
                        if (!pdfMappings[key] || (pdfMappings[key] as string[]).length === 0) {
                            // Validate that the PDF fields actually exist
                            const validFields = (Array.isArray(value) ? value : [value]).filter((v: string) =>
                                pdfFieldNames.some(pf => pf.toLowerCase() === v.toLowerCase())
                            );
                            if (validFields.length > 0) {
                                pdfMappings[key] = validFields.map((vf: string) =>
                                    pdfFieldNames.find(pf => pf.toLowerCase() === vf.toLowerCase()) || vf
                                );
                            }
                        }
                    }
                    console.log(`   ✓ AI-enhanced mappings: ${Object.keys(pdfMappings).length} fields`);
                }
            } catch (aiError) {
                console.warn(`   ⚠ AI enhancement failed: ${aiError}`);
            }
        }

        // ====================================================================
        // STEP 5: Analyze document type and generate metadata with AI
        // ====================================================================
        console.log("\n[5/6] Analyzing document type and metadata...");

        const analysisPrompt = `Analyze this Colombian civil document template.

TEMPLATE TEXT (first 8000 chars):
${templateText.substring(0, 8000)}

PDF FORM FIELDS:
${JSON.stringify(pdfFieldNames, null, 2)}

Return a JSON object with:
1. "documentType": One of: "birth_certificate", "death_certificate", "marriage_certificate", "passport", "dian", "other"
2. "keywords": Array of 15-25 distinctive keywords from the template
3. "formatIndicators": { "version": "old"|"new"|"medium", "specificMarkers": [], "description": "..." }
4. "semanticDescription": 2-3 sentence description of this template`;

        let documentType = "birth_certificate";
        let keywords: string[] = [];
        let formatIndicators = { version: "unknown", specificMarkers: [], description: "" };
        let semanticDescription = "";

        try {
            const metaResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${openaiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: "You are an expert at analyzing Colombian civil registry documents. Return only valid JSON." },
                        { role: "user", content: analysisPrompt }
                    ],
                    temperature: 0.1,
                    response_format: { type: "json_object" }
                }),
            });

            if (metaResponse.ok) {
                const metaData = await metaResponse.json();
                const analysis = JSON.parse(metaData.choices?.[0]?.message?.content || "{}");
                documentType = analysis.documentType || documentType;
                keywords = analysis.keywords || [];
                formatIndicators = analysis.formatIndicators || formatIndicators;
                semanticDescription = analysis.semanticDescription || "";
            }
        } catch (e) {
            console.warn(`   ⚠ Metadata analysis failed: ${e}`);
        }

        console.log(`   ✓ Document Type: ${documentType}`);
        console.log(`   ✓ Keywords: ${keywords.length}`);
        console.log(`   ✓ Format: ${formatIndicators.version}`);

        // ====================================================================
        // STEP 6: Generate Template-Specific Extraction Instructions
        // ====================================================================
        console.log("\n[6/6] Generating extraction instructions...");

        const extractionPrompt = `You are an expert at extracting data from Colombian civil registry documents.

TEMPLATE NAME: ${templateName}
DOCUMENT TYPE: ${documentType}
FORMAT VERSION: ${formatIndicators.version}

PDF FORM FIELDS IN THIS TEMPLATE:
${JSON.stringify(pdfFieldNames, null, 2)}

TEMPLATE TEXT (layout reference):
${templateText.substring(0, 6000)}


Generate SPECIFIC extraction instructions for each field.

EXPERT EXTRACTION TIPS - APPLY THESE TO YOUR INSTRUCTIONS:
1. NUIP/Serial: "Medio" format often has 'V2A' prefix (e.g., V2A000123). Instructions MUST say "Extract FULL alphanumeric code including V2A".
2. Surnames: "Medio" format often separates 'Primer' and 'Segundo' apellido. Instructions MUST say "Look for SEPARATE box for this specific surname".
3. Birth Place: "Medio" format has a long field with "Clinica/Hospital (Country.Dept.City)". Instructions MUST say "Extract COMPLETE string including clinic name and parentheses".
4. Authorizing Official: Signatures often have 3-4 names (2 names + 2 surnames). Instructions MUST say "Extract ALL names found near signature".
5. Registry Location: Often formatted as "Country - Dept - City". Instructions MUST say "Extract full location line".

FIELDS TO DOCUMENT:
- nuip: Unique ID (e.g., V2A...) - extract exact alphanumeric
- nuip_top: NUIP from header
- primer_apellido: First surname ONLY
- segundo_apellido: Second surname ONLY (adjacent box)
- nombres: Given names
- lugar_nacimiento: FULL birth place line (Clinic + City)
- birth_location_combined: (Same as lugar_nacimiento)
- pais_nacimiento: Country
- departamento_nacimiento: Department
- municipio_nacimiento: Municipality
- registry_location_combined: Full registry location line
- authorizing_official: Full name of official near signature
- acknowledgment_official: Official near recognition signature
- funcionario_nombre: Official name
- padre_nombres: Father's given names
- padre_apellidos: Father's surnames (or full name if single field)
- padre_identificacion: Father's ID
- madre_nombres: Mother's given names
- madre_apellidos: Mother's surnames (or full name if single field)
- madre_identificacion: Mother's ID
- fecha_nacimiento: Date of birth (Day Month Year)
- fecha_registro: Registration date
- serial_indicator: Serial number
- codigo: Document code

Return a JSON object where each key is a field name and each value is the extraction instruction for THIS template.
Example format:
{
  "nuip": "Look in box labeled 'NUIP' near top-left. Format is LETTERS+NUMBERS (e.g., V2A0001156). Include ALL characters.",
  "segundo_apellido": "Adjacent box to the right of 'Primer Apellido', labeled 'Segundo Apellido'. Never leave empty if text visible."
}`;

        let extractionInstructions: Record<string, string> = {};

        try {
            const instructionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${openaiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: "You are an expert at document data extraction. Generate precise, template-specific extraction instructions. Return only valid JSON."
                        },
                        { role: "user", content: extractionPrompt }
                    ],
                    temperature: 0.2,
                    response_format: { type: "json_object" }
                }),
            });

            if (instructionResponse.ok) {
                const instructionData = await instructionResponse.json();
                extractionInstructions = JSON.parse(instructionData.choices?.[0]?.message?.content || "{}");
                console.log(`   ✓ Generated ${Object.keys(extractionInstructions).length} extraction instructions`);

                // Log each instruction for verification
                console.log("\n   === GENERATED EXTRACTION INSTRUCTIONS ===");
                for (const [field, instruction] of Object.entries(extractionInstructions)) {
                    console.log(`   [${field}]: ${(instruction as string).substring(0, 100)}...`);
                }
                console.log("   ==========================================\n");
            } else {
                console.error(`   ✗ Instruction generation failed: ${instructionResponse.status}`);
            }
        } catch (e) {
            console.warn(`   ⚠ Extraction instruction generation failed: ${e}`);
        }


        // ====================================================================
        // Generate field_definitions from mappings
        // ====================================================================
        const fieldDefinitions = Object.keys(pdfMappings).map(fieldName => ({
            name: fieldName,
            description: `Extracted field: ${fieldName}`,
            type: "text"
        }));

        // ====================================================================
        // Save template to database
        // ====================================================================
        console.log("\n[SAVING] Writing to database...");

        const { data: template, error: insertError } = await supabase
            .from('document_templates')
            .insert({
                category_id: categoryId,
                name: templateName,
                template_file_url: templateUrl,
                field_definitions: fieldDefinitions,
                full_template_text: templateText,
                content_profile: {
                    documentType,
                    keywords,
                    formatIndicators,
                    semanticDescription,
                    extraction_instructions: extractionInstructions,  // Template-specific prompts
                    pdf_mappings: pdfMappings,
                    pdfFields: pdfFieldNames,
                    pdfFieldCount: pdfFieldNames.length,
                    mappingCount: Object.keys(pdfMappings).length,
                    extractionInstructionCount: Object.keys(extractionInstructions).length
                }
            })
            .select()
            .single();

        if (insertError) {
            throw new Error(`Failed to save: ${insertError.message}`);
        }

        // ====================================================================
        // Summary
        // ====================================================================
        console.log(`\n${'='.repeat(60)}`);
        console.log(`✓ TEMPLATE SAVED SUCCESSFULLY`);
        console.log('='.repeat(60));
        console.log(`   ID: ${template.id}`);
        console.log(`   Name: ${templateName}`);
        console.log(`   PDF Fields: ${pdfFieldNames.length}`);
        console.log(`   Field Mappings: ${Object.keys(pdfMappings).length}`);
        console.log(`   Extraction Instructions: ${Object.keys(extractionInstructions).length}`);
        console.log(`   Document Type: ${documentType}`);
        console.log('='.repeat(60) + '\n');


        return new Response(JSON.stringify({
            success: true,
            template,
            analysis: {
                documentType,
                pdfFieldCount: pdfFieldNames.length,
                mappingsCount: Object.keys(pdfMappings).length,
                keywordCount: keywords.length,
                formatVersion: formatIndicators.version
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error("\n❌ ANALYSIS ERROR:", error.message);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
