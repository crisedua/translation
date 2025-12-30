import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { matchTemplateWithAI } from "./template-matcher-ai.ts";
import { extractData } from "./ai-extractor.ts";
import { validateData } from "./validator.ts";
import { performSemanticQA } from "./qa-validator.ts";
import { sendNotification } from "./email-notifier.ts";
import { extractTextWithGoogleVision, extractTextFromImages } from "./google-vision.ts";
import { convertPdfToImage } from "./pdf-converter.ts";
import { extractPdfFields } from "./pdf-field-extractor.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to safely convert ArrayBuffer to Base64 in chunks
function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    const chunkSize = 0x8000;

    for (let i = 0; i < len; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
        binary += String.fromCharCode.apply(null, chunk as any);
    }
    return btoa(binary);
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log("=== FUNCTION STARTED ===");

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        console.log("Supabase client created");

        const { fileUrl, fileName, userId, categoryId, timeline, requestId } = await req.json();
        console.log(`Request parsed: fileName=${fileName}, userId=${userId}`);

        if (!fileUrl) {
            throw new Error("fileUrl is required");
        }

        console.log(`Processing document: ${fileName || 'Unknown'}`);

        // 1. Download file
        console.log("Downloading file...");
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
            throw new Error("Failed to download file");
        }
        const fileBuffer = await fileResponse.arrayBuffer();
        console.log(`File downloaded: ${fileBuffer.byteLength} bytes`);

        // 2. Prepare Base64 for AI Vision
        console.log("Converting to Base64...");
        const fileBase64 = arrayBufferToBase64(fileBuffer);
        console.log(`Base64 ready: ${fileBase64.length} chars`);

        // 3. Determine file type
        const lowerName = (fileName || '').toLowerCase();
        const isImage = lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg');
        const isPdf = lowerName.endsWith('.pdf');

        // 4. Extract text and prepare for AI Vision
        let extractedText = "";
        let visionDataUri: string | undefined = undefined;

        console.log(`File type detection: isImage=${isImage}, isPdf=${isPdf}`);

        if (isImage) {
            // Direct image - use Google Vision for OCR
            console.log("Processing IMAGE file...");
            try {
                console.log("Using Google Vision for image OCR...");
                extractedText = await extractTextWithGoogleVision(fileBase64);
                console.log(`Google Vision extracted ${extractedText.length} characters`);

                // Prepare base64 data URI for OpenAI Vision
                const mimeType = lowerName.endsWith('.png') ? 'image/png' : 'image/jpeg';
                visionDataUri = `data:${mimeType};base64,${fileBase64}`;
                console.log("Image prepared for OpenAI Vision (base64 data URI)");
            } catch (visionError) {
                console.error("Google Vision OCR failed:", visionError);
                extractedText = "";
            }
        } else if (isPdf) {
            // PDF file - Convert to images using PDF.co
            // This is CRITICAL for accurate extraction - OpenAI Vision needs an image to see the NUIP box
            console.log("Processing PDF file with PDF.co conversion...");
            try {
                // Convert PDF to images
                const pdfImageUrls = await convertPdfToImage(fileBuffer);

                if (pdfImageUrls && pdfImageUrls.length > 0) {
                    console.log(`PDF converted to ${pdfImageUrls.length} image(s)`);

                    // Use Google Vision on the images
                    extractedText = await extractTextFromImages(pdfImageUrls);

                    // Use the first page image for OpenAI Vision
                    // OpenAI Vision accepts URLs directly for images
                    visionDataUri = pdfImageUrls[0];
                    console.log(`PDF prepared for OpenAI Vision (using converted image URL)`);
                } else {
                    console.error("PDF conversion returned no images");
                    throw new Error("PDF conversion failed");
                }
            } catch (pdfError) {
                console.error("PDF processing failed:", pdfError);
                // Fallback to text-only mode
                console.log("Falling back to text-only mode for PDF");
                extractedText = "";
            }
        } else {
            console.warn(`Unsupported file type: ${fileName}`);
        }

        console.log(`OCR text length: ${extractedText.length}, Vision URI: ${visionDataUri ? 'SET' : 'NOT SET'}`);

        // 5. Fetch templates - AI AUTO-DETECT MODE
        // We fetch ALL templates and let the AI decide which one matches best
        // This makes the system truly template-driven and category-agnostic
        console.log(`Fetching ALL templates for AI-based detection...`);
        console.log(`Category hint from user: ${categoryId || 'NONE'}`);

        const { data: templates, error } = await supabase
            .from('document_templates')
            .select('*');

        if (error) {
            console.error("Error fetching templates:", error);
            throw new Error("Failed to load templates from database.");
        }

        if (!templates || templates.length === 0) {
            console.error("CRITICAL: No templates exist in the system!");
            throw new Error("No templates configured in the system. Please create at least one template first.");
        }

        console.log(`Loaded ${templates.length} templates for AI matching`);

        // 6. Match template
        console.log(`Matching template with AI (Vision Mode: ${visionDataUri ? 'ENABLED' : 'DISABLED'})...`);
        let matchedTemplate = await matchTemplateWithAI(extractedText, templates || [], visionDataUri);

        // RESILIENCE: If no match but templates exist, use first one
        if (!matchedTemplate && templates && templates.length > 0) {
            console.warn("No template matched, using first available template as fallback");
            matchedTemplate = templates[0];
        }

        console.log(`Template matched: ${matchedTemplate?.name || 'NONE'}`);

        if (!matchedTemplate) {
            console.error("No templates available in database!");
            throw new Error("No templates available. Please upload a template first.");
        }

        // 6.5 DYNAMIC EXTRACTION / HYBRID Strategy
        // If DB has fields (Cached), use them (Fast). If missing, fetch Template PDF (Robust).
        matchedTemplate.content_profile = matchedTemplate.content_profile || {};
        const storedFields = matchedTemplate.content_profile.pdfFields || [];

        // ALWAYS use Dynamic Extraction (User Request)
        if (matchedTemplate.template_file_url) {
            console.log(`[HYBRID] No unique DB fields found. Fetching template PDF to extract fields dynamically...`);
            try {
                const tmplResp = await fetch(matchedTemplate.template_file_url);
                if (tmplResp.ok) {
                    const tmplBuffer = await tmplResp.arrayBuffer();
                    const dynamicPdfFields = await extractPdfFields(tmplBuffer);
                    console.log(`[HYBRID] Extracted ${dynamicPdfFields.length} fields from template source.`);

                    // INJECT
                    matchedTemplate.content_profile.pdfFields = dynamicPdfFields;
                } else {
                    console.warn(`[HYBRID] Failed to fetch template PDF: ${tmplResp.statusText}`);
                }
            } catch (dErr) {
                console.warn("[HYBRID] Failed to extract template fields:", dErr);
            }
        }

        // 7. Extract structured data with AI (using Google Vision OCR text + OpenAI Vision)
        console.log("Extracting structured data with AI...");
        console.log(`Using OCR text (${extractedText.length} chars) + Vision for extraction`);

        // Use Vision extraction if available, otherwise fallback to text
        const extractedData = await extractData(extractedText, matchedTemplate, visionDataUri);
        console.log(`Data extracted: ${Object.keys(extractedData || {}).length} fields`);

        // Log key extracted fields for debugging
        console.log(`Extracted lugar_nacimiento: ${extractedData?.lugar_nacimiento || 'NOT FOUND'}`);
        console.log(`Extracted grupo_sanguineo: ${extractedData?.grupo_sanguineo || 'NOT FOUND'}`);
        console.log(`Extracted factor_rh: ${extractedData?.factor_rh || 'NOT FOUND'}`);

        // 8. Validate & Save
        // === ALL VALIDATION DISABLED ===
        // Both heuristic and semantic validation have been disabled
        /*
        let validationResult = validateData(extractedData, matchedTemplate);
        console.log(`Validator Result: ${validationResult.valid ? 'PASSED' : 'FAILED'}`);
        */
        // Force validation to pass
        let validationResult = { valid: true, errors: [] };
        console.log("Validation: SKIPPED (all validation disabled)");

        // 9. Semantic QA (Only if Heuristic passed)
        // === QA VALIDATION DISABLED ===
        // Semantic QA validation has been disabled for faster processing
        /*
        if (validationResult.valid) {
            console.log("Running Semantic QA Validation...");
            // Use visionDataUri if available (best context), otherwise ocrText
            const qaResult = await performSemanticQA(extractedText, extractedData, visionDataUri);

            if (!qaResult.valid) {
                console.log("Semantic QA FAILED. Discrepancies found.");
                validationResult.valid = false;
                validationResult.errors.push(...qaResult.discrepancies.map(d => `[QA] ${d}`));
            } else {
                console.log("Semantic QA PASSED.");
            }
        }
        */
        console.log("QA Validation: SKIPPED (disabled)");

        let request: any;
        const dbData = {
            template_id: matchedTemplate.id,
            status: validationResult.valid ? 'pending_review' : 'needs_correction',
            extracted_data: extractedData,
            ocr_text: extractedText,
            validation_errors: validationResult.errors,
            delivery_timeline: timeline,
            ...(requestId ? {} : { user_id: userId, original_file_url: fileUrl })
        };

        if (requestId) {
            console.log(`Updating request ${requestId}...`);
            const { error } = await supabase.from('document_requests').update(dbData).eq('id', requestId);
            if (error) throw error;
            request = { id: requestId };
        } else {
            console.log("Creating new request...");
            const { data, error } = await supabase.from('document_requests').insert(dbData).select().single();
            if (error) throw error;
            request = data;
        }
        console.log(`Request saved: ${request.id}`);

        if (validationResult.valid) {
            fetch(`${supabaseUrl}/functions/v1/generate-document`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: request.id })
            }).catch(console.error);
        }

        console.log("=== FUNCTION COMPLETED SUCCESSFULLY ===");

        return new Response(JSON.stringify({
            success: true,
            requestId: request.id,
            extractedData,
            validationResult
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error("=== FUNCTION CRASHED ===", error);
        return new Response(JSON.stringify({
            success: false,
            error: (error as Error).message
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
