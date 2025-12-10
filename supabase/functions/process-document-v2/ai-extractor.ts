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
- nuip_top (CRITICAL: Look at the VERY TOP and TOP-LEFT of the document. There is often a box labeled "NUIP" or "N.U.I.P." containing text. This value is often ALPHANUMERIC and frequently starts with a letter like 'A' (e.g., "A-12345678", "A0923481", "VA1112083468"). Extract EXACTLY as written, preserving all letters, numbers, and dashes. Do NOT ignore the leading letter 'A'. Do NOT assume it is only digits.)
- nuip_bottom (The NUIP code found at the BOTTOM/SIDE of the document. Usually a 10‑digit numeric value.)

PRIMARY FIELDS (Defined by Template):
${fieldDescriptions.length > 0 ? fieldDescriptions : "No specific template fields defined."}

COMMON FALLBACK FIELDS (Extract if present and not covered above):
## REGISTRANT INFORMATION
- nombres (given names)
- primer_apellido (first surname)
- segundo_apellido (second surname)
- apellidos (full surnames if separate fields not found)
- nuip (Legacy field: Populate with the alphanumeric nuip_top if present, otherwise use nuip_bottom)
- serial_indicator (Serial indicator/code; may appear as a short alphanumeric string)
- sexo (sex/gender: M, F, MASCULINO, FEMENINO, or as found)
- grupo_sanguineo (blood type, e.g., O, A, B, AB)
- factor_rh (Rh factor, e.g., +, -, POSITIVO, NEGATIVO)

## BIRTH DETAILS
- fecha_nacimiento (date of birth - look for "FECHA DE NACIMIENTO" or separate day/month/year fields)
- hora_nacimiento (time of birth - look for "HORA", hour/time near birth date)
- pais_nacimiento (country of birth, default COLOMBIA)
- departamento_nacimiento (department of birth)
- municipio_nacimiento (municipality/city of birth)
- lugar_nacimiento (specific birth place - hospital, clinic name, address, or "DOMICILIO" for home birth)
- vereda (township/vereda)
- corregimiento

## FATHER INFORMATION
- padre_nombres (father's full names)
- padre_apellidos (father's surnames)
- padre_identificacion (father's ID number - CC, TI, passport number)
- padre_tipo_documento (father's document type - CC, TI, PASAPORTE)
- padre_nacionalidad (father's nationality)

## MOTHER INFORMATION
- madre_nombres (mother's full names)
- madre_apellidos (mother's surnames)
- madre_identificacion (mother's ID number - CC, TI, passport number)
- madre_tipo_documento (mother's document type - CC, TI, PASAPORTE)
- madre_nacionalidad (mother's nationality)

## DECLARANT INFORMATION
- declarante_nombres (declarant's full names and surnames)
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
- fecha_registro (date of registration)

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
8. If you find separate Year, Month, Day values, combine them into a single date string (DD/MM/YYYY format).

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
                    { type: "text", text: "Extract ALL data from this Colombian document image. If standard fields are not found, extract whatever you see." },
                    { type: "image_url", image_url: { url: fileUrl } } // Use Vision if fileUrl is provided
                ]
                : `Extract data from this Colombian document:\n\n${text}` // Fallback to text if no image
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
