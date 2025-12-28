interface ExtractedData {
    [key: string]: any;
}

/**
 * DEFAULT EXTRACTION INSTRUCTIONS
 * Used when template doesn't have specific instructions for a field
 */
const DEFAULT_EXTRACTION_INSTRUCTIONS: Record<string, string> = {
    // NUIP - CRITICAL: Must include leading letters
    "nuip": "CRITICAL: Extract the COMPLETE NUIP from the box labeled 'NUIP'. It MUST include any leading LETTERS like 'V2A' (e.g., 'V2A0001156' NOT '0001156'). The format is typically LETTERS+NUMBERS.",
    "nuip_top": "Extract COMPLETE NUIP from top-left box. MUST include leading letters (e.g., 'V2A0001156')",

    // Names - CRITICAL: Read from separate labeled boxes
    "primer_apellido": "Extract FIRST surname from box labeled 'Primer Apellido'. Example: 'QUEVEDO'. This is in a SEPARATE box from segundo_apellido.",
    "segundo_apellido": "CRITICAL: Extract SECOND surname from box labeled 'Segundo Apellido'. Example: 'HERRERA'. This is in a SEPARATE box NEXT TO primer_apellido. DO NOT leave empty if there is text in this box!",
    "nombres": "Extract given names from box labeled 'Nombre(s)' or 'Given Names'. Example: 'KATERINE'",

    // Location - CRITICAL: Must include ALL parts including clinic/hospital
    "lugar_nacimiento": "CRITICAL: Extract the FULL place of birth INCLUDING the clinic/hospital name AND full location. Example: 'CLINICA MATERNO INFANTIL FARALLONES (COLOMBIA.VALLE.CALI)'. Do NOT truncate - include ALL text.",
    "birth_location_combined": "CRITICAL: Extract COMPLETE birth location with clinic/hospital name, country, department, and municipality. Example: 'CLINICA MATERNO INFANTIL FARALLONES (COLOMBIA.VALLE.CALI)'. Must include ALL parts.",
    "pais_nacimiento": "Country of birth only (e.g., 'COLOMBIA')",
    "departamento_nacimiento": "Department of birth only (e.g., 'VALLE')",
    "municipio_nacimiento": "Municipality of birth only (e.g., 'CALI')",

    // Registry location - Extract full location
    "registry_location_combined": "Extract COMPLETE registry location: country, department, municipality (e.g., 'COLOMBIA.VALLE.CALI')",
    "pais_registro": "Country where registered (usually 'COLOMBIA')",
    "departamento_registro": "Department where registered (e.g., 'VALLE')",
    "municipio_registro": "Municipality where registered (e.g., 'CALI')",

    // Officials - CRITICAL: Must be COMPLETE names with ALL parts
    "authorizing_official": "CRITICAL: Extract the COMPLETE FULL NAME of the authorizing official near 'Nombre y firma del funcionario que autoriza'. Include ALL name parts - do NOT truncate! Example: 'HOLMES RACEL CAROLINA MONTOYA'",
    "acknowledgment_official": "ONLY extract if 'Reconocimiento Paterno' section has a signature and name. If section is empty, return empty string.",
    "funcionario_nombre": "CRITICAL: Extract COMPLETE official name with ALL parts. Do NOT truncate - officials have 3-4+ name parts.",

    // Parents - Separate fields
    "padre_nombres": "Father's given names only (e.g., 'HARVEY ABAD')",
    "padre_apellidos": "Father's surnames - both first and second (e.g., 'QUEVEDO MEDINA')",
    "padre_tipo_documento": "Father's ID document type (e.g., 'C.C.', 'CEDULA DE CIUDADANIA')",
    "padre_identificacion": "Father's ID number with location (e.g., '10481.354 DE SANTANDER DE QUILICHAO')",
    "madre_nombres": "Mother's given names only (e.g., 'ALBA YOLANDA')",
    "madre_apellidos": "Mother's surnames - both first and second (e.g., 'HERRERA HERRERA')",
    "madre_tipo_documento": "Mother's ID document type (e.g., 'C.C.', 'CEDULA DE CIUDADANIA')",
    "madre_identificacion": "Mother's ID number with location (e.g., '31928.038 DE CALI (VALLE)')",

    // Dates - Keep as-is
    "fecha_nacimiento": "Extract date EXACTLY as written (e.g., '19-08-2000'). Do NOT split into parts",
    "fecha_registro": "Extract registration date EXACTLY as written",

    // Notes - Full text from ESPACIO PARA NOTAS
    "margin_notes": "Extract ALL text from 'ESPACIO PARA NOTAS' section at bottom. Include NUIP info, dates, handwritten notes.",
    "notas": "Extract all notes and annotations",
    "notes_combined": "Extract ALL notes from 'ESPACIO PARA NOTAS' section",

    // Other identifiers
    "serial_indicator": "Extract complete 'Indicativo Serial' number (e.g., '29734419')",
    "codigo": "Extract complete code - may have parts like '97 0 2' (combine to '9702')",
    "tipo_documento": "Document type from 'Tipo de documento antecedente' (e.g., 'CERTIFICADO DE NACIDO VIVO')",
    "tipo_documento_anterior": "Prior document type (e.g., 'CERTIFICADO DE NACIDO VIVO')"
};

/**
 * TEMPLATE-DRIVEN EXTRACTION
 * 
 * Uses template's PDF fields AND extraction_instructions to guide extraction.
 * Each field can have custom extraction instructions stored in the template.
 */
export const extractData = async (text: string, template: any, fileUrl?: string): Promise<ExtractedData> => {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    // === BUILD FIELD LIST FROM TEMPLATE ===
    const pdfFields: string[] = template?.content_profile?.pdfFields || [];
    const pdfMappings = template?.content_profile?.pdf_mappings || {};
    const mappingKeys = Object.keys(pdfMappings);
    const fieldDefinitions = template?.field_definitions || [];
    const definedFieldNames = fieldDefinitions.map((f: any) => f.name);

    // Get template-specific extraction instructions (if any)
    let templateInstructions = template?.content_profile?.extraction_instructions || {};

    // === FORCE OVERRIDE FOR REGISTRO NACIMIENTO MEDIO ===
    // If we detect the SPECIFIC "Registro Nacimiento Medio" template, apply these overrides
    if (template.name && (
        template.name.toLowerCase().includes('registro') &&
        template.name.toLowerCase().includes('nacimiento') &&
        template.name.toLowerCase().includes('medio')
    )) {
        console.log("[AI-EXTRACTOR] Applying FORCED overrides for Registro Nacimiento Medio");
        const medioOverrides: Record<string, string> = {
            "madre_apellidos": "LOCATED in the row ABOVE 'Nombres'. Look for TWO separate boxes labeled 'Primer Apellido' and 'Segundo Apellido'. Extract the text from BOTH boxes (e.g., 'HERRERA HERRERA'). Do NOT extract the names.",
            "padre_apellidos": "LOCATED in the row ABOVE 'Nombres' for the father. Look for TWO separate boxes. Extract text from BOTH (e.g., 'QUEVEDO MEDINA').",
            "lugar_nacimiento": "LOCATED in the row starting with 'Fecha de nacimiento'. Look for the wide box labeled 'Lugar de nacimiento'. Extract the ENTIRE text including clinic name and parentheses (e.g., 'CLINICA ... (COLOMBIA...)').",
            "nuip": "Located in the top right or within the header. EXTRACT THE FULL ALPHANUMERIC STRING including any letters like 'V2A'. Example: 'V2A2692167'.",
            "serial_indicator": "Often found near the NUIP or barcode. Extract just the number."
        };
        // Merge overrides into template instructions (overwriting DB values if present)
        templateInstructions = { ...templateInstructions, ...medioOverrides };
    }
    // === END OVERRIDE ===

    // === FORCE OVERRIDE FOR REGISTRO NACIMIENTO NUEVO ===
    // If we detect the SPECIFIC "Registro Nacimiento Nuevo" template, apply these overrides
    if (template.name && (
        template.name.toLowerCase().includes('registro') &&
        template.name.toLowerCase().includes('nacimiento') &&
        template.name.toLowerCase().includes('nuevo')
    )) {
        console.log("[AI-EXTRACTOR] Applying FORCED overrides for Registro Nacimiento Nuevo");
        const nuevoOverrides: Record<string, string> = {
            "fecha_expedicion": "CRITICAL: This is the 'Fecha de expedición' (Date of Issue) located at the BOTTOM/FOOTER of the document in a DARK BLUE BOX. It has THREE separate fields: 'Día' (Day), 'Mes' (Month), 'Año' (Year). Extract ONLY from this footer section, NOT from birth date or registration date boxes! Example: Day=12, Month=04, Year=2024 -> '12-04-2024'. DO NOT use '2017' or any date from the middle of the document!",
            "issue_day": "Extract from the 'Día' (Day) box in the BLUE footer 'Fecha de expedición' section at the BOTTOM of the page.",
            "issue_month": "Extract from the 'Mes' (Month) box in the BLUE footer 'Fecha de expedición' section at the BOTTOM of the page.",
            "issue_year": "Extract from the 'Año' (Year) box in the BLUE footer 'Fecha de expedición' section at the BOTTOM of the page."
        };
        // Merge overrides into template instructions (overwriting DB values if present)
        templateInstructions = { ...templateInstructions, ...nuevoOverrides };
    }
    // === END OVERRIDE ===


    // Combine all field sources (unique)
    const allTemplateFields = [...new Set([
        ...pdfFields,
        ...mappingKeys,
        ...definedFieldNames
    ])];

    // === CRITICAL FIELDS THAT MUST ALWAYS BE EXTRACTED ===
    // These are ALWAYS added to ensure proper extraction even if template is incomplete
    const CRITICAL_FIELDS = [
        "nuip", "nuip_top", "serial_indicator",
        "nombres", "primer_apellido", "segundo_apellido",
        "padre_nombres", "padre_apellidos",
        "madre_nombres", "madre_apellidos",
        "lugar_nacimiento", "birth_location_combined",
        "authorizing_official", "fecha_nacimiento", "fecha_registro",
        "sexo", "grupo_sanguineo", "factor_rh",
        "pais_nacimiento", "departamento_nacimiento", "municipio_nacimiento"
    ];

    // Merge template fields with critical fields (critical fields always included)
    const targetFields = [...new Set([
        ...CRITICAL_FIELDS,
        ...allTemplateFields
    ])];

    console.log(`[AI-EXTRACTOR] Target fields: ${targetFields.length} (${CRITICAL_FIELDS.length} critical + ${allTemplateFields.length} from template)`);


    const docName = template?.name || 'Colombian Document';
    const docType = template?.content_profile?.documentType?.replace(/_/g, ' ').toUpperCase() || 'CIVIL REGISTRY DOCUMENT';

    // Log template instruction availability
    console.log(`[AI-EXTRACTOR] Template: ${docName}`);
    console.log(`[AI-EXTRACTOR] Template instructions available: ${Object.keys(templateInstructions).length}`);
    if (Object.keys(templateInstructions).length > 0) {
        console.log(`[AI-EXTRACTOR] Template instruction keys: ${Object.keys(templateInstructions).slice(0, 10).join(', ')}...`);
    }

    // === BUILD FIELD LIST WITH INSTRUCTIONS ===
    // Merge template instructions with defaults (template takes priority)
    let templateInstructionCount = 0;
    let defaultInstructionCount = 0;
    const fieldsUsingTemplate: string[] = [];
    const fieldsUsingDefault: string[] = [];

    const fieldListWithInstructions = targetFields.map(field => {
        const templateInstruction = templateInstructions[field];
        const defaultInstruction = DEFAULT_EXTRACTION_INSTRUCTIONS[field];

        if (templateInstruction) {
            templateInstructionCount++;
            fieldsUsingTemplate.push(field);
            return `- "${field}": ${templateInstruction}`;
        } else if (defaultInstruction) {
            defaultInstructionCount++;
            fieldsUsingDefault.push(field);
            return `- "${field}": ${defaultInstruction}`;
        }
        return `- "${field}"`;
    }).join('\n');

    console.log(`[AI-EXTRACTOR] Instruction sources: ${templateInstructionCount} template-specific, ${defaultInstructionCount} defaults`);
    if (fieldsUsingTemplate.length > 0) {
        console.log(`[AI-EXTRACTOR] Fields with TEMPLATE instructions: ${fieldsUsingTemplate.join(', ')}`);
    }

    // Log key field instructions for debugging
    const keyFields = ['nuip', 'segundo_apellido', 'lugar_nacimiento', 'authorizing_official'];
    console.log(`[AI-EXTRACTOR] === KEY FIELD INSTRUCTIONS ===`);
    for (const field of keyFields) {
        const source = templateInstructions[field] ? 'TEMPLATE' : (DEFAULT_EXTRACTION_INSTRUCTIONS[field] ? 'DEFAULT' : 'NONE');
        const instruction = templateInstructions[field] || DEFAULT_EXTRACTION_INSTRUCTIONS[field] || 'No instruction';
        console.log(`[AI-EXTRACTOR] ${field} (${source}): ${instruction.substring(0, 80)}...`);
    }
    console.log(`[AI-EXTRACTOR] ==============================`);




    // === BUILD FOCUSED PROMPT ===
    const systemPrompt = `You are extracting data from a scanned ${docName} (${docType}).

## YOUR TASK
Extract the following fields from the document. Each field has specific instructions - FOLLOW THEM EXACTLY:

${fieldListWithInstructions}

## CRITICAL EXTRACTION RULES - MUST FOLLOW

### 1. NUIP EXTRACTION (MOST CRITICAL)
- The NUIP field MUST include leading LETTERS if present
- Example: "V2A0001156" NOT "0001156" or "20001156"
- Look in the box labeled "NUIP" near the top
- The format is: LETTERS + NUMBERS

### 2. SURNAME EXTRACTION (TWO SEPARATE FIELDS)
- primer_apellido: FIRST surname in LEFT box (e.g., "QUEVEDO")
- segundo_apellido: SECOND surname in RIGHT box (e.g., "HERRERA")
- These are in SEPARATE boxes side by side
- DO NOT leave segundo_apellido empty if text is visible!

### 3. PLACE OF BIRTH (FULL TEXT REQUIRED)
- lugar_nacimiento / birth_location_combined: Extract COMPLETE value
- MUST include clinic/hospital name AND location
- Example: "CLINICA MATERNO INFANTIL FARALLONES (COLOMBIA.VALLE.CALI)"
- Do NOT truncate to just the country!

### 4. OFFICIAL NAMES (COMPLETE - NO TRUNCATION)
- authorizing_official / funcionario_nombre: Extract ALL name parts
- Officials have 3-4+ name parts - extract ALL of them
- Example: "HOLMES RACEL CAROLINA MONTOYA" NOT just "HOLMES"
- Look near "Nombre y firma del funcionario"

### 5. LOCATION FIELDS
- Registry location (Pais-Departamento-Municipio): Include ALL parts
- Example: "COLOMBIA.VALLE.CALI" not just "COLOMBIA"

### 6. EMPTY FIELDS
- Return "" only if the field has NO visible text
- If there IS text, extract it completely

Return a JSON object with the exact field names listed above.`;


    const userPrompt = fileUrl
        ? `Extract data from this document image following the field instructions exactly.

CRITICAL REMINDERS - COMMON ERRORS TO AVOID:
1. NUIP: Must include leading letters (e.g., 'V2A0001156' not '0001156')
2. segundo_apellido: NEVER empty - it's in the box NEXT TO primer_apellido (e.g., 'HERRERA')
3. lugar_nacimiento: Include FULL clinic name + location (e.g., 'CLINICA MATERNO INFANTIL FARALLONES (COLOMBIA.VALLE.CALI)')
4. authorizing_official: Include ALL name parts (e.g., 'HOLMES RACEL CAROLINA MONTOYA' not just 'HOLMES')
5. Registry location: Include country.department.municipality (e.g., 'COLOMBIA.VALLE.CALI')

Return JSON.`
        : `Extract data from this OCR text following the field instructions exactly:

${text.substring(0, 20000)}

CRITICAL REMINDERS - COMMON ERRORS TO AVOID:
1. NUIP: Must include leading letters (e.g., 'V2A0001156' not '0001156')
2. segundo_apellido: NEVER empty - found in 'Segundo Apellido' column (e.g., 'HERRERA')
3. lugar_nacimiento: Include FULL clinic name + location (e.g., 'CLINICA MATERNO INFANTIL FARALLONES (COLOMBIA.VALLE.CALI)')
4. authorizing_official: Include ALL name parts (e.g., 'HOLMES RACEL CAROLINA MONTOYA' not just 'HOLMES')
5. Registry location: Include all parts (e.g., 'COLOMBIA.VALLE.CALI')

Return JSON.`;


    const messages: any[] = [
        { role: "system", content: systemPrompt },
        {
            role: "user",
            content: fileUrl
                ? [
                    { type: "text", text: userPrompt },
                    { type: "image_url", image_url: { url: fileUrl } }
                ]
                : userPrompt
        }
    ];

    try {
        console.log(`[AI-EXTRACTOR] Template: ${docName}`);
        console.log(`[AI-EXTRACTOR] Fields with instructions: ${targetFields.length}`);
        console.log(`[AI-EXTRACTOR] Template-specific instructions: ${Object.keys(templateInstructions).length}`);

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: fileUrl ? "gpt-4o" : "gpt-4o-mini",
                messages: messages,
                temperature: 0.1,
                response_format: { type: "json_object" },
                max_tokens: 8192
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const extractedText = data.choices?.[0]?.message?.content || "{}";

        console.log("[AI-EXTRACTOR] Response length:", extractedText.length);

        let extractedData: ExtractedData;
        try {
            extractedData = JSON.parse(extractedText);

            // Set country defaults if missing
            if (!extractedData.pais_nacimiento || extractedData.pais_nacimiento.trim() === '') {
                extractedData.pais_nacimiento = 'COLOMBIA';
            }
            if (!extractedData.pais_registro || extractedData.pais_registro.trim() === '') {
                extractedData.pais_registro = 'COLOMBIA';
            }

            // Log key extractions
            console.log(`[AI-EXTRACTOR] nuip: ${extractedData.nuip || extractedData.nuip_top || 'NOT FOUND'}`);
            console.log(`[AI-EXTRACTOR] primer_apellido: ${extractedData.primer_apellido || 'NOT FOUND'}`);
            console.log(`[AI-EXTRACTOR] segundo_apellido: ${extractedData.segundo_apellido || 'NOT FOUND'}`);
            console.log(`[AI-EXTRACTOR] lugar_nacimiento: ${(extractedData.lugar_nacimiento || 'NOT FOUND').substring(0, 60)}`);
            console.log(`[AI-EXTRACTOR] authorizing_official: ${(extractedData.authorizing_official || 'NOT FOUND').substring(0, 50)}`);

            // === SAFETY CHECK: Clear obvious hallucinations ===
            const normalize = (str: any) => str ? String(str).toUpperCase().replace(/[^A-Z0-9]/g, '') : '';

            const authOfficial = normalize(extractedData.authorizing_official);
            const ackOfficial = normalize(extractedData.acknowledgment_official);

            // Clear acknowledgment_official if duplicate of authorizing_official
            if (authOfficial && ackOfficial && authOfficial === ackOfficial) {
                console.log(`[SAFETY] Cleared duplicate acknowledgment_official`);
                extractedData.acknowledgment_official = '';
            }

        } catch (parseError) {
            console.error("[AI-EXTRACTOR] Failed to parse response:", extractedText.substring(0, 500));
            throw new Error("Invalid JSON response from OpenAI");
        }

        return extractedData;

    } catch (error) {
        console.error("[AI-EXTRACTOR] Error:", error);
        throw error;
    }
};
