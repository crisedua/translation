interface ExtractedData {
    [key: string]: any;
}

/**
 * DEFAULT EXTRACTION INSTRUCTIONS
 * Used when template doesn't have specific instructions for a field
 */
const DEFAULT_EXTRACTION_INSTRUCTIONS: Record<string, string> = {
    // NUIP - Critical to get complete value
    "nuip": "Extract COMPLETE value including ANY leading letters (e.g., 'V2A0001156' NOT '0001156')",
    "nuip_top": "Extract COMPLETE NUIP from top-left box including leading letters",

    // Names - Must be separate
    "primer_apellido": "Extract FIRST surname ONLY (e.g., 'QUEVEDO'). This is SEPARATE from segundo_apellido",
    "segundo_apellido": "Extract SECOND surname ONLY (e.g., 'HERRERA'). This is SEPARATE from primer_apellido",
    "nombres": "Extract given names of the registrant (the person being registered)",

    // Location - Must include full details
    "lugar_nacimiento": "Extract FULL place of birth INCLUDING clinic/hospital name AND city (e.g., 'CLINICA MATERNO INFANTIL FARALLONES (COLOMBIA.VALLE.CALI)')",
    "birth_location_combined": "Extract COMPLETE birth location with clinic name, country, department, and municipality",

    // Officials - Must be complete names
    "authorizing_official": "Extract COMPLETE full name of the official (ALL surnames and first names). Look near 'Nombre y firma del funcionario'",
    "acknowledgment_official": "ONLY extract if 'Reconocimiento Paterno' section is filled. Otherwise return empty string",
    "funcionario_nombre": "Extract COMPLETE official name with all parts",

    // Parents - Separate fields
    "padre_nombres": "Father's given names only",
    "padre_apellidos": "Father's surnames (both first and second)",
    "padre_tipo_documento": "Father's ID document type (e.g., 'CEDULA DE CIUDADANIA', 'C.C.')",
    "padre_identificacion": "Father's ID number",
    "madre_nombres": "Mother's given names only",
    "madre_apellidos": "Mother's surnames (both first and second)",
    "madre_tipo_documento": "Mother's ID document type (e.g., 'CEDULA DE CIUDADANIA', 'C.C.')",
    "madre_identificacion": "Mother's ID number",

    // Dates - Keep as-is
    "fecha_nacimiento": "Extract date EXACTLY as written (e.g., '19-08-2000'). Do NOT split into parts",
    "fecha_registro": "Extract registration date EXACTLY as written",

    // Notes - Full text
    "margin_notes": "Extract ALL text from 'ESPACIO PARA NOTAS' section including NUIP info, dates, handwritten notes",
    "notas": "Extract all notes and annotations",

    // Other
    "serial_indicator": "Extract complete serial indicator number",
    "codigo": "Extract complete code (may have multiple parts like '97 0 2' - combine them)",
    "tipo_documento": "Document type (e.g., 'REGISTRO CIVIL DE NACIMIENTO', 'CERTIFICADO DE NACIDO VIVO')"
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
    const templateInstructions = template?.content_profile?.extraction_instructions || {};

    // Combine all field sources (unique)
    const allTargetFields = [...new Set([
        ...pdfFields,
        ...mappingKeys,
        ...definedFieldNames
    ])];

    // Fallback field list if template has none defined
    const targetFields = allTargetFields.length > 0 ? allTargetFields : [
        "nuip", "nuip_top", "serial_indicator", "codigo",
        "nombres", "primer_apellido", "segundo_apellido",
        "sexo", "grupo_sanguineo", "factor_rh",
        "fecha_nacimiento", "hora_nacimiento", "lugar_nacimiento",
        "pais_nacimiento", "departamento_nacimiento", "municipio_nacimiento",
        "padre_nombres", "padre_apellidos", "padre_identificacion", "padre_tipo_documento", "padre_nacionalidad",
        "madre_nombres", "madre_apellidos", "madre_identificacion", "madre_tipo_documento", "madre_nacionalidad",
        "authorizing_official", "acknowledgment_official",
        "fecha_registro", "pais_registro", "departamento_registro", "municipio_registro",
        "oficina", "numero_oficina", "margin_notes", "notas", "tipo_documento"
    ];

    const docName = template?.name || 'Colombian Document';
    const docType = template?.content_profile?.documentType?.replace(/_/g, ' ').toUpperCase() || 'CIVIL REGISTRY DOCUMENT';

    // === BUILD FIELD LIST WITH INSTRUCTIONS ===
    // Merge template instructions with defaults (template takes priority)
    const fieldListWithInstructions = targetFields.map(field => {
        const instruction = templateInstructions[field] || DEFAULT_EXTRACTION_INSTRUCTIONS[field];
        return instruction
            ? `- "${field}": ${instruction}`
            : `- "${field}"`;
    }).join('\n');

    // === BUILD FOCUSED PROMPT ===
    const systemPrompt = `You are extracting data from a scanned ${docName} (${docType}).

## YOUR TASK
Extract the following fields from the document. Each field has specific instructions - FOLLOW THEM EXACTLY:

${fieldListWithInstructions}

## CRITICAL RULES

1. **EXTRACT VALUES EXACTLY AS SEEN**
   - Do NOT modify, combine, split, or reformat any values
   - Keep dates exactly as written
   - Keep names exactly as written with ALL parts

2. **DO NOT TRUNCATE**
   - Extract COMPLETE values - full names, full text
   - Official names can be long - extract ALL parts
   - Include leading letters in IDs (e.g., V2A0001156)

3. **EMPTY FIELDS**
   - If a field has no visible value (blank, dots, lines) → return ""
   - Do NOT invent or guess values

4. **SECTION IDENTIFICATION**
   - Registrant info (nombres, apellidos): TOP section "Datos del inscrito"
   - Parents info: "Datos del Padre" and "Datos de la Madre" sections
   - Official info: BOTTOM section near signatures
   - Notes: "ESPACIO PARA NOTAS" section at bottom

Return a JSON object with the exact field names listed above.`;

    const userPrompt = fileUrl
        ? `Extract data from this document image following the field instructions exactly.

REMEMBER:
- Extract COMPLETE values including leading letters
- primer_apellido and segundo_apellido are SEPARATE fields
- Include clinic/hospital names in lugar_nacimiento
- Extract COMPLETE official names

Return JSON.`
        : `Extract data from this OCR text following the field instructions exactly:

${text.substring(0, 20000)}

REMEMBER:
- Extract COMPLETE values including leading letters
- primer_apellido and segundo_apellido are SEPARATE fields
- Include clinic/hospital names in lugar_nacimiento
- Extract COMPLETE official names

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
