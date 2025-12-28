interface ExtractedData {
    [key: string]: any;
}

/**
 * TEMPLATE-DRIVEN EXTRACTION
 * 
 * This extractor uses the template's PDF field names to guide extraction.
 * It tells the AI exactly which fields to extract, avoiding generic guessing.
 */
export const extractData = async (text: string, template: any, fileUrl?: string): Promise<ExtractedData> => {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    // === BUILD FIELD LIST FROM TEMPLATE ===
    // Priority 1: PDF field names from content_profile
    const pdfFields: string[] = template?.content_profile?.pdfFields || [];

    // Priority 2: PDF mappings keys (Spanish field names)
    const pdfMappings = template?.content_profile?.pdf_mappings || {};
    const mappingKeys = Object.keys(pdfMappings);

    // Priority 3: Field definitions
    const fieldDefinitions = template?.field_definitions || [];
    const definedFieldNames = fieldDefinitions.map((f: any) => f.name);

    // Combine all field sources (unique)
    const allTargetFields = [...new Set([
        ...pdfFields,
        ...mappingKeys,
        ...definedFieldNames
    ])];

    // If no fields defined, use a comprehensive fallback list
    const targetFields = allTargetFields.length > 0 ? allTargetFields : [
        // Core identifiers
        "nuip", "nuip_top", "serial_indicator", "codigo", "acta",
        // Registrant
        "nombres", "primer_apellido", "segundo_apellido",
        // Personal data
        "sexo", "grupo_sanguineo", "factor_rh",
        // Birth date (keep as single values)
        "fecha_nacimiento", "hora_nacimiento",
        // Birth location
        "lugar_nacimiento", "pais_nacimiento", "departamento_nacimiento", "municipio_nacimiento",
        // Parents
        "padre_nombres", "padre_apellidos", "padre_identificacion", "padre_tipo_documento", "padre_nacionalidad",
        "madre_nombres", "madre_apellidos", "madre_identificacion", "madre_tipo_documento", "madre_nacionalidad",
        // Officials
        "authorizing_official", "acknowledgment_official",
        // Registry
        "fecha_registro", "pais_registro", "departamento_registro", "municipio_registro",
        "oficina", "numero_oficina",
        // Notes
        "margin_notes", "notas",
        // Document type
        "tipo_documento"
    ];

    const docName = template?.name || 'Colombian Document';
    const docType = template?.content_profile?.documentType?.replace(/_/g, ' ').toUpperCase() || 'CIVIL REGISTRY DOCUMENT';

    // === BUILD FOCUSED PROMPT ===
    const fieldList = targetFields.map(f => `- "${f}"`).join('\n');

    const systemPrompt = `You are extracting data from a scanned ${docName} (${docType}).

## YOUR TASK
Extract ONLY the following fields from the document:
${fieldList}

## CRITICAL RULES - FOLLOW EXACTLY

1. **EXTRACT VALUES EXACTLY AS SEEN**
   - Do NOT modify, combine, or reformat any values
   - Keep dates exactly as written (e.g., "01-03-2017" stays "01-03-2017")
   - Keep names exactly as written including all parts

2. **DO NOT TRUNCATE**
   - Extract COMPLETE values - full names, full signatures, full text
   - Official names can be long like "MARIA CRISTINA MANZANO LOPEZ" - extract ALL of it
   - Signature text should be complete

3. **EMPTY FIELDS**
   - If a field has no visible value (blank, dots, lines) → return ""
   - Do NOT invent or guess values

4. **FIELD IDENTIFICATION**
   - "nuip" / "nuip_top": Look for NUIP box, usually at top-left
   - "nombres": Given names of the registrant (the person being registered)
   - "primer_apellido" / "segundo_apellido": Surnames of registrant
   - "authorizing_official": Name near "Nombre y firma del funcionario" at BOTTOM
   - "acknowledgment_official": ONLY if there is a "Reconocimiento Paterno" section
   - "margin_notes": Text in "ESPACIO PARA NOTAS" section, usually at bottom

5. **DO NOT CONFUSE SECTIONS**
   - Registrant's name (person being registered) is at TOP in "Datos del inscrito"
   - Official's name is at BOTTOM near signature
   - Parents are in "Datos del Padre" and "Datos de la Madre" sections

Return a JSON object with the exact field names listed above.`;

    const userPrompt = fileUrl
        ? `Extract data from this document image.

IMPORTANT:
- Extract COMPLETE values - do not truncate names or signatures
- Keep values exactly as written - do not combine or reformat
- For empty fields, return ""

Return JSON with the exact field names specified.`
        : `Extract data from this OCR text:

${text.substring(0, 20000)}

IMPORTANT:
- Extract COMPLETE values - do not truncate names or signatures  
- Keep values exactly as written - do not combine or reformat
- For empty fields, return ""

Return JSON with the exact field names specified.`;

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
        console.log(`[AI-EXTRACTOR] Extracting for template: ${docName}`);
        console.log(`[AI-EXTRACTOR] Target fields (${targetFields.length}): ${targetFields.slice(0, 10).join(', ')}...`);

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
                max_tokens: 8192  // Increased to prevent truncation
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const extractedText = data.choices?.[0]?.message?.content || "{}";

        console.log("[AI-EXTRACTOR] Raw response length:", extractedText.length);

        let extractedData: ExtractedData;
        try {
            extractedData = JSON.parse(extractedText);

            // === MINIMAL POST-PROCESSING (only defaults, no modifications) ===

            // Set country defaults if missing
            if (!extractedData.pais_nacimiento || extractedData.pais_nacimiento.trim() === '') {
                extractedData.pais_nacimiento = 'COLOMBIA';
            }
            if (!extractedData.pais_registro || extractedData.pais_registro.trim() === '') {
                extractedData.pais_registro = 'COLOMBIA';
            }

            // Log key extractions for debugging
            console.log(`[AI-EXTRACTOR] nuip: ${extractedData.nuip || extractedData.nuip_top || 'NOT FOUND'}`);
            console.log(`[AI-EXTRACTOR] nombres: ${extractedData.nombres || 'NOT FOUND'}`);
            console.log(`[AI-EXTRACTOR] authorizing_official: ${(extractedData.authorizing_official || 'NOT FOUND').substring(0, 50)}`);

            // === SAFETY CHECK: Clear obvious hallucinations ===
            const normalize = (str: any) => str ? String(str).toUpperCase().replace(/[^A-Z0-9]/g, '') : '';

            const childName = normalize(extractedData.nombres);
            const authOfficial = normalize(extractedData.authorizing_official);
            const ackOfficial = normalize(extractedData.acknowledgment_official);

            // Clear acknowledgment_official if it's duplicate of authorizing_official
            if (authOfficial && ackOfficial && authOfficial === ackOfficial) {
                console.log(`[SAFETY] Cleared duplicate acknowledgment_official`);
                extractedData.acknowledgment_official = '';
            }

            // Clear witness fields if they contain child's name
            for (const field of ['testigo1_nombres', 'testigo2_nombres']) {
                if (normalize(extractedData[field]) === childName && childName.length > 2) {
                    console.log(`[SAFETY] Cleared ${field}: matched child name`);
                    extractedData[field] = '';
                }
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
