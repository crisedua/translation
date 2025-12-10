import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { matchTemplateWithAI } from "./template-matcher-ai.ts";
import { extractData } from "./ai-extractor.ts";
import { validateData } from "./validator.ts";
import { sendNotification } from "./email-notifier.ts";
import { extractTextWithGoogleVision, extractTextFromImages } from "./google-vision.ts";
import { convertPdfToImage } from "./pdf-converter.ts";

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

        // 4. Extract text using Google Vision (for both images and PDFs)
        let extractedText = "";
        let imageUrlsForAI: string[] = []; // For passing to OpenAI Vision API
        
        try {
            if (isImage) {
                // Direct image - use Google Vision
                console.log("Using Google Vision for image OCR...");
                extractedText = await extractTextWithGoogleVision(fileBase64);
                // For OpenAI Vision, use the base64 data URI
                imageUrlsForAI = [`data:${lowerName.endsWith('.png') ? 'image/png' : 'image/jpeg'};base64,${fileBase64}`];
            } else if (isPdf) {
                // PDF - convert to images first, then use Google Vision
                console.log("Converting PDF to images for Google Vision OCR...");
                const pdfImageUrls = await convertPdfToImage(fileBuffer);
                
                if (pdfImageUrls && pdfImageUrls.length > 0) {
                    console.log(`PDF converted to ${pdfImageUrls.length} image(s)`);
                    
                    // Use Google Vision to extract text from all pages
                    extractedText = await extractTextFromImages(pdfImageUrls);
                    
                    // Store image URLs for OpenAI Vision API
                    imageUrlsForAI = pdfImageUrls;
                    
                    console.log(`Google Vision extracted ${extractedText.length} characters from PDF`);
                } else {
                    throw new Error("Failed to convert PDF to images");
                }
            } else {
                throw new Error(`Unsupported file type: ${fileName}`);
            }
        } catch (error) {
            console.error("Google Vision extraction failed:", error);
            // Fallback to PDF.co if available
            if (isPdf) {
                console.log("Falling back to PDF.co for text extraction...");
                const pdfCoKey = Deno.env.get("PDF_CO_API_KEY");
                if (pdfCoKey) {
                    try {
                        const extractResponse = await fetch("https://api.pdf.co/v1/pdf/convert/to/text", {
                            method: 'POST',
                            headers: { "x-api-key": pdfCoKey, "Content-Type": "application/json" },
                            body: JSON.stringify({
                                url: fileUrl,
                                async: false,
                                ocrMode: "Auto",
                                lang: "spa",
                                inline: true
                            })
                        });
                        const pdfData = await extractResponse.json();
                        extractedText = pdfData.body || "";
                        console.log("PDF.co fallback successful");
                    } catch (e) {
                        console.error("PDF.co fallback also failed:", e);
                        throw new Error("Both Google Vision and PDF.co extraction failed");
                    }
                } else {
                    throw new Error("Google Vision failed and PDF.co API key not available");
                }
            } else {
                throw error;
            }
        }

        console.log(`Extracted text length: ${extractedText.length}`);

        // 5. Fetch templates
        console.log("Fetching templates...");
        let query = supabase.from('document_templates').select('*');
        if (categoryId && categoryId.length > 10) {
            query = query.eq('category_id', categoryId);
        }
        const { data: templates, error: templatesError } = await query;
        console.log(`Templates fetched: ${templates?.length || 0}, error: ${templatesError?.message || 'none'}`);

        // 6. Match template
        console.log("Matching template with AI...");
        let matchedTemplate = await matchTemplateWithAI(extractedText, templates || []);

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

        // 7. Extract structured data with AI
        // Use Google Vision images for OpenAI Vision API
        let dataUri: string | undefined = undefined;
        
        if (isImage) {
            // For images, use base64 data URI
            const mimeType = lowerName.endsWith('.png') ? 'image/png' : 'image/jpeg';
            dataUri = `data:${mimeType};base64,${fileBase64}`;
            console.log("Image file detected - using Vision mode with Google Vision OCR");
        } else if (isPdf && imageUrlsForAI.length > 0) {
            // For PDFs, use the first page image URL for OpenAI Vision
            // OpenAI Vision can accept image URLs
            dataUri = imageUrlsForAI[0];
            console.log(`PDF detected - using first page image (${imageUrlsForAI.length} total pages) for OpenAI Vision`);
        }

        console.log("Extracting structured data with AI...");
        const extractedData = await extractData(extractedText, matchedTemplate, dataUri);
        console.log(`Data extracted: ${Object.keys(extractedData || {}).length} fields`);

        // 8. Validate & Save
        const validationResult = validateData(extractedData);
        console.log(`Validation: ${validationResult.valid ? 'PASSED' : 'FAILED'}`);

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
