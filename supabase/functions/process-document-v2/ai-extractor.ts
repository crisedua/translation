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

    // Registry location - Copy form field value as-is
    "registry_location_combined": "CRITICAL: Extract EXACTLY what appears in the 'Pais-Departamento-Municipio' or 'Country - Department - Municipality' form field. This is a SINGLE field - copy its complete value as-is (e.g., 'COLOMBIA.VALLE.CALI' or just 'COLOMBIA'). Do NOT parse, split, or combine.",
    "country_dept_munic": "CRITICAL: Extract EXACTLY what appears in the 'Pais-Departamento-Municipio' or 'Country - Department - Municipality' form field. This is a SINGLE field - copy its complete value as-is (e.g., 'COLOMBIA.VALLE.CALI' or just 'COLOMBIA'). Do NOT parse, split, or combine.",

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
    "fecha_nacimiento": "Extract date EXACTLY as written. If it uses numbers (e.g., '08'), extract '08'. DO NOT convert numbers to month names.",
    "fecha_registro": "Extract registration date EXACTLY as written. DO NOT convert numbers to month names.",
    "birth_month": "Extract numeric month ONLY (e.g., '08'). DO NOT convert to name.",
    "reg_month": "Extract numeric month ONLY (e.g., '08'). DO NOT convert to name.",
    "issue_month": "Extract numeric month ONLY (e.g., '08'). DO NOT convert to name.",

    // Notes - Extract EACH LINE of ESPACIO PARA NOTAS separately
    "margin_notes": "Extract ALL text from 'ESPACIO PARA NOTAS' section.",
    "notas": "Extract all notes, annotations, and stamped identifiers.",
    "notes_combined": "Extract ALL text from 'ESPACIO PARA NOTAS'.",
    "nuip_notes": "CRITICAL: Look in the 'ESPACIO PARA NOTAS' section for a NUIP NUMBER. This is usually a 10-digit number like '1006205637'. Extract ONLY the number itself.",
    "notes_line1": "Extract ONLY the text on the FIRST LINE of 'ESPACIO PARA NOTAS'. If empty, return empty string.",
    "notes_line2": "Extract ONLY the text on the SECOND LINE of 'ESPACIO PARA NOTAS'. This is where the main NUIP statement usually appears.",
    "notes_line3": "Extract ONLY the text on the THIRD LINE of 'ESPACIO PARA NOTAS'. If empty, return empty string.",
    "notes_line4": "Extract ONLY the text on the FOURTH LINE of 'ESPACIO PARA NOTAS'. This often has 'NUIP NUEVO. [number]' and handwritten numbers.",
    "notes_line5": "Extract ONLY the text on the FIFTH LINE of 'ESPACIO PARA NOTAS'. If empty, return empty string.",
    "notes_line6": "Extract ONLY the text on the SIXTH LINE of 'ESPACIO PARA NOTAS'. If empty, return empty string.",
    "notes_line7": "Extract ONLY the text on the SEVENTH LINE of 'ESPACIO PARA NOTAS'. If empty, return empty string.",

    // Other identifiers
    "serial_indicator": "Extract complete 'Indicativo Serial' number (e.g., '29734419')",
    "codigo": "Extract complete code - may have parts like '97 0 2' (combine to '9702')",
    "numero_oficina": "Extract ONLY the numeric Notary/Office Number. Example: '21' (just the number). Look near 'NOTARIA' or 'OFICINA' and extract ONLY the digits, NOT the word 'NOTARIA'. If it says 'NOTARIA 21', extract just '21'.",
    "notary_number": "Extract the Notary or Office NUMBER from the 'Número' field. Should be just digits like '21'. Look in 'Datos de la oficina de registro' section.",
    "oficina": "Extract the type and name of the office (e.g., 'NOTARIA 21 CALI').",
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
            "primer_apellido": "Extract from the FIRST box labeled 'Primer Apellido' in the registrant section (Datos del Inscrito). Extract ONLY the text from this box. Example: 'QUEVEDO'.",
            "segundo_apellido": "Extract from the SECOND box labeled 'Segundo Apellido' in the registrant section (Datos del Inscrito). Extract ONLY the text from this box. Example: 'HERRERA'.",
            "madre_primer_apellido": "In the mother section, find the FIRST box labeled 'Primer Apellido'. Extract ONLY from this box. Example: 'HERRERA'.",
            "madre_segundo_apellido": "In the mother section, find the SECOND box labeled 'Segundo Apellido'. Extract ONLY from this box. Example: 'HERRERA'.",
            "madre_apellidos": "Extract the combined text of Primer AND Segundo Apellido. If they are the same, include BOTH (e.g. 'HERRERA HERRERA'). Do NOT deduplicate.",
            "madre_nombre_completo_raw": "CRITICAL: Extract the EXACT FULL TEXT from the line 'Apellidos y nombres completos' in the Mother's section. Copy it as-is (e.g., 'HERRERA HERRERA ALBA YOLANDA').",
            "padre_primer_apellido": "In the father section, find the FIRST box labeled 'Primer Apellido'. Extract ONLY from this box. Example: 'QUEVEDO'.",
            "padre_segundo_apellido": "In the father section, find the SECOND box labeled 'Segundo Apellido'. Extract ONLY from this box. Example: 'MEDINA'.",
            "padre_apellidos": "Extract the combined text of Primer AND Segundo Apellido. If they are the same, include BOTH. Do NOT deduplicate.",
            "padre_nombre_completo_raw": "CRITICAL: Extract the EXACT FULL TEXT from the line 'Apellidos y nombres completos' in the Father's section. Copy it as-is.",
            "declarante_nombre_completo_raw": "CRITICAL: Extract the EXACT FULL TEXT from the line 'Apellidos y nombres completos' in the Declarant's section. Copy it as-is.",
            "lugar_nacimiento": "LOCATED in the row starting with 'Fecha de nacimiento'. Look for the wide box labeled 'Lugar de nacimiento'. Extract the ENTIRE text including clinic name and parentheses (e.g., 'CLINICA ... (COLOMBIA...)').",
            "fecha_nacimiento": "Extract EXACTLY what is written. If the month is '08', extract '08'. DO NOT convert to 'Agosto' or 'August'.",
            "fecha_registro": "Extract EXACTLY what is written. DO NOT convert numbers to month names.",
            "nuip": "Located in the top right or within the header. EXTRACT THE FULL ALPHANUMERIC STRING including any letters like 'V2A'. Example: 'V2A2692167'.",
            "serial_indicator": "Often found near the NUIP or barcode. Extract just the number.",
            "margin_notes": "CRITICAL: Look at the BOTTOM of the document in the 'ESPACIO PARA NOTAS' section. Extract EVERY SINGLE CHARACTER you see, including: 1) The full stamped text like 'NUIP OTORGADO POR LA REGISTRADURIA NACIONAL DEL ESTADO CIVIL 26 FEBRERO 2003' 2) The NUIP number line like 'NUIP NUEVO. 1006205637' - YOU MUST INCLUDE THE NUMBER. Example output: 'NUIP OTORGADO POR LA REGISTRADURIA NACIONAL DEL ESTADO CIVIL 26 FEBRERO 2003. NUIP NUEVO. 1006205637'. Do NOT truncate or skip the number.",
            "notas": "Extract ALL text from notes including the complete NUIP number (e.g., '1006205637'). Do NOT skip numbers.",
            "notes_combined": "Extract COMPLETE text from 'ESPACIO PARA NOTAS'. MUST include full NUIP stamp with number like 'NUIP NUEVO. 1006205637'.",
            "notes_line1": "ESPACIO PARA NOTAS - LINE 1: Usually empty or contains a header. Extract what you see.",
            "notes_line2": "ESPACIO PARA NOTAS - LINE 2: Often contains text like 'NUIP OTORGADO POR LA REGISTRADURIA NACIONAL DEL ESTADO CIVIL [date]'. Extract the full line.",
            "notes_line3": "ESPACIO PARA NOTAS - LINE 3: May be empty or continue from line 2. Extract what you see.",
            "notes_line4": "ESPACIO PARA NOTAS - LINE 4: CRITICAL - This often has 'NUIP NUEVO. [10-digit number]' AND a HANDWRITTEN number below it (like '1006205637'). YOU MUST extract BOTH the typed and handwritten text. Example: 'NUIP NUEVO. 1006205637 1006205637'",
            "nuip_notes": "CRITICAL: In the 'ESPACIO PARA NOTAS' section, look for a 10-digit HANDWRITTEN number. It may appear as large handwritten digits like '1006205637'. Extract ONLY the number itself.",
            "numero_oficina": "Look for 'Datos de la oficina de registro' section. Find the field labeled 'Número' (next to the Registraduría/Notaría checkboxes). Extract ONLY the number from this field (e.g., '21').",
            "notary_number": "CRITICAL: In 'Datos de la oficina de registro' section, find the small box labeled 'Número'. Extract the number inside it (e.g., '21'). This is next to the Notaría/Registraduría checkboxes.",
            "tipo_oficina": "Look for 'Datos de la oficina de registro' section. Check which box has an X mark: 'Registraduría' or 'Notaría'. Return the name of the checked option (e.g., 'Notaría' if that box has X)."
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
            "fecha_expedicion": "VISION INSTRUCTION: Look at the document image. Scroll/look to the LAST page, BOTTOM section. You will see a dark blue bar labeled 'Fecha de expedición'. BELOW this bar are THREE cyan input boxes. Extract ONLY from these bottom boxes. IGNORE everything above the middle of the page. The 'Date of Birth' is in the middle/top - DO NOT use it. Return format: DD-MM-YYYY from the FOOTER ONLY.",
            "issue_day": "Extract ONLY from BOTTOM footer 'Día' box under 'Fecha de expedición' label (NOT birth day which is higher up on page).",
            "issue_month": "Extract ONLY from BOTTOM footer 'Mes' box under 'Fecha de expedición' label (NOT birth month which is higher up on page).",
            "issue_year": "Extract ONLY from BOTTOM footer 'Año' box under 'Fecha de expedición' label (NOT birth year which is higher up on page). Footer year is typically 2020+.",

            // STRICT BIRTH LOCATION INSTRUCTIONS - CRITICAL FIX
            // The OCR often merges "COLOMBIA - VALLE DEL CAUCA - CALI" into one line.
            // You MUST parse and split this text correctly into separate fields.
            "pais_nacimiento": "CRITICAL: Extract ONLY the COUNTRY name (first word before any dash/hyphen). Examples: 'COLOMBIA' from 'COLOMBIA - VALLE DEL CAUCA'. Return ONLY 'COLOMBIA', never include department or municipality.",
            "departamento_nacimiento": "CRITICAL: Extract ONLY the DEPARTMENT name (second segment after first dash). Examples: 'VALLE DEL CAUCA' from 'COLOMBIA - VALLE DEL CAUCA - CALI'. Do NOT include country or municipality.",
            "municipio_nacimiento": "CRITICAL: Extract ONLY the MUNICIPALITY name (third segment or last segment). Examples: 'CALI' from 'COLOMBIA - VALLE DEL CAUCA - CALI'. Do NOT include country or department.",
            "lugar_nacimiento": "CRITICAL: Look at the 'Corregimiento/Township' field. If it shows '---' (three dashes), return EMPTY STRING ''. Only extract actual township name if present (like 'CORREGIMIENTO X').",
            "township_birth": "CRITICAL: Look at the 'Corregimiento / Insp. de Policía' field. If it shows '---' (three dashes), return EMPTY STRING ''. The '---' means the field is BLANK. Only return text if there's an actual township name.",
            // Alternate PDF field names for birth location
            "country_birth": "CRITICAL: Extract ONLY the COUNTRY name. Return 'COLOMBIA' - do NOT include department or municipality.",
            "dept_birth": "CRITICAL: Extract ONLY the DEPARTMENT name (e.g., 'VALLE DEL CAUCA'). Do NOT include country or municipality.",
            "muni_birth": "CRITICAL: Extract ONLY the MUNICIPALITY name (e.g., 'CALI'). Do NOT include country or department.",

            // REGISTRY OFFICE LOCATION (Top of form) - Ensure we target this specifically
            "departamento_registro": "In 'Información de la oficina de registro' (Registry Office Info) section (TOP of page): Extract 'Departamento'.",
            "municipio_registro": "In 'Información de la oficina de registro' (Registry Office Info) section (TOP of page): Extract 'Municipio'.",
            "oficina": "In 'Información de la oficina de registro': Extract 'Tipo de oficina / Oficina' (e.g., 'NOTARIA / NOTARIA PRIMERA').",

            // STRICT PARENT NAME EXTRACTION
            // Mother's Information - SEPARATE Names from Surnames
            "madre_nombres": "CRITICAL: In 'Datos de la madre' (Mother's Information) section, look for the box labeled 'Nombres' (Names/Given Names). Extract ONLY the GIVEN NAMES from this box (e.g., 'SARA' or 'ALBA YOLANDA'). Do NOT include surnames.",
            "madre_apellidos": "CRITICAL: In 'Datos de la madre' (Mother's Information) section, look for the box labeled 'Apellidos' (Surnames). Extract ONLY the SURNAMES from this box (e.g., 'BOTERO GOMEZ'). Do NOT include given names.",

            // Father's Information - SEPARATE Names from Surnames
            "padre_nombres": "CRITICAL: In 'Datos del padre' (Father's Information) section, look for the box labeled 'Nombres' (Names/Given Names). Extract ONLY the GIVEN NAMES from this box (e.g., 'BERNARDO JULIAN'). Do NOT include surnames.",
            "padre_apellidos": "CRITICAL: In 'Datos del padre' (Father's Information) section, look for the box labeled 'Apellidos' (Surnames). Extract ONLY the SURNAMES from this box (e.g., 'TOBAR PRADO'). Do NOT include given names."
        };
        // Merge overrides into template instructions (overwriting DB values if present)
        templateInstructions = { ...templateInstructions, ...nuevoOverrides };
    }
    // === END OVERRIDE ===

    // =========================================================================
    // ROBUST FIELD CATEGORIZATION FOR FUTURE TEMPLATES
    // Auto-generates smart extraction instructions based on PDF field names
    // =========================================================================

    const FIELD_CATEGORIES: Record<string, RegExp> = {
        identity: /nuip|serial|code|cedula|documento|id_|identificacion/i,
        names: /nombre|name|apellido|surname|full_name|completo/i,
        location: /pais|country|depart|munic|township|lugar|nacimiento|birth|corregimiento/i,
        dates: /fecha|date|day|month|year|dia|mes|año|expedicion|registro|issue/i,
        parents: /padre|madre|father|mother|parent|dad|mom/i,
        officials: /official|funcionario|notary|registra|firma|signature/i,
        notes: /nota|note|margin|space|observ|espacio/i
    };

    const CATEGORY_PROMPTS: Record<string, (field: string) => string> = {
        identity: (field) => `Extract the complete ${field} value. Include ALL characters including leading letters (e.g., 'V2A1234567' not just '1234567').`,

        names: (field) => {
            if (field.includes('apellido') || field.includes('surname')) {
                return `Extract ONLY the surnames for ${field}. Do NOT include given names.`;
            }
            if (field.includes('nombre') || field.includes('name')) {
                return `Extract ONLY the given names for ${field}. Do NOT include surnames.`;
            }
            return `Extract the complete name value for ${field}.`;
        },

        location: (field) => {
            if (field.includes('pais') || field.includes('country')) {
                return `Extract ONLY the COUNTRY name. If you see "COLOMBIA - VALLE DEL CAUCA - CALI", extract ONLY "COLOMBIA".`;
            }
            if (field.includes('depart')) {
                return `Extract ONLY the DEPARTMENT name. If you see "COLOMBIA - VALLE DEL CAUCA - CALI", extract ONLY "VALLE DEL CAUCA".`;
            }
            if (field.includes('munic')) {
                return `Extract ONLY the MUNICIPALITY name. If you see "COLOMBIA - VALLE DEL CAUCA - CALI", extract ONLY "CALI".`;
            }
            if (field.includes('township') || field.includes('corregimiento')) {
                return `Extract the township/corregimiento. If it shows "---" or is blank, return empty string.`;
            }
            return `Extract the complete location for ${field}. If combined (e.g., "COLOMBIA - DEPT - MUNIC"), include all parts.`;
        },

        dates: (field) => {
            if (field.includes('day') || field.includes('dia')) {
                return `Extract ONLY the day number (01-31). Just the number, no text.`;
            }
            if (field.includes('month') || field.includes('mes')) {
                return `Extract ONLY the month number (01-12). Convert month names to numbers if needed.`;
            }
            if (field.includes('year') || field.includes('año')) {
                return `Extract ONLY the year (e.g., "2024"). Just the 4-digit number.`;
            }
            return `Extract the date for ${field}. Format: DD-MM-YYYY or as shown in document.`;
        },

        parents: (field) => {
            const parent = field.includes('padre') || field.includes('father') ? "father" : "mother";
            if (field.includes('nombre') || field.includes('name')) {
                return `Extract ONLY the ${parent}'s given names from the 'Nombres' box. Do NOT include surnames.`;
            }
            if (field.includes('apellido') || field.includes('surname')) {
                return `Extract ONLY the ${parent}'s surnames from the 'Apellidos' box. Do NOT include given names.`;
            }
            return `Extract the ${parent}'s information for ${field}.`;
        },

        officials: (field) => `Extract the COMPLETE official name for ${field}. Include ALL name parts - officials often have 3-4+ name parts.`,

        notes: (field) => `Extract ALL text from the notes section for ${field}. Include stamps, handwritten text, and NUIP numbers.`,

        default: (field) => `Extract the value for "${field}" from the document.`
    };

    function detectCategory(fieldName: string): string {
        for (const [category, pattern] of Object.entries(FIELD_CATEGORIES)) {
            if (pattern.test(fieldName)) {
                return category;
            }
        }
        return 'default';
    }

    function getSmartPrompt(fieldName: string): string {
        const category = detectCategory(fieldName);
        const promptFn = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.default;
        return promptFn(fieldName);
    }

    // For templates without specific overrides, generate smart instructions from PDF fields
    const pdfFieldsFromTemplate = template?.content_profile?.pdfFields || [];
    if (pdfFieldsFromTemplate.length > 0 && Object.keys(templateInstructions).length === 0) {
        console.log("[AI-EXTRACTOR] No template-specific overrides found - using robust field categorization");
        for (const field of pdfFieldsFromTemplate) {
            if (!templateInstructions[field]) {
                templateInstructions[field] = getSmartPrompt(field);
            }
        }
        console.log(`[AI-EXTRACTOR] Generated smart instructions for ${pdfFieldsFromTemplate.length} fields`);
    }
    // =========================================================================
    // END ROBUST FIELD CATEGORIZATION
    // =========================================================================

    // Combine all field sources (unique)
    // IMPORTANT: Include database-stored PDF fields if available (Template-Driven Extraction)
    const storedPdfFields = template?.content_profile?.pdfFields || [];
    if (storedPdfFields.length > 0) {
        console.log(`[AI-EXTRACTOR] Found ${storedPdfFields.length} stored PDF fields from template analysis`);
    }

    const allTemplateFields = [...new Set([
        ...pdfFields,
        ...mappingKeys,
        ...definedFieldNames,
        ...storedPdfFields // Add the stored PDF fields
    ])];

    const CRITICAL_FIELDS = [
        "nuip", "nuip_top", "serial_indicator",
        "nombres", "primer_apellido", "segundo_apellido",
        "padre_nombres", "padre_apellidos", "padre_primer_apellido", "padre_segundo_apellido",
        "madre_nombres", "madre_apellidos", "madre_primer_apellido", "madre_segundo_apellido",
        "lugar_nacimiento", "birth_location_combined",
        "registry_location_combined", "country_dept_munic",
        "authorizing_official", "fecha_nacimiento", "fecha_registro",
        "fecha_expedicion", "issue_day", "issue_month", "issue_year",  // Date of Issue fields
        "birth_day", "birth_month", "birth_year", // Date of Birth fields
        "reg_day", "reg_month", "reg_year", // Registration Date fields
        "sexo", "grupo_sanguineo", "factor_rh",
        "pais_nacimiento", "departamento_nacimiento", "municipio_nacimiento", "township_birth", "corregimiento", "lugar_nacimiento",
        "country_birth", "dept_birth", "muni_birth",  // PDF template field names for birth location
        "oficina", "numero_oficina", "notary_number",
        "margin_notes", "notas", "notes_combined", "nuip_notes",
        "notes_line1", "notes_line2", "notes_line3", "notes_line4", "notes_line5", "notes_line6", "notes_line7"  // Individual notes lines
    ];

    // Merge template fields with critical fields (critical fields always included)
    // IMPORTANT: Template PDF fields take priority - they are the actual target field names
    const targetFields = [...new Set([
        ...storedPdfFields,     // PRIORITY 1: Actual PDF field names from template
        ...CRITICAL_FIELDS,     // PRIORITY 2: Critical fields we always need
        ...allTemplateFields    // PRIORITY 3: Other template-defined fields
    ])];

    console.log(`[AI-EXTRACTOR] === FIELD DETECTION SUMMARY ===`);
    console.log(`[AI-EXTRACTOR] Template PDF Fields: ${storedPdfFields.length}`);
    if (storedPdfFields.length > 0) {
        console.log(`[AI-EXTRACTOR] PDF Fields sample: ${storedPdfFields.slice(0, 10).join(', ')}...`);
    }
    console.log(`[AI-EXTRACTOR] Critical Fields: ${CRITICAL_FIELDS.length}`);
    console.log(`[AI-EXTRACTOR] Total Target Fields: ${targetFields.length}`);


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

### 3. PLACE OF BIRTH (ATOMIC EXTRACTION - CRITICAL)
- pais_nacimiento: COUNTRY ONLY (e.g., "COLOMBIA") - first segment before dash
- departamento_nacimiento: DEPARTMENT ONLY (e.g., "VALLE DEL CAUCA") - second segment
- municipio_nacimiento: MUNICIPALITY ONLY (e.g., "CALI") - third segment
- lugar_nacimiento / township_birth: TOWNSHIP ONLY - if shows "---" return ""
- birth_location_combined: Full combined string for templates that need it
- If OCR shows "COLOMBIA - VALLE DEL CAUCA - CALI", split into separate fields!

### 4. OFFICIAL NAMES (COMPLETE - NO TRUNCATION)
- authorizing_official / funcionario_nombre: Extract ALL name parts
- Officials have 3-4+ name parts - extract ALL of them
- Example: "HOLMES RACEL CAROLINA MONTOYA" NOT just "HOLMES"
- Look near "Nombre y firma del funcionario"

### 5. REGISTRY LOCATION - COPY FORM FIELD AS-IS
- registry_location_combined: Extract EXACTLY what you see in the form field
- This is a SINGLE field - copy its value exactly (may be "COLOMBIA.VALLE.CALI" or just "COLOMBIA")
- Do NOT parse, split, or modify the value

### 6. EMPTY FIELD DETECTION (CRITICAL)
- If a field shows "---", "-", "N/A", or is visually blank/empty, return EMPTY STRING ""
- The "---" symbol is a STANDARD empty field indicator in Colombian documents
- DO NOT guess or fill in data for empty fields
- DO NOT copy data from other fields into empty fields
- Township/Corregimiento: This field usually shows "---" which means EMPTY - return ""

Return a JSON object with the exact field names listed above.`;


    const userPrompt = fileUrl
        ? `Extract data from this document image following the field instructions exactly.

CRITICAL REMINDERS - COMMON ERRORS TO AVOID:
1. NUIP: Must include leading letters (e.g., 'V2A0001156' not '0001156')
2. segundo_apellido: NEVER empty - it's in the box NEXT TO primer_apellido (e.g., 'HERRERA')
3. lugar_nacimiento: Include FULL clinic name + location (e.g., 'CLINICA MATERNO INFANTIL FARALLONES (COLOMBIA.VALLE.CALI)')
4. authorizing_official: Include ALL name parts (e.g., 'HOLMES RACEL CAROLINA MONTOYA' not just 'HOLMES')
5. registry_location_combined: Copy the form field value exactly as written (e.g., 'COLOMBIA.VALLE.CALI' or 'COLOMBIA')
6. NOTES (margin_notes/notas/notes_combined): The 'ESPACIO PARA NOTAS' section has MULTIPLE LINES. Extract ALL lines and combine them with newlines. Example: Line 1: 'NUIP OTORGADO POR LA REGISTRADURIA NACIONAL DEL ESTADO CIVIL 26 FEBRERO 2003. NUIP NUEVO.' Line 2: '1006205637' - Combine as: 'NUIP OTORGADO POR LA REGISTRADURIA NACIONAL DEL ESTADO CIVIL 26 FEBRERO 2003. NUIP NUEVO.\n1006205637'

Return JSON.`
        : `Extract data from this OCR text following the field instructions exactly:

${text.substring(0, 20000)}

CRITICAL REMINDERS - COMMON ERRORS TO AVOID:
1. NUIP: Must include leading letters (e.g., 'V2A0001156' not '0001156')
2. segundo_apellido: NEVER empty - found in 'Segundo Apellido' column (e.g., 'HERRERA')
3. lugar_nacimiento: Include FULL clinic name + location (e.g., 'CLINICA MATERNO INFANTIL FARALLONES (COLOMBIA.VALLE.CALI)')
4. authorizing_official: Include ALL name parts (e.g., 'HOLMES RACEL CAROLINA MONTOYA' not just 'HOLMES')
5. registry_location_combined: Copy the form field value exactly as written (e.g., 'COLOMBIA.VALLE.CALI' or 'COLOMBIA')

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

            // === FORCE SPLIT LOCATION DATA ===
            // If pais_nacimiento contains " - " it's combined data - split it!
            const country = extractedData.pais_nacimiento || '';
            if (country.includes(' - ') || country.includes(' – ') || country.includes('.')) {
                console.log(`[AI-EXTRACTOR] DETECTED COMBINED COUNTRY: "${country}" - SPLITTING...`);

                // Split by various separators
                const separator = country.includes(' - ') ? ' - ' :
                    country.includes(' – ') ? ' – ' :
                        country.includes('.') ? '.' : ' - ';
                const parts = country.split(separator).map(p => p.trim()).filter(p => p);

                if (parts.length >= 1) {
                    extractedData.pais_nacimiento = parts[0]; // First part = Country
                    console.log(`[AI-EXTRACTOR] SPLIT -> pais_nacimiento: "${parts[0]}"`);
                }
                if (parts.length >= 2 && (!extractedData.departamento_nacimiento || extractedData.departamento_nacimiento.trim() === '')) {
                    extractedData.departamento_nacimiento = parts[1]; // Second part = Department
                    console.log(`[AI-EXTRACTOR] SPLIT -> departamento_nacimiento: "${parts[1]}"`);
                }
                if (parts.length >= 3 && (!extractedData.municipio_nacimiento || extractedData.municipio_nacimiento.trim() === '')) {
                    extractedData.municipio_nacimiento = parts[2]; // Third part = Municipality
                    console.log(`[AI-EXTRACTOR] SPLIT -> municipio_nacimiento: "${parts[2]}"`);
                }
            }

            // === CLEAR TOWNSHIP IF IT CONTAINS EMPTY INDICATOR ===
            // The form uses "---" to indicate empty fields - normalize these to empty string
            const townshipFields = ['township_birth', 'lugar_nacimiento', 'corregimiento'];
            const emptyIndicators = ['---', '--', '-', 'N/A', 'NA', '[EMPTY]', 'EMPTY'];

            for (const fieldName of townshipFields) {
                const fieldValue = (extractedData[fieldName] || '').trim();
                if (fieldValue) {
                    // Check if the value is an empty indicator
                    const isEmptyIndicator = emptyIndicators.some(indicator =>
                        fieldValue.toUpperCase() === indicator ||
                        fieldValue === indicator
                    );

                    if (isEmptyIndicator) {
                        console.log(`[AI-EXTRACTOR] Detected empty indicator "${fieldValue}" in ${fieldName} - clearing`);
                        extractedData[fieldName] = '';
                    }
                }
            }

            // Ensure township_birth field always exists (even if empty)
            if (extractedData.township_birth === undefined) {
                extractedData.township_birth = '';
                console.log(`[AI-EXTRACTOR] Set township_birth = '' (was undefined)`);
            }

            // Log key extractions
            console.log(`[AI-EXTRACTOR] nuip: ${extractedData.nuip || extractedData.nuip_top || 'NOT FOUND'}`);
            console.log(`[AI-EXTRACTOR] primer_apellido: ${extractedData.primer_apellido || 'NOT FOUND'}`);
            console.log(`[AI-EXTRACTOR] segundo_apellido: ${extractedData.segundo_apellido || 'NOT FOUND'}`);
            console.log(`[AI-EXTRACTOR] lugar_nacimiento: ${(extractedData.lugar_nacimiento || 'NOT FOUND').substring(0, 60)}`);
            console.log(`[AI-EXTRACTOR] township_birth: "${extractedData.township_birth || 'NOT FOUND'}"`);
            console.log(`[AI-EXTRACTOR] corregimiento: "${extractedData.corregimiento || 'NOT FOUND'}"`);
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

/**
 * REFINE DATA (VISUAL SELF-CORRECTION)
 * 
 * Re-examines the image to extract specific missing fields.
 * This is a "System 2" pass that specifically targets gaps.
 */
export const refineData = async (
    currentData: ExtractedData,
    visionDataUri: string,
    missingFields: string[]
): Promise<Partial<ExtractedData>> => {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return {};

    console.log(`[VISUAL-CORRECTION] Triggering for ${missingFields.length} missing fields: ${missingFields.join(", ")}`);

    const refinementPrompt = `
    You are a specialized Data Validation Agent.
    
    The previous extraction missed or returned empty values for these SPECIFIC fields:
    ${missingFields.map(f => `- ${f}`).join('\n')}
    
    ## INSTRUCTIONS
    1. Look at the image specifically for these missing fields.
    2. If the field HAS a value in the image, extract it exactly.
    3. If the field is TRULY empty/blank or has "---", confirm it as empty string "".
    
    Return ONLY a JSON object with these specific fields and their corrected values.
    `;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: refinementPrompt
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Fix these missing fields." },
                            {
                                type: "image_url",
                                image_url: {
                                    url: visionDataUri,
                                    detail: "high"
                                }
                            }
                        ]
                    }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
                max_tokens: 1000
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error("[VISUAL-CORRECTION] API Error:", data.error);
            return {};
        }

        const content = data.choices[0].message.content;
        const refinedData = JSON.parse(content);

        console.log(`[VISUAL-CORRECTION] Recovered ${Object.keys(refinedData).length} fields`);
        return refinedData;

    } catch (e) {
        console.error("[VISUAL-CORRECTION] Error:", e);
        return {};
    }
};
