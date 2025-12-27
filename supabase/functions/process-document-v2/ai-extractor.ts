interface ExtractedData {
    [key: string]: any;
}

export const extractData = async (text: string, template: any, fileUrl?: string): Promise<ExtractedData> => {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const templateFields = template?.field_definitions || [];
    const fieldDescriptions = templateFields.map((f: any) => `- ${f.name}: ${f.description || 'No description'}`).join('\n');

    // Get PDF mappings from template for guiding extraction
    const pdfMappings = template?.content_profile?.pdf_mappings || {};
    const pdfFields = template?.content_profile?.pdfFields || [];
    const mappingFieldNames = Object.keys(pdfMappings);

    // Create a list of expected extraction field names from the mappings
    const expectedFields = mappingFieldNames.length > 0
        ? `\n## EXPECTED EXTRACTION FIELD NAMES\nUse these exact field names in your response for proper mapping:\n${mappingFieldNames.map(f => `- ${f}`).join('\n')}`
        : '';

    // 1. Determine Document Type and Context
    const docType = template?.content_profile?.documentType
        ? template.content_profile.documentType.replace(/_/g, ' ').toUpperCase()
        : 'CIVIL REGISTRY DOCUMENT';
    const docName = template?.name || 'Colombian Document';

    // 2. Feature Flags based on Template Fields
    const hasAckOfficial = templateFields.some((f: any) => f.name === 'acknowledgment_official') || mappingFieldNames.includes('acknowledgment_official');
    const hasWitnesses = templateFields.some((f: any) => f.name.includes('testigo')) || mappingFieldNames.some(f => f.includes('testigo'));
    const hasNuip = templateFields.some((f: any) => f.name.includes('nuip')) || mappingFieldNames.some(f => f.includes('nuip'));
    const isBirthCertificate = docType.includes('BIRTH') || docType.includes('NACIMIENTO') || docType.includes('CIVIL REGISTRY');


    // 3. Construct Dynamic Strict Rules
    let strictRules = "";

    if (hasWitnesses) {
        strictRules += `
    1. **Witness Fields ("Testigos"):** 
       - Look specifically for the "Testigos" section.
       - If the lines for "Nombre" or "Cédula" are blank or have dots → RETURN ""
       - NEVER copy the Child's/Registrant's name or Parents' names into the Witness section.
        `;
    }

    if (hasAckOfficial) {
        strictRules += `
    2. **Acknowledgment Official ("Reconocimiento Paterno"):**
       - This official SIGNS ONLY if there is a "Reconocimiento Paterno" (Paternal Recognition).
       - If the "Reconocimiento Paterno" section is empty/blank → RETURN "" for 'acknowledgment_official'.
       - Do NOT return the "Authorizing Official" (Notary/Registrar) name here.
        `;
    }

    // 4. Construct System Prompt
    const systemPrompt = `You are extracting data from a SCANNED DOCUMENT IMAGE of a ${docName} (${docType}).
    The document format may vary. Your job is to extract the visible data.

    #############################################
    ## CORE EXTRACTION PRINCIPLE: "SEE IT -> EXTRACT IT"
    #############################################
    For every field, if you see text written (handwritten or typed), EXTRACT IT. 
    Do not be too afraid of messy handwriting. If there is data, try to capture it.

    BUT:
    - If a field is VISUALLY EMPTY (contains only dots ".........", lines "_______", or blank space) → Return ""
    - Do NOT HALLUCINATE. Do not invent names. Do not copy names from one section to another.

    #############################################
    ## CRITICAL ANTI-HALLUCINATION RULES
    #############################################
    Apply these rules strictly to WITNESSES, DECLARANTS, and OFFICIALS:
    ${strictRules}

    #############################################
    ## CRITICAL: DOCUMENT SECTION IDENTIFICATION
    #############################################
    Colombian birth certificates have DISTINCT SECTIONS. You MUST identify each section correctly:
    
    **SECTION 1: REGISTRANT ("Datos del inscrito" / "Registrant's Information")**
    - Located near the TOP of the document
    - Contains: "Nombres" (Given Names), "Apellidos" (Surnames) of the CHILD
    - These are SHORT names like "MICAELA", "JUAN CARLOS", "MARIA"
    - The surnames are like "TOBAR BOTERO", "GOMEZ HERNANDEZ"
    - DO NOT put the official's name here!
    
    **SECTION 2: PARENTS ("Datos del Padre" / "Datos de la Madre")**
    - Contains: Mother's names/surnames AND Father's names/surnames
    - Each parent has their OWN Nombres + Apellidos + ID + Nationality
    - Mother and Father are in SEPARATE sub-sections
    
    **SECTION 3: OFFICIALS (At the BOTTOM of the document)**
    - Contains: "Nombre y firma del funcionario" (Official's Name and Signature)
    - This is a LONG name like "MARIA CRISTINA MANZANO LOPEZ"
    - This name goes in 'authorizing_official' or 'funcionario_nombre'
    - This is NOT the registrant! DO NOT confuse with registrant's names!
    
    **CRITICAL RULE**: The official's signature at the bottom is NOT the registrant. 
    If you see a long name at the bottom near "Funcionario" → that's the OFFICIAL.
    The registrant's name is in the "Datos del inscrito" section at the TOP.

    #############################################
    ## FIELD VISUAL GUIDES (GENERIC)
    #############################################
    ${hasNuip ? '- **NUIP / NIUP:** Look for a box labeled "NUIP", "N.U.I.P". Alphanumeric (e.g. "1234567890", "V2A...").' : ''}
    - **Registrant's Name:** Look for "Datos del Inscrito", "Datos del Contrayente" (Marriage), or "Datos del Fallecido" (Death).
    - **Parents:** Look for "Datos del Padre" and "Datos de la Madre".
    - **Officials:** 'authorizing_official' (Notary/Registrar) - at the BOTTOM, near signatures.


    #############################################
    ## MANDATORY FIELDS (If present in template)
    #############################################
    - margin_notes (Any text found in the "ESPACIO PARA NOTAS" section. Look specifically for "NUIP OTORGADO POR..." or "NUIP NUEVO..." and extract the full content verbatim including dates and numbers. This section is usually at the VERY BOTTOM of the document. INCLUDE HANDWRITTEN TEXT.)
    - authorizing_official (Name of the official found near "Nombre y firma del funcionario que autoriza" - ONLY if actually present, otherwise "")
    ${hasAckOfficial ? `- acknowledgment_official (CRITICAL - READ CAREFULLY:
      * This is the official who witnessed a PATERNAL RECOGNITION ("Reconocimiento paterno")
      * LOCATION: This signature box is in the PATERNAL RECOGNITION section, NOT the main registration section
      * VISUAL CHECK: Look for a section titled "RECONOCIMIENTO PATERNO" or "Paternal Recognition"
      * If the "Reconocimiento paterno" section is EMPTY (blank, dots, no father signature) → return ""
      * If you see "Reconocimiento paterno" section filled with father's signature → look for the official's name near "Nombre y firma del funcionario ante quien se hace el reconocimiento"
      * DO NOT confuse this with "authorizing_official" (different person, different section)
      * DO NOT extract from the main registration signature box
      * IMPORTANT: In most birth certificates, this field is EMPTY because there is no paternal recognition
      * If uncertain or no paternal recognition section → return "")` : ''}
    ${hasNuip ? `- nuip_top (CRITICAL NUIP EXTRACTION:
      * LOCATION: Look at the VERY TOP-LEFT or HEADER area
      * VISUAL CUE: Small box/rectangle labeled "NUIP" or "N.U.I.P."
      * CONTENT: Alphanumeric value inside that box
      * DO NOT extract from notes or other sections)
    - nuip_bottom (The NUIP code found at the BOTTOM/SIDE of the document, usually numeric.)` : ''}
    
    PRIMARY FIELDS (Defined by Template):
    ${fieldDescriptions.length > 0 ? fieldDescriptions : "No specific template fields defined."}
    
    COMMON FALLBACK FIELDS (Extract if present and not covered above):
    ## REGISTRANT INFORMATION
    1. Find "Datos del inscrito" section (or equivalent for Marriage/Death)
    2. Extract Names, Surnames, ID.
    
    ## PARENTS INFORMATION
    - Find "Datos del Padre" and "Datos de la Madre"
    - Extract Names, IDs, Nationalities.
    
    ## REGISTRY INFORMATION
    - "Fecha de Inscripción" / "Fecha de Registro"
    - "Oficina de Registro" (Notary/Registraduria)
    - "Lugar de Registro"

    ## NOTES
    - LOOK CAREFULLY FOR ANY HANDWRITTEN NOTES ON THE MARGINS OR BOTTOM.
    - Extract any text about "NUIP", "Corrections", "Replacements".

    ## OFFICIALS (CRITICAL - EXTRACT FULL NAMES)
    - authorizing_official: Extract the COMPLETE FULL NAME (all surnames and first names) near "Nombre y firma del funcionario"
    - funcionario_nombre: Same as authorizing_official - extract EVERY word of the name
    - **IMPORTANT**: Names often have multiple parts like "MARIA CRISTINA LOPEZ HERNANDEZ" - extract ALL parts
    - Do NOT truncate names. If you see "CARLOS ALBERTO GOMEZ RODRIGUEZ", extract the entire string
    - Look for names near signatures, stamps, or "Funcionario" labels


    ## CRITICAL RULES
    1. Prioritize predefined fields.
    2. Extract dates in BOTH formats (combined DD/MM/YYYY and separate Year/Month/Day).
    3. CODE FIELD: "Código" usually has 3 parts (e.g. "97 0 2"). Combine them.
    4. NUIP PRIORITY: If nuip_top (alphanumeric) and nuip_bottom (numeric) differ, prefer nuip_top.

    ## DYNAMIC EXTRACTION (CRITICAL)
    - Scan for ANY other labeled data fields not listed above.
    - If you see "Name of Doctor", "Height", "Weight", etc., EXTRACT IT.
    - Create reasonable keys (e.g. 'doctor_name').
    - IF NO STRUCTURED DATA FOUND: Extract all visible text into "raw_text_dump".
    ${expectedFields}
    `;

    const messages = [
        { role: "system", content: systemPrompt },
        {
            role: "user",
            content: fileUrl
                ? [
                    {
                        type: "text",
                        text: `Extract ALL data from this ${docName}. 
                        
CRITICAL INSTRUCTIONS:
    1. Look at the TOP-LEFT corner for NUIP box (if present) - extract the COMPLETE value.
    2. For dates, extract BOTH combined (DD/MM/YYYY) AND separate components (year, month, day).
    3. EXTRACT EVERY visible field - if you see text, extract it!
    4. For fields with NO text (just dots or blank), return empty string "".
    5. DUPLICATE SURNAMES: If you see "HERRERA HERRERA", extract BOTH.
    6. NOTES: Look at the BOTTOM of the document for "ESPACIO PARA NOTAS".
    7. EMPTY SECTIONS ONLY:
       - Witness sections - return "" ONLY if section has no names written.
       - Declarant section - return "" ONLY if no name written.
       - Do NOT confuse empty fields with filled fields!
    8. REMEMBER: Your job is to EXTRACT what you see. If data is visible, EXTRACT IT.
    9. **FULL NAMES**: For ALL person names (officials, parents, witnesses, declarants), extract the COMPLETE name. 
       Include ALL surnames and first names. Do NOT truncate. Example: "CARLOS ALBERTO GOMEZ RODRIGUEZ" not just "RODRIGUEZ".
    10. **NUIP**: Extract the COMPLETE NUIP including any letters at the start (e.g., "V2A0001156" not "2A0001156").

Return JSON with all extracted fields.`

                    },
                    {
                        type: "image_url",
                        image_url: {
                            // Handle both data URIs and regular URLs
                            url: fileUrl
                        }
                    }
                ]
                : `Extract data from this ${docName} OCR text. 

ABSOLUTELY CRITICAL - LUGAR DE NACIMIENTO (Place of Birth):
    - Search for text containing "CLINICA", "HOSPITAL", "MATERNO", "CENTRO", "SAN", "SANTA", "LOS", "LAS" near "Lugar de nacimiento"
    - The place of birth is NOT just "COLOMBIA - VALLE - CALI"
    - It MUST include the institution name like "CLINICA MATERNO INFANTIL FARALLONES"

OTHER INSTRUCTIONS:
    1. The text is from Google Vision OCR - it may have unusual line breaks or spacing.
    2. Blood type (grupo_sanguineo) is usually "O", "A", "B", or "AB".
    3. RH Factor (factor_rh) is usually "+" or "-" or "POSITIVO" / "NEGATIVO".
    4. DUPLICATE SURNAMES: If you see "HERRERA HERRERA" in the text, extract BOTH. Do not deduplicate.
    5. NOTES: Look at the VERY END of the text for "ESPACIO PARA NOTAS" or "NUIP NUEVO". Extract this content into 'margin_notes'.

OCR TEXT TO PARSE:
${text.substring(0, 15000)}`
        }
    ];

    try {
        console.log(`Sending request to OpenAI (Document: ${docName}, Type: ${docType})...`);
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
                max_tokens: 4096
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const extractedText = data.choices?.[0]?.message?.content || "{}";

        // --- PROBE: RAW LOGGING ---
        console.log("RAW_OPENAI_RESPONSE:", extractedText);
        // --------------------------

        let extractedData: ExtractedData;
        try {
            extractedData = JSON.parse(extractedText);

            // Enforce defaults for country fields if missing
            if (!extractedData.pais_nacimiento || extractedData.pais_nacimiento.trim() === '') {
                extractedData.pais_nacimiento = 'COLOMBIA';
            }
            if (!extractedData.pais_registro || extractedData.pais_registro.trim() === '') {
                extractedData.pais_registro = 'COLOMBIA';
            }

            // =====================================================
            // ROBUST POST-PROCESSING: SAFETY NET
            // =====================================================

            // Helper to normalize strings for comparison (remove spaces/punctuation)
            const normalize = (str: any) => str ? String(str).toUpperCase().replace(/[^A-Z0-9]/g, '') : '';

            // Fields to check depend on what was extracted, but we can keep the logic generic
            const childName = normalize(extractedData.nombres);
            const childSurname = normalize(extractedData.primer_apellido);

            // 1. CLEAR WITNESS/DECLARANT/OFFICIAL FIELDS IF THEY CONTAIN CHILD INFO
            // These fields should NEVER contain the child's name
            const fieldsToCheck = [
                'testigo1_nombres', 'testigo2_nombres',
                'testigo1_identificacion', 'testigo2_identificacion',
                'declarante_nombres', 'acknowledgment_official'
            ];

            for (const field of fieldsToCheck) {
                const val = normalize(extractedData[field]);
                const rawVal = extractedData[field]; // Keep raw for logging

                if (!val) continue;

                // A. EXACT MATCH with Child Name
                if (childName && val === childName) {
                    console.log(`[SAFETY] Cleared ${field}: "${rawVal}" matched child name`);
                    extractedData[field] = '';
                    continue;
                }

                // B. EXACT MATCH with Child First Surname (only if surname > 2 chars)
                // Prevents witnesses being just "QUEVEDO"
                if (childSurname && childSurname.length > 2 && val === childSurname) {
                    console.log(`[SAFETY] Cleared ${field}: "${rawVal}" matched child surname`);
                    extractedData[field] = '';
                    continue;
                }
            }

            // 2. CLEAR DUPLICATE OFFICIALS (Hallucination of copying auth official to ack official)
            const authOfficial = normalize(extractedData.authorizing_official);
            const ackOfficial = normalize(extractedData.acknowledgment_official);

            if (authOfficial && ackOfficial && authOfficial === ackOfficial) {
                console.log(`[SAFETY] Cleared acknowledgment_official: duplicate of authorizing_official`);
                extractedData.acknowledgment_official = '';
            }

            // 3. CLEAR IDENTICAL WITNESSES
            const wit1 = normalize(extractedData.testigo1_nombres);
            const wit2 = normalize(extractedData.testigo2_nombres);
            if (wit1 && wit2 && wit1 === wit2) {
                // Identical witnesses usually means AI hallucinated the same name twice
                // Clear the second one at least
                console.log(`[SAFETY] Cleared testigo2_nombres: duplicate of testigo1`);
                extractedData.testigo2_nombres = '';
            }

            console.log('[POST-PROCESS] Cross-contamination check complete');

        } catch (parseError) {
            console.error("Failed to parse OpenAI response:", extractedText);
            throw new Error("Invalid JSON response from OpenAI");
        }

        return extractedData;

    } catch (error) {
        console.error("Error in AI extraction:", error);
        throw error;
    }
};
