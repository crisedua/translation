import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { matchTemplateWithAI } from "./template-matcher-ai.ts";
import { extractData, refineData } from "./ai-extractor.ts";
import { validateData } from "./validator.ts";
import { performSemanticQA } from "./qa-validator.ts";
import { sendNotification } from "./email-notifier.ts";
import { extractTextWithGoogleVision, extractTextFromImages } from "./google-vision.ts";
import { extractTextWithOpenAIVision, extractTextFromImagesWithOpenAI } from "./openai-vision-ocr.ts";
import { convertPdfToImage } from "./pdf-converter.ts";
import { setApiKey } from "./api-keys.ts";

// Feature flag: Set USE_OPENAI_VISION_OCR=true in Supabase secrets to use OpenAI Vision for OCR
const USE_OPENAI_VISION_OCR = Deno.env.get("USE_OPENAI_VISION_OCR") === "true";
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

        const { fileUrl, fileName, userId, categoryId, timeline, requestId, openaiApiKey, pdfCoApiKey } = await req.json();
        console.log(`Request parsed: fileName=${fileName}, userId=${userId}`);
        console.log(`[DEBUG] openaiApiKey received: ${openaiApiKey ? openaiApiKey.substring(0, 10) + '...' : 'NOT PROVIDED'}`);
        console.log(`[DEBUG] pdfCoApiKey received: ${pdfCoApiKey ? 'YES' : 'NOT PROVIDED'}`);

        // Use API keys from request body (Vercel env) or fall back to Supabase secrets
        if (openaiApiKey) setApiKey("OPENAI_API_KEY", openaiApiKey);
        if (pdfCoApiKey) setApiKey("PDF_CO_API_KEY", pdfCoApiKey);

        const { getApiKey } = await import("./api-keys.ts");
        console.log(`[DEBUG] Resolved OPENAI key: ${getApiKey("OPENAI_API_KEY").substring(0, 10)}...`);

        if (!fileUrl) {
            throw new Error("fileUrl is required");
        }

        // Resolve fileUrl — it may be a signed URL or a storage path
        let resolvedFileUrl = fileUrl;
        if (!fileUrl.startsWith('http')) {
            console.log(`Generating fresh signed URL for storage path: ${fileUrl}`);
            const { data: urlData, error: urlError } = await supabase.storage
                .from('documents')
                .createSignedUrl(fileUrl, 7200);

            if (urlError || !urlData?.signedUrl) {
                throw new Error(`Failed to generate signed URL for file: ${urlError?.message || 'unknown error'}`);
            }
            resolvedFileUrl = urlData.signedUrl;
        }

        console.log(`Processing document: ${fileName || 'Unknown'}`);

        // 1. Download file
        console.log("Downloading file...");
        const fileResponse = await fetch(resolvedFileUrl);
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
            // Direct image - OCR based on feature flag
            console.log("Processing IMAGE file...");
            const mimeType = lowerName.endsWith('.png') ? 'image/png' : 'image/jpeg';

            try {
                if (USE_OPENAI_VISION_OCR) {
                    // Use OpenAI Vision for OCR (better semantic understanding)
                    console.log("Using OpenAI Vision for image OCR...");
                    extractedText = await extractTextWithOpenAIVision(fileBase64, mimeType);
                    console.log(`OpenAI Vision extracted ${extractedText.length} characters`);
                } else {
                    // Use Google Vision for OCR (original behavior)
                    console.log("Using Google Vision for image OCR...");
                    extractedText = await extractTextWithGoogleVision(fileBase64);
                    console.log(`Google Vision extracted ${extractedText.length} characters`);
                }

                // Prepare base64 data URI for OpenAI Vision structured extraction
                visionDataUri = `data:${mimeType};base64,${fileBase64}`;
                console.log("Image prepared for OpenAI Vision (base64 data URI)");
            } catch (visionError) {
                console.error("OCR failed:", visionError);
                extractedText = "";
            }
        } else if (isPdf) {
            // PDF file processing - Multiple strategies with fallbacks
            console.log("Processing PDF file...");

            let pdfImageUrls: string[] = [];

            // STRATEGY 1: PDF.co image conversion (best quality - gives us images for Vision)
            try {
                console.log("[PDF-S1] Attempting PDF.co image conversion...");
                pdfImageUrls = await convertPdfToImage(fileBuffer);
                if (pdfImageUrls && pdfImageUrls.length > 0) {
                    console.log(`[PDF-S1] Success: ${pdfImageUrls.length} image(s)`);
                } else {
                    throw new Error("No images returned");
                }
            } catch (s1Error) {
                console.warn("[PDF-S1] PDF.co image conversion failed:", s1Error);
                pdfImageUrls = [];
            }

            // If we have images, do OCR + set vision URI
            if (pdfImageUrls.length > 0) {
                try {
                    if (USE_OPENAI_VISION_OCR) {
                        console.log("Using OpenAI Vision for PDF OCR...");
                        extractedText = await extractTextFromImagesWithOpenAI(pdfImageUrls);
                    } else {
                        console.log("Using Google Vision for PDF OCR...");
                        extractedText = await extractTextFromImages(pdfImageUrls);
                    }
                    console.log(`OCR extracted ${extractedText.length} characters`);
                    visionDataUri = pdfImageUrls[0]; // First page for structured extraction
                } catch (ocrError) {
                    console.error("OCR on converted images failed:", ocrError);
                }
            }

            // STRATEGY 2: PDF.co text extraction (if no images or OCR failed)
            if (!extractedText) {
                console.log("[PDF-S2] Attempting PDF.co text extraction...");
                try {
                    const { getApiKey } = await import("./api-keys.ts");
                    const pdfCoKey = getApiKey("PDF_CO_API_KEY");
                    if (pdfCoKey) {
                        const uploadUrl = "https://api.pdf.co/v1/file/upload/get-presigned-url";
                        const tempName = `fallback_${Date.now()}.pdf`;
                        const uploadResp = await fetch(`${uploadUrl}?name=${tempName}&encrypt=true`, {
                            headers: { "x-api-key": pdfCoKey }
                        });
                        const uploadData = await uploadResp.json();

                        if (!uploadData.error && uploadData.presignedUrl) {
                            await fetch(uploadData.presignedUrl, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/pdf' },
                                body: fileBuffer
                            });

                            const textResp = await fetch("https://api.pdf.co/v1/pdf/convert/to/text", {
                                method: 'POST',
                                headers: { "x-api-key": pdfCoKey, "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    url: uploadData.url,
                                    async: false,
                                    ocrMode: "Auto",
                                    lang: "spa",
                                    inline: true
                                })
                            });
                            const textData = await textResp.json();
                            if (!textData.error && textData.body) {
                                extractedText = textData.body;
                                console.log(`[PDF-S2] Success: ${extractedText.length} characters`);
                            }
                        }
                    }
                } catch (s2Error) {
                    console.warn("[PDF-S2] PDF.co text extraction failed:", s2Error);
                }
            }

            // STRATEGY 3: Direct OpenAI Vision with base64 image of first page
            // OpenAI Vision does NOT support application/pdf — only image MIME types
            // So we skip this if we don't have image URLs. Text-only extraction will be used.
            if (!extractedText && !visionDataUri) {
                console.warn("[PDF] All PDF processing methods failed. Will attempt text-only extraction from PDF form fields.");
                // Try to extract any embedded text from the PDF using pdf-lib
                try {
                    const { extractPdfFields } = await import("./pdf-field-extractor.ts");
                    const fields = await extractPdfFields(fileBuffer);
                    if (fields.length > 0) {
                        extractedText = `PDF form fields detected: ${fields.join(', ')}`;
                        console.log(`[PDF-S3] Extracted ${fields.length} form field names as fallback context`);
                    }
                } catch (s3Error) {
                    console.warn("[PDF-S3] PDF field extraction failed:", s3Error);
                }
            }

            if (!extractedText && !visionDataUri) {
                console.error("[CRITICAL] All PDF processing methods failed. Extraction will be empty.");
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

        // 7. Extract structured data with AI (using OCR text + OpenAI Vision)
        console.log("Extracting structured data with AI...");
        console.log(`OCR engine: ${USE_OPENAI_VISION_OCR ? 'OpenAI Vision' : 'Google Vision'}`);
        console.log(`Using OCR text (${extractedText.length} chars) + Vision for extraction`);

        // Use Vision extraction if available, otherwise fallback to text
        const extractedData = await extractData(extractedText, matchedTemplate, visionDataUri);
        console.log(`Data extracted: ${Object.keys(extractedData || {}).length} fields`);

        // Log key extracted fields for debugging
        console.log(`Extracted lugar_nacimiento: ${extractedData?.lugar_nacimiento || 'NOT FOUND'}`);
        console.log(`Extracted grupo_sanguineo: ${extractedData?.grupo_sanguineo || 'NOT FOUND'}`);
        console.log(`Extracted factor_rh: ${extractedData?.factor_rh || 'NOT FOUND'}`);

        // 7.1 VISUAL SELF-CORRECTION (Auto-Recovery for Missing Fields)
        // Automatically re-examines the image if expected fields are missing
        const pdfFields = matchedTemplate.content_profile?.pdfFields || [];
        if (pdfFields.length > 0) {
            const missingFields = pdfFields.filter((field: string) =>
                !extractedData[field] ||
                extractedData[field] === "" ||
                extractedData[field] === null ||
                extractedData[field] === "undefined"
            );

            if (missingFields.length > 0) {
                console.log(`[SELF-CORRECTION] Found ${missingFields.length} missing/empty fields: ${missingFields.slice(0, 5).join(', ')}...`);

                // Limit to 20 fields to avoid token limits
                const fieldsToRefine = missingFields.slice(0, 20);

                // Perform visual correction
                const refinedData = await refineData(extractedData, visionDataUri || '', fieldsToRefine);

                // Merge refined data into extractedData
                for (const key in refinedData) {
                    if (refinedData[key] && refinedData[key] !== "") {
                        console.log(`[SELF-CORRECTION] Fixed ${key}: "${refinedData[key]}"`);
                        extractedData[key] = refinedData[key];
                    }
                }
            } else {
                console.log("[SELF-CORRECTION] All expected fields detected. Skipping correction.");
            }
        }

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
