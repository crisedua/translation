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

    const systemPrompt = `You are an expert at extracting structured data from Colombian civil registry documents.
Extract the following fields from the provided document image. Return ONLY valid JSON with the extracted values.

MANDATORY FIELDS (Must be extracted if found, regardless of template):
- margin_notes (Any text found in the "ESPACIO PARA NOTAS" section. Look specifically for "NUIP OTORGADO POR..." or "NUIP NUEVO..." and extract the full content verbatim including dates and numbers.)
- authorizing_official (Name of the official found near "Nombre y firma del funcionario que autoriza")
- acknowledgment_official (Name of the official found near "Nombre y firma del funcionario ante quien se hace el reconocimiento" - this is for paternal recognition)
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
- nuip_bottom (The NUIP code found at the BOTTOM/SIDE of the document. Usually a 10‑digit numeric value.)

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
- departamento_nacimiento (department of birth)
- municipio_nacimiento (municipality/city of birth)
- lugar_nacimiento (specific birth place - hospital, clinic name, address, or "DOMICILIO" for home birth)
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
CRITICAL ANTI-DUPLICATION RULE:
- Extract mother's name EXACTLY ONCE
- If you see "HERRERA HERRERA ALBA YOLANDA", extract it as-is
- DO NOT append additional surnames or repeat any part
- Example: "HERRERA HERRERA ALBA YOLANDA" NOT "HERRERA HERRERA ALBA YOLANDA HERRERA"

- madre_nombres (mother's COMPLETE full name including all surnames - e.g., "HERRERA HERRERA ALBA YOLANDA")
- madre_apellidos (mother's surnames only if separated - usually empty)
- madre_identificacion (mother's ID number - CC, TI, passport number)
- madre_tipo_documento (mother's document type - CC, TI, PASAPORTE)
- madre_nacionalidad (mother's nationality)

## DECLARANT INFORMATION
CRITICAL ROLE DISTINCTION:
- "Declarante" = Person making the declaration (often the father or mother)
- "Funcionario que autoriza" = Official authorizing the document (near stamp/signature)
- These are DIFFERENT people - do NOT confuse them
- Look for "Datos del declarante" section for declarant information
- The official's name (like "HOLMES RAFAEL CARDONA MONTOYA") goes in 'authorizing_official', NOT here

- declarante_nombres (declarant's full names and surnames - the person declaring, NOT the official)
- declarante_identificacion (declarant's ID number)
- declarante_tipo_documento (declarant's document type)

## WITNESS INFORMATION
- testigo1_nombres (first witness's full names and surnames)
- testigo1_identificacion (first witness's ID number)
- testigo2_nombres (second witness's full names and surnames)
- testigo2_identificacion (second witness's ID number)

## REGISTRY OFFICE INFORMATION
- oficina (office name - e.g., "NOTARÍA 21 CALI")
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
- tipo_documento_anterior (Type of Prior Document or Witness Statement, e.g., "CERTIFICADO DE NACIDO VIVO", "DECLARACIÓN DE TESTIGOS")
- certificado_nacido_vivo_numero (Live Birth Certificate Number - usually starts with 'A' followed by digits, e.g., "A2692167")
- funcionario_nombre (authorizing official's name - look near "Nombre y firma" or "Funcionario")
- funcionario_cargo (authorizing official's position)

IMPORTANT EXTRACTION RULES:
1. Prioritize the "PRIMARY FIELDS" if they exist.
2. Use the exact field names provided in the "PRIMARY FIELDS" section.
3. Extract the FULL office name (e.g., "NOTARÍA 21 CALI")
4. Default 'pais_nacimiento' and 'pais_registro' to "COLOMBIA" if not explicitly different.
5. Return empty string "" for fields not found, never use null.
6. Return ONLY the JSON object.
7. For DATE fields: Look carefully for dates in formats like DD/MM/YYYY, DD-MM-YYYY, or separate Year/Month/Day columns. Birth dates are often near "FECHA DE NACIMIENTO" or "AÑO MES DIA".
8. CRITICAL - DATE EXTRACTION: Extract dates in BOTH formats:
   - Combined: fecha_nacimiento = "19/08/2000" (DD/MM/YYYY)
   - Separate components: fecha_nacimiento_year = "2000", fecha_nacimiento_month = "08", fecha_nacimiento_day = "19"
   - Same for fecha_registro: combined AND separate components
9. If you find separate Year, Month, Day values, extract them as separate fields AND combine into fecha_nacimiento/fecha_registro.

CRITICAL - CÓDIGO/CODE FIELD:
- The "Código" field usually contains 3 separate numbers (e.g., "97", "0", "2")
- These may appear in separate table cells or lines in the OCR text
- Look for patterns like "Código 97" followed by "0" and "2" nearby
- Combine ALL parts into a single string like "97 0 2"
- Do NOT return just the first number. Look for suffix numbers like "0 2" or similar scattered parts.

CRITICAL - NUIP CONFLICT RESOLUTION:
- If 'nuip_top' (alphanumeric) and 'nuip_bottom' (numeric) are both found, use 'nuip_top' as the main 'nuip' value.
- Do NOT let the numeric NUIP overwrite the alphanumeric one.

CRITICAL - NOTAS/NOTES FIELD:
- Look for text after "NOTAS MARGINALES", "ESPACIO PARA NOTAS", or "SPACE FOR NOTES"
- If there is handwritten or typed text in the notes section, extract it
- If blank or only decorative lines, return empty string

CRITICAL - MARGIN NOTES (ESPACIO PARA NOTAS):
- Specifically look for the section labeled "ESPACIO PARA NOTAS" (usually at the bottom)
- Extract ANY text found in this area into the 'margin_notes' field
- This often contains "NUIP OTORGADO POR..." or similar administrative notes

CRITICAL - SIGNATURE/FUNCIONARIO FIELD:
- Look for the authorizing official's name near "Nombre y firma", "Nombre y Firma del Funcionario", or "Nombre y firma del funcionario que autoriza"
- IMPORTANT: In the image, this is often a stamped or typed name like "HOLMES RAFAEL CARDONA MONTOYA" near the top right or bottom right sections.
- Extract the FULL NAME found in this box.
- This is usually a typed name, not the actual signature
- Extract the full name if present

DYNAMIC EXTRACTION (CRITICAL FOR NEW FORMS):
- Scan the document for ANY other labeled data fields that are not listed above.
- If you see a label like "Name of Doctor", "Height", "Weight", "Date of Reference", etc., EXTRACT IT.
140: - Generate a 'snake_case' key for these fields (e.g., 'doctor_name', 'height', 'weight').
141: - This is vital for handling new types of forms automatically. Do not ignore visible data just because it's not in the primary list.
142: - IF YOU CANNOT FIND STRUCTURED DATA: Extract all visible text into a single field called "raw_text_dump". Do not return an empty JSON.`;

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
1. Look at the TOP-LEFT corner for NUIP box - extract ONLY that value (e.g., "V2A0001156")
2. For dates, extract BOTH combined (DD/MM/YYYY) AND separate components (year, month, day)
3. Extract EVERY visible field, even if not in standard list
4. DO NOT guess or hallucinate - only extract what you clearly see
5. If uncertain, return empty string for that field
6. For fecha_nacimiento, extract: combined string AND fecha_nacimiento_year, fecha_nacimiento_month, fecha_nacimiento_day
7. For fecha_registro, extract: combined string AND fecha_registro_year, fecha_registro_month, fecha_registro_day

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
                : `Extract data from this Colombian document text:\n\n${text.substring(0, 8000)}` // Fallback to text if no image
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
