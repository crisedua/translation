import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Standard field mappings (same as analyze-template)
const STANDARD_MAPPINGS: Record<string, string[]> = {
    "nombres": ["names", "given_names", "reg_names", "first_names", "nombre"],
    "primer_apellido": ["surnames", "first_surname", "reg_1_surname", "apellido1", "surname1"],
    "segundo_apellido": ["surnames", "second_surname", "reg_2_surname", "apellido2", "surname2"],
    "nuip_top": ["nuip", "id_basic_part", "id_add_part"],
    "serial_indicator": ["serial_indicator", "serial", "indicativo"],
    "sexo": ["sex", "sexo", "gender"],
    "grupo_sanguineo": ["blood_type", "blood", "sangre", "tipo_sangre"],
    "factor_rh": ["rh_factor", "rh", "factor"],
    "fecha_nacimiento": ["date_of_birth", "birth_date", "birth_year", "birth_month", "birth_day", "day", "month", "year"],
    "hora_nacimiento": ["time", "birth_time", "hora", "hour"],
    "pais_nacimiento": ["country_birth", "country", "pais", "birth_country_dept_munic"],
    "departamento_nacimiento": ["dept_birth", "department", "dept", "departamento", "birth_country_dept_munic"],
    "municipio_nacimiento": ["muni_birth", "municipality", "muni", "municipio", "birth_country_dept_munic"],
    "lugar_nacimiento": ["township_birth", "birth_place", "place", "lugar"],
    "padre_nombres": ["father_names", "father_surnames_names"],
    "padre_apellidos": ["father_surnames", "father_surnames_names"],
    "padre_identificacion": ["father_doc_number", "father_id_doc", "father_id"],
    "padre_nacionalidad": ["father_nationality"],
    "madre_nombres": ["mother_names", "mother_surnames_names"],
    "madre_apellidos": ["mother_surnames", "mother_surnames_names"],
    "madre_identificacion": ["mother_doc_number", "mother_id_doc", "mother_id_number"],
    "madre_nacionalidad": ["mother_nationality"],
    "declarante_nombres": ["declarant_surnames_names", "declarant_name"],
    "declarante_identificacion": ["declarant_id_doc", "declarant_id"],
    "testigo1_nombres": ["witness1_surnames_names", "witness1_name"],
    "testigo1_identificacion": ["witness1_id_doc", "witness1_id"],
    "testigo2_nombres": ["witness2_surnames_names", "witness2_name"],
    "testigo2_identificacion": ["witness2_id_doc", "witness2_id"],
    "oficina": ["office_type", "notary_number", "office"],
    "numero_oficina": ["notary_number", "office_number"],
    "departamento_registro": ["dept_office", "country_dept_munic"],
    "municipio_registro": ["muni_office", "country_dept_munic"],
    "fecha_registro": ["date_registration", "date_registered", "reg_year", "reg_month", "reg_day"],
    "codigo": ["reg_code", "code", "qr_code"],
    "acta": ["birth_cert_number", "cert_number"],
    "notas": ["notes1", "notes2", "notes3", "notes4", "notes5", "notes6", "notes7", "notes"],
    "margin_notes": ["notes1", "notes2", "notes3", "notes4", "notes5", "notes6", "notes7"],
    "authorizing_official": ["official_name&signature", "official_name"],
    "acknowledgment_official": ["ack_official_name&signature", "ack_official"],
    "funcionario_nombre": ["official_name&signature", "name_director"],
    "tipo_documento_anterior": ["prior_doc", "prior_document"]
};

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

            for (const pdfField of normalizedPdfFields) {
                if (pdfField.normalized === normalizedPattern) {
                    if (!matchingFields.includes(pdfField.original)) {
                        matchingFields.push(pdfField.original);
                    }
                } else if (pdfField.normalized.includes(normalizedPattern) ||
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

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { templateId } = await req.json();

        if (!templateId) {
            throw new Error("templateId is required");
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`RE-ANALYZING TEMPLATE: ${templateId}`);
        console.log('='.repeat(60));

        // 1. Fetch the existing template
        const { data: template, error: fetchError } = await supabase
            .from('document_templates')
            .select('*')
            .eq('id', templateId)
            .single();

        if (fetchError || !template) {
            throw new Error(`Template not found: ${fetchError?.message}`);
        }

        const templateUrl = template.template_file_url;
        const templateName = template.name;

        console.log(`Template: ${templateName}`);
        console.log(`URL: ${templateUrl}`);

        // 2. Download the template PDF
        console.log("\n[1/4] Downloading template PDF...");
        const pdfResponse = await fetch(templateUrl);
        if (!pdfResponse.ok) {
            throw new Error("Failed to download template PDF");
        }
        const pdfBuffer = await pdfResponse.arrayBuffer();
        console.log(`   ✓ Downloaded: ${pdfBuffer.byteLength} bytes`);

        // 3. Extract PDF Form Fields
        console.log("\n[2/4] Extracting PDF form fields...");
        let pdfFieldNames: string[] = [];
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const form = pdfDoc.getForm();
            const fields = form.getFields();
            pdfFieldNames = fields.map(f => f.getName());
            console.log(`   ✓ Found ${pdfFieldNames.length} PDF form fields`);
        } catch (e) {
            console.warn("   ⚠ No PDF form fields found");
        }

        // 4. Generate field mappings
        console.log("\n[3/4] Generating field mappings...");
        let pdfMappings = createMappingsFromPDFFields(pdfFieldNames);
        console.log(`   ✓ Generated ${Object.keys(pdfMappings).length} mappings`);

        // 5. Update field_definitions based on mappings
        const fieldDefinitions = Object.keys(pdfMappings).map(fieldName => ({
            name: fieldName,
            description: `Extracted field: ${fieldName}`,
            type: "text"
        }));

        // 6. Update the template in database
        console.log("\n[4/4] Updating template in database...");

        const existingProfile = template.content_profile || {};

        const { error: updateError } = await supabase
            .from('document_templates')
            .update({
                field_definitions: fieldDefinitions,
                content_profile: {
                    ...existingProfile,
                    pdf_mappings: pdfMappings,
                    pdfFields: pdfFieldNames,
                    pdfFieldCount: pdfFieldNames.length,
                    mappingCount: Object.keys(pdfMappings).length,
                    reanalyzedAt: new Date().toISOString()
                }
            })
            .eq('id', templateId);

        if (updateError) {
            throw new Error(`Failed to update template: ${updateError.message}`);
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`✓ TEMPLATE RE-ANALYZED SUCCESSFULLY`);
        console.log('='.repeat(60));
        console.log(`   PDF Fields: ${pdfFieldNames.length}`);
        console.log(`   Field Mappings: ${Object.keys(pdfMappings).length}`);
        console.log('='.repeat(60) + '\n');

        return new Response(JSON.stringify({
            success: true,
            templateId,
            pdfFieldCount: pdfFieldNames.length,
            mappingCount: Object.keys(pdfMappings).length,
            pdfFields: pdfFieldNames,
            mappings: pdfMappings
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error("\n❌ RE-ANALYZE ERROR:", error.message);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
