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

    const systemPrompt = `You are extracting data from a SCANNED DOCUMENT IMAGE. This is a filled-out form where some fields may be EMPTY.

#############################################
## CRITICAL: VISUAL INSPECTION REQUIRED
#############################################

YOU MUST VISUALLY INSPECT EACH SECTION OF THE DOCUMENT BEFORE EXTRACTING.

FOR EACH FIELD, ASK YOURSELF:
"Do I see actual TEXT (handwritten or typed) in this specific field's box/area?"
- If YES → Extract that text
- If NO (only dots, dashes, blank space, or empty) → Return ""

#############################################
## HOW TO RECOGNIZE EMPTY FIELDS
#############################################

An empty field looks like:
- A row of dots: ". . . . . . . . . . . ."
- A row of dashes: "- - - - - - - - -"
- Completely blank white/empty space
- The label exists but NO data is written below/beside it

An empty field does NOT look like:
- Contains handwritten text
- Contains typed/printed text
- Contains a name, number, or any characters

#############################################
## WITNESS SECTIONS (VERY IMPORTANT)
#############################################

Look at "Datos primer testigo" and "Datos segundo testigo" sections.
These sections are OFTEN EMPTY in Colombian birth certificates.

CHECK VISUALLY:
- Is there a NAME written in "Apellidos y nombres completos"? 
- Is there an ID written in "Documento de identificación"?

If these lines contain ONLY DOTS or are BLANK → return "" for testigo fields
Do NOT copy the child's name or any other name to these fields.

#############################################
## FIELD-BY-FIELD EXTRACTION
#############################################

For EACH field you extract, you must have SEEN that text in the correct location.
Do NOT infer, guess, or copy data from one section to another.

#############################################
## MANDATORY FIELDS
#############################################
- margin_notes (Any text found in the "ESPACIO PARA NOTAS" section. Look specifically for "NUIP OTORGADO POR..." or "NUIP NUEVO..." and extract the full content verbatim including dates and numbers. This section is usually at the VERY BOTTOM of the document. INCLUDE HANDWRITTEN TEXT.)
- authorizing_official (Name of the official found near "Nombre y firma del funcionario que autoriza" - ONLY if actually present, otherwise "")
- acknowledgment_official (CRITICAL - READ CAREFULLY:
  * This is the official who witnessed a PATERNAL RECOGNITION ("Reconocimiento paterno")
  * LOCATION: This signature box is in the PATERNAL RECOGNITION section, NOT the main registration section
  * VISUAL CHECK: Look for a section titled "RECONOCIMIENTO PATERNO" or "Paternal Recognition"
  * If the "Reconocimiento paterno" section is EMPTY (blank, dots, no father signature) → return ""
  * If you see "Reconocimiento paterno" section filled with father's signature → look for the official's name near "Nombre y firma del funcionario ante quien se hace el reconocimiento"
  * DO NOT confuse this with "authorizing_official" (different person, different section)
  * DO NOT extract from the main registration signature box
  * IMPORTANT: In most birth certificates, this field is EMPTY because there is no paternal recognition
  * If uncertain or no paternal recognition section → return "")
- nuip_top (CRITICAL NUIP EXTRACTION - READ CAREFULLY:
  * LOCATION: Look at the VERY TOP-LEFT corner of the document
  * VISUAL CUE: There is a small box/rectangle with the label "NUIP" or "N.U.I.P."
  * THE VALUE IS INSIDE THIS BOX - not anywhere else
  * FORMAT: This value is ALPHANUMERIC (contains both letters AND numbers)
  * COMMON PATTERNS: "V2A00011S6", "A1234567", "VA1112083468", "AADOT239373"
  * EXAMPLE: If you see a box at top-left with "NUIP" label and inside it says "V2A00011S6", extract exactly "V2A00011S6"
  * DO NOT extract from "NUIP NUEVO" section at the bottom
  * DO NOT extract from "NUIP OTORGADO" in notes section
  * DO NOT hallucinate or guess - extract ONLY what you see in the top-left NUIP box)
- nuip_bottom (The NUIP code found at the BOTTOM/SIDE of the document. Usually a 10-digit numeric value.)

PRIMARY FIELDS (Defined by Template):
${fieldDescriptions.length > 0 ? fieldDescriptions : "No specific template fields defined."}

COMMON FALLBACK FIELDS (Extract if present and not covered above):
## REGISTRANT INFORMATION (CHILD'S NAME - READ CAREFULLY)
CRITICAL NAME EXTRACTION RULES:
1. Find the section "Datos del inscrito" (Registrant Information)
2. Look for THREE separate fields:
   - "Primer Apellido" = FIRST SURNAME (e.g., "QUEVEDO")
   - "Segundo Apellido" = SECOND SURNAME (e.g., "HERRERA")
   - "Nombre(s)" = GIVEN NAME(S) (e.g., "KATERINE")
3. DO NOT confuse surnames with given names
4. Example from document:
   - primer_apellido: "QUEVEDO" (NOT "KATERINE")
   - segundo_apellido: "HERRERA"
   - nombres: "KATERINE" (NOT "QUEVEDO")

- nombres (given names - the child's first name, found in "Nombre(s)" field)
- primer_apellido (first surname - found in "Primer Apellido" field)
- segundo_apellido (second surname - found in "Segundo Apellido" field)
- apellidos (full surnames if separate fields not found)
- nuip (Legacy field: Populate with the alphanumeric nuip_top if present, otherwise use nuip_bottom)
- serial_indicator (CRITICAL: This is the "Indicativo Serial" - a numeric code found NEXT TO the NUIP box at the top of the document. It is typically 8 digits like "29734419". Look for text "Serial" or "Indicativo Serial" near the NUIP. This is DIFFERENT from the NUIP itself.)
- sexo (sex/gender: M, F, MASCULINO, FEMENINO, or as found)
- grupo_sanguineo (blood type, e.g., O, A, B, AB)
- factor_rh (Rh factor, e.g., +, -, POSITIVO, NEGATIVO)

## BIRTH DETAILS
- fecha_nacimiento (date of birth - combined format DD/MM/YYYY - look for "FECHA DE NACIMIENTO" or separate day/month/year fields)
- fecha_nacimiento_year (year only, e.g., "2000")
- fecha_nacimiento_month (month only, e.g., "08")
- fecha_nacimiento_day (day only, e.g., "19")
- hora_nacimiento (time of birth - look for "HORA", hour/time near birth date)
- pais_nacimiento (country of birth, default COLOMBIA)
- departamento_nacimiento (department of birth, e.g., "VALLE", "CAUCA", "CUNDINAMARCA")
- municipio_nacimiento (municipality/city of birth, e.g., "CALI", "BOGOTA", "MEDELLIN")

CRITICAL - LUGAR DE NACIMIENTO (Place of Birth):
- This is the MOST IMPORTANT field for birth location
- Look for "Lugar de nacimiento" row in the document
- This contains the SPECIFIC PLACE: hospital name, clinic name, or address
- EXAMPLES of what to extract:
  * "CLINICA MATERNO INFANTIL FARALLONES (COLOMBIA.VALLE.CALI)"
  * "HOSPITAL UNIVERSITARIO DEL VALLE"
  * "CLINICA SAN FERNANDO"
  * "DOMICILIO" (for home births)
- This is NOT just "COLOMBIA - VALLE - CALI" - it includes the INSTITUTION NAME
- lugar_nacimiento field should contain the FULL text from this row
- If the document shows "CLINICA MATERNO INFANTIL FARALLONES (COLOMBIA.VALLE.CALI)", extract EXACTLY that

- lugar_nacimiento (CRITICAL: Extract the COMPLETE text including hospital/clinic name AND location. Example: "CLINICA MATERNO INFANTIL FARALLONES (COLOMBIA.VALLE.CALI)")
- vereda (township/vereda)
- corregimiento

## FATHER INFORMATION
CRITICAL ANTI-DUPLICATION RULE:
- Extract father's name EXACTLY ONCE
- If you see "QUEVEDO MEDINA HARVEY ABAD", extract it as-is
- DO NOT append additional surnames or repeat any part
- Example: "QUEVEDO MEDINA HARVEY ABAD" NOT "QUEVEDO MEDINA HARVEY ABAD QUEVEDO MEDINA"

- padre_nombres (father's COMPLETE full name including all surnames - e.g., "QUEVEDO MEDINA HARVEY ABAD")
- padre_apellidos (father's surnames only if separated - usually empty)
- padre_identificacion (father's ID number - CC, TI, passport number)
- padre_tipo_documento (father's document type - CC, TI, PASAPORTE)
- padre_nacionalidad (father's nationality)

## MOTHER INFORMATION
CRITICAL REPEATED SURNAME RULE:
- Extract mother's name EXACTLY AS WRITTEN in the document.
- If the document says "HERRERA HERRERA ALBA YOLANDA" (with "HERRERA" repeated), you MUST extract "HERRERA HERRERA ALBA YOLANDA".
- DO NOT "fix" or "deduplicate" the name. If she has two identical surnames, INCLUDE BOTH.
- This is common in Hispanic culture.
- Example:
  * Document: "HERRERA HERRERA ALBA YOLANDA"
  * Extraction: "HERRERA HERRERA ALBA YOLANDA" (CORRECT)
  * Extraction: "HERRERA ALBA YOLANDA" (WRONG - do not remove the second Herrera)

- madre_nombres (mother's COMPLETE full name including all surnames - e.g., "HERRERA HERRERA ALBA YOLANDA")
- madre_apellidos (ALWAYS LEAVE EMPTY - put the ENTIRE name string including all surnames in madre_nombres)
- madre_identificacion (mother's ID number - CC, TI, PASAPORTE)
- madre_tipo_documento (mother's document type - CC, TI, PASAPORTE)
- madre_nacionalidad (mother's nationality)

## DECLARANT INFORMATION
CRITICAL ROLE DISTINCTION:
- "Declarante" = Person making the declaration (often the father or mother)
- "Funcionario que autoriza" = Official authorizing the document (near stamp/signature)
- These are DIFFERENT people - do NOT confuse them
- Look for "Datos del declarante" section for declarant information
- The official's name (like "HOLMES RAFAEL CARDONA MONTOYA") goes in 'authorizing_official', NOT here
- If "Datos del declarante" section is EMPTY (dots/blank), return "" for all declarant fields

- declarante_nombres (declarant's full names and surnames - ONLY if section is filled, otherwise "")
- declarante_identificacion (declarant's ID number - ONLY if section is filled, otherwise "")
- declarante_tipo_documento (declarant's document type - ONLY if section is filled, otherwise "")

## WITNESS INFORMATION
CRITICAL - EMPTY WITNESS FIELDS:
- Look specifically for "Datos primer testigo" and "Datos segundo testigo" sections
- These sections may be EMPTY (filled with dots, blank, or no handwritten text)
- If you see ONLY dots (......) or blank lines in the witness name fields, return EMPTY STRING ""
- DO NOT confuse the child's name (from "Datos del inscrito") with witness names
- DO NOT copy any other names to the witness fields if they are blank in the original
- Witness names are SEPARATE people who witnessed the birth, NOT the child or parents

- testigo1_nombres (first witness's full names and surnames - ONLY if actually filled in)
- testigo1_identificacion (first witness's ID number - ONLY if actually filled in)
- testigo2_nombres (second witness's full names and surnames - ONLY if actually filled in)
- testigo2_identificacion (second witness's ID number - ONLY if actually filled in)

## REGISTRY OFFICE INFORMATION
- oficina (office name - e.g., "NOTARÃA 21 CALI")
- tipo_oficina (office type: Notaria, Consulado, Registraduria)
- numero_oficina (office number, e.g., 21, 5)
- pais_registro (country of registration, typically "COLOMBIA")
- departamento_registro (department where registered)
- municipio_registro (city/municipality where registered)
- ciudad_registro (same as municipio_registro)
- consulado (consulate name if applicable)
- fecha_registro (date of registration - combined format DD/MM/YYYY)
- fecha_registro_year (year only, e.g., "2000")
- fecha_registro_month (month only, e.g., "08")
- fecha_registro_day (day only, e.g., "31")

## DOCUMENT IDENTIFIERS
- codigo (code - extract ALL parts, usually 3 numbers like "97 0 2")
- acta (certificate/record number)
- tomo (volume)
- folio (page)
- libro (book)
- numero_acta (same as acta)

## OTHER
- notas (notes/marginal notes)
- tipo_documento_anterior (Type of Prior Document or Witness Statement, e.g., "CERTIFICADO DE NACIDO VIVO", "DECLARACIÃ“N DE TESTIGOS")
- certificado_nacido_vivo_numero (Live Birth Certificate Number - usually starts with 'A' followed by digits, e.g., "A2692167")
- funcionario_nombre (authorizing official's name - look near "Nombre y firma" or "Funcionario")
- funcionario_cargo (authorizing official's position)

IMPORTANT EXTRACTION RULES:
1. Prioritize the "PRIMARY FIELDS" if they exist.
2. Use the exact field names provided in the "PRIMARY FIELDS" section.
3. Extract the FULL office name (e.g., "NOTARÃA 21 CALI")
4. Default 'pais_nacimiento' and 'pais_registro' to "COLOMBIA" if not explicitly different.
5. Return empty string "" for fields not found, never use null.
6. Return ONLY the JSON object.
7. For DATE fields: Look carefully for dates in formats like DD/MM/YYYY, DD-MM-YYYY, or separate Year/Month/Day columns. Birth dates are often near "FECHA DE NACIMIENTO" or "AÃ‘O MES DIA".
8. CRITICAL - DATE EXTRACTION: Extract dates in BOTH formats:
   - Combined: fecha_nacimiento = "19/08/2000" (DD/MM/YYYY)
   - Separate components: fecha_nacimiento_year = "2000", fecha_nacimiento_month = "08", fecha_nacimiento_day = "19"
   - Same for fecha_registro: combined AND separate components
9. If you find separate Year, Month, Day values, extract them as separate fields AND combine into fecha_nacimiento/fecha_registro.

CRITICAL - CÃ“DIGO/CODE FIELD:
- The "CÃ³digo" field usually contains 3 separate numbers (e.g., "97", "0", "2")
- These may appear in separate table cells or lines in the OCR text
- Look for patterns like "CÃ³digo 97" followed by "0" and "2" nearby
- Combine ALL parts into a single string like "97 0 2"
- Do NOT return just the first number. Look for suffix numbers like "0 2" or similar scattered parts.

CRITICAL - NUIP CONFLICT RESOLUTION:
- If 'nuip_top' (alphanumeric) and 'nuip_bottom' (numeric) are both found, use 'nuip_top' as the main 'nuip' value.
- Do NOT let the numeric NUIP overwrite the alphanumeric one.

CRITICAL - NOTAS/NOTES FIELD:
- Look for text after "NOTAS MARGINALES", "ESPACIO PARA NOTAS", or "SPACE FOR NOTES"
- If there is handwritten or typed text in the notes section, extract it. This is usually at the bottom of the document.
- If blank or only decorative lines, return empty string

CRITICAL - MARGIN NOTES (ESPACIO PARA NOTAS):
- Specifically look for the section labeled "ESPACIO PARA NOTAS" (usually at the very bottom)
- Extract ANY text found in this area into the 'margin_notes' field
- This often contains "NUIP OTORGADO POR..." or similar administrative notes with dates and handwritten text.
- READ THE HANDWRITTEN TEXT CAREFULLY.

CRITICAL - SIGNATURE/FUNCIONARIO FIELD:
- Look for the authorizing official's name near "Nombre y firma", "Nombre y Firma del Funcionario", or "Nombre y firma del funcionario que autoriza"
- IMPORTANT: In the image, this is often a stamped or typed name like "HOLMES RAFAEL CARDONA MONTOYA" near the top right or bottom right sections.
- Extract the FULL NAME found in this box.
- This is usually a typed name, not the actual signature
- Extract the full name if present

DYNAMIC EXTRACTION (CRITICAL FOR NEW FORMS):
- Scan the document for ANY other labeled data fields that are not listed above.
- If you see a label like "Name of Doctor", "Height", "Weight", "Date of Reference", etc., EXTRACT IT.
- Generate a 'snake_case' key for these fields (e.g., 'doctor_name', 'height', 'weight').
- This is vital for handling new types of forms automatically. Do not ignore visible data just because it's not in the primary list.
- IF YOU CANNOT FIND STRUCTURED DATA: Extract all visible text into a single field called "raw_text_dump". Do not return an empty JSON.`;

    const messages = [
        { role: "system", content: systemPrompt },
        {
            role: "user",
            content: fileUrl
                ? [
                    {
                        type: "text",
                        text: `Extract ALL data from this Colombian document. 
                        
CRITICAL INSTRUCTIONS:
1. Look at the TOP-LEFT corner for NUIP box - extract that value (e.g., "V2A0001156")
2. For dates, extract BOTH combined (DD/MM/YYYY) AND separate components (year, month, day)
3. EXTRACT EVERY visible field - if you see text, extract it!
4. For fields with NO text (just dots or blank), return empty string ""
5. For fecha_nacimiento, extract: combined string AND fecha_nacimiento_year, fecha_nacimiento_month, fecha_nacimiento_day
6. For fecha_registro, extract: combined string AND fecha_registro_year, fecha_registro_month, fecha_registro_day
7. DUPLICATE SURNAMES: If you see "HERRERA HERRERA", extract BOTH.
8. NOTES: Look at the BOTTOM of the document for "ESPACIO PARA NOTAS". Extract handwritten or typed text there.
9. LUGAR DE NACIMIENTO: Find "Lugar de nacimiento" row. Extract the COMPLETE text including clinic/hospital name.
10. EMPTY SECTIONS ONLY:
    - Witness sections (Datos primer/segundo testigo) - return "" ONLY if section has no names written
    - Declarant section (Datos del declarante) - return "" ONLY if no name written
    - Do NOT confuse empty fields with filled fields!
11. REMEMBER: Your job is to EXTRACT what you see. If data is visible, EXTRACT IT.

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
                : `Extract data from this Colombian birth certificate OCR text. 

ABSOLUTELY CRITICAL - LUGAR DE NACIMIENTO (Place of Birth):
- Search for text containing "CLINICA", "HOSPITAL", "MATERNO", "CENTRO", "SAN", "SANTA", "LOS", "LAS" near "Lugar de nacimiento"
- The place of birth is NOT just "COLOMBIA - VALLE - CALI"
- It MUST include the institution name like "CLINICA MATERNO INFANTIL FARALLONES"
- If you see "CLINICA MATERNO INFANTIL FARALLONES" followed by "(COLOMBIA.VALLE.CALI)", combine them
- WRONG: "COLOMBIA - VALLE - CALI" (missing institution)
- CORRECT: "CLINICA MATERNO INFANTIL FARALLONES (COLOMBIA.VALLE.CALI)"
- If you cannot find a clinic/hospital name, look harder - it's usually on the line AFTER "Lugar de nacimiento"

OTHER INSTRUCTIONS:
1. The text is from Google Vision OCR - it may have unusual line breaks or spacing
2. Blood type (grupo_sanguineo) is usually "O", "A", "B", or "AB"
3. RH Factor (factor_rh) is usually "+" or "-" or "POSITIVO"/"NEGATIVO"
4. DUPLICATE SURNAMES: If you see "HERRERA HERRERA" in the text, extract BOTH. Do not deduplicate.
5. NOTES: Look at the VERY END of the text for "ESPACIO PARA NOTAS" or "NUIP NUEVO". Extract this content into 'margin_notes'.

OCR TEXT TO PARSE:
${text.substring(0, 15000)}` // Increased limit for better context
        }
    ];

    try {
        console.log("Sending request to OpenAI...");
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
