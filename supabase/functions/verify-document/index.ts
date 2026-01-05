import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Verify Document Function
 * 
 * Compares the generated PDF field values against the extracted data (source of truth).
 * Returns a detailed report of matches and mismatches.
 */
serve(async (req) => {
    console.log("=== VERIFY-DOCUMENT FUNCTION INVOKED ===");

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { requestId } = await req.json();

        if (!requestId) {
            throw new Error("Missing requestId parameter");
        }

        console.log(`Verifying document for request: ${requestId}`);

        // 1. Fetch the request with extracted data
        const { data: request, error: reqError } = await supabase
            .from('document_requests')
            .select('*, document_templates(*)')
            .eq('id', requestId)
            .single();

        if (reqError || !request) {
            throw new Error(`Request not found: ${reqError?.message}`);
        }

        const extractedData = request.extracted_data;
        const generatedUrl = request.generated_document_url;

        if (!extractedData || Object.keys(extractedData).length === 0) {
            throw new Error("No extracted data found for this request");
        }

        if (!generatedUrl) {
            throw new Error("No generated document found. Please generate the document first.");
        }

        // 2. Download the generated PDF
        console.log("Downloading generated PDF...");
        let pdfBytes: ArrayBuffer;

        // Parse the storage path from the URL
        const match = generatedUrl.match(/\/storage\/v1\/object\/(?:sign|public)\/([^\/]+)\/(.+?)(?:\?|$)/);

        if (match) {
            const bucket = match[1];
            const path = decodeURIComponent(match[2]);
            console.log(`Downloading from bucket: ${bucket}, path: ${path}`);

            const { data: fileData, error: fileError } = await supabase
                .storage
                .from(bucket)
                .download(path);

            if (fileError) {
                // Fallback to fetch
                console.warn("Storage download failed, trying fetch...", fileError);
                const res = await fetch(generatedUrl);
                if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.statusText}`);
                pdfBytes = await res.arrayBuffer();
            } else {
                pdfBytes = await fileData.arrayBuffer();
            }
        } else {
            // Direct fetch
            const res = await fetch(generatedUrl);
            if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.statusText}`);
            pdfBytes = await res.arrayBuffer();
        }

        console.log(`PDF loaded, size: ${pdfBytes.byteLength} bytes`);

        // 3. Load PDF and read field values
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        // Build a map of PDF field name -> current value
        const pdfFieldValues: Record<string, string> = {};
        for (const field of fields) {
            const name = field.getName();
            try {
                const textField = form.getTextField(name);
                pdfFieldValues[name] = textField.getText() || '';
            } catch {
                // Not a text field, skip
                pdfFieldValues[name] = '[non-text field]';
            }
        }

        console.log(`Found ${Object.keys(pdfFieldValues).length} PDF fields`);

        // 4. Compare extracted data against PDF field values
        const matches: Array<{ extractedKey: string; pdfField: string; value: string }> = [];
        const mismatches: Array<{
            extractedKey: string;
            expectedValue: string;
            pdfField: string;
            actualValue: string;
        }> = [];
        const unmapped: Array<{ extractedKey: string; expectedValue: string }> = [];

        // Helper to normalize values for comparison
        const normalize = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

        // Helper to find which PDF field contains a value
        const findPdfFieldWithValue = (expectedValue: string): { field: string; value: string } | null => {
            const normalizedExpected = normalize(expectedValue);
            if (!normalizedExpected) return null;

            for (const [fieldName, fieldValue] of Object.entries(pdfFieldValues)) {
                const normalizedActual = normalize(fieldValue);
                if (normalizedActual === normalizedExpected ||
                    normalizedActual.includes(normalizedExpected) ||
                    normalizedExpected.includes(normalizedActual)) {
                    return { field: fieldName, value: fieldValue };
                }
            }
            return null;
        };

        // Check each extracted field
        for (const [key, value] of Object.entries(extractedData)) {
            if (value === null || value === undefined || String(value).trim() === '') {
                continue; // Skip empty values
            }

            const strValue = String(value).trim();

            // Skip internal/virtual fields
            const lowerKey = key.toLowerCase();
            if (lowerKey.endsWith('_combined') ||
                lowerKey.endsWith('_resolved') ||
                lowerKey.endsWith('_top') ||
                lowerKey.endsWith('_raw') ||
                lowerKey.startsWith('notes_line')) {
                continue;
            }

            // Try to find this value in the PDF
            const pdfMatch = findPdfFieldWithValue(strValue);

            if (pdfMatch) {
                matches.push({
                    extractedKey: key,
                    pdfField: pdfMatch.field,
                    value: strValue
                });
            } else {
                // Check if there's a direct field match by name
                const directMatch = Object.keys(pdfFieldValues).find(
                    f => normalize(f) === normalize(key)
                );

                if (directMatch) {
                    const actualValue = pdfFieldValues[directMatch];
                    if (normalize(actualValue) !== normalize(strValue)) {
                        mismatches.push({
                            extractedKey: key,
                            expectedValue: strValue,
                            pdfField: directMatch,
                            actualValue: actualValue
                        });
                    } else {
                        matches.push({
                            extractedKey: key,
                            pdfField: directMatch,
                            value: strValue
                        });
                    }
                } else {
                    // No match found anywhere
                    unmapped.push({
                        extractedKey: key,
                        expectedValue: strValue
                    });
                }
            }
        }

        console.log(`Verification complete: ${matches.length} matches, ${mismatches.length} mismatches, ${unmapped.length} unmapped`);

        // 5. Return verification report
        return new Response(
            JSON.stringify({
                success: true,
                requestId,
                verification: {
                    totalExtractedFields: Object.keys(extractedData).length,
                    matches: matches.length,
                    mismatches: mismatches.length,
                    unmapped: unmapped.length,
                    details: {
                        matches,
                        mismatches,
                        unmapped
                    }
                },
                pdfFields: Object.keys(pdfFieldValues)
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );

    } catch (error) {
        console.error("Error verifying document:", error);

        const errorMessage = error instanceof Error ? error.message : String(error);

        return new Response(
            JSON.stringify({
                success: false,
                error: errorMessage
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
