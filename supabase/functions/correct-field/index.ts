import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CorrectionRequest {
    requestId: string;
    fieldName: string;
    hint?: string;
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { requestId, fieldName, hint } = await req.json() as CorrectionRequest;

        if (!requestId || !fieldName) {
            return new Response(
                JSON.stringify({ error: "Missing requestId or fieldName" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[CORRECT-FIELD] Request ID: ${requestId}, Field: ${fieldName}, Hint: ${hint || 'none'}`);

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch the document request
        const { data: request, error: fetchError } = await supabase
            .from("document_requests")
            .select("original_file_url, extracted_data, ocr_text")
            .eq("id", requestId)
            .single();

        if (fetchError || !request) {
            console.error("[CORRECT-FIELD] Failed to fetch request:", fetchError);
            return new Response(
                JSON.stringify({ error: "Document request not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { original_file_url, extracted_data, ocr_text } = request;

        if (!original_file_url) {
            return new Response(
                JSON.stringify({ error: "Original file URL not found" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Convert URL to base64 data URI for OpenAI Vision
        let imageDataUri: string;
        try {
            const imageResponse = await fetch(original_file_url);
            if (!imageResponse.ok) {
                throw new Error(`Failed to fetch image: ${imageResponse.status}`);
            }
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
            const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
            imageDataUri = `data:${contentType};base64,${base64}`;
        } catch (e) {
            console.error("[CORRECT-FIELD] Failed to fetch image:", e);
            return new Response(
                JSON.stringify({ error: "Failed to load original document image" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Format field name for display
        const formattedFieldName = fieldName
            .split('_')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        // Current value (if any)
        const currentValue = extracted_data?.[fieldName] || '';

        // Build the prompt
        let systemPrompt = `You are a document data extraction specialist. Your task is to re-extract a SINGLE specific field from a document image.

FIELD TO EXTRACT: "${formattedFieldName}" (key: ${fieldName})
CURRENT VALUE: "${currentValue}" (this may be incorrect or incomplete)

${hint ? `USER HINT: "${hint}" - Pay special attention to this guidance.` : ''}

INSTRUCTIONS:
1. Carefully examine the entire document image
2. Find the correct value for the field "${formattedFieldName}"
3. Extract the COMPLETE, ACCURATE value
4. If the field is a name, include ALL parts (first, middle, last names)
5. If the field is a date, preserve the exact format shown in the document
6. If the field is a location, include all components (city, department, country if shown)

OCR TEXT FOR REFERENCE:
${ocr_text?.slice(0, 3000) || 'No OCR text available'}

RESPOND WITH ONLY THE EXTRACTED VALUE - no explanations, no quotes, just the raw value.
If the field cannot be found or is legitimately empty, respond with exactly: [EMPTY]`;

        // Call OpenAI Vision API
        const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openaiApiKey) {
            return new Response(
                JSON.stringify({ error: "OpenAI API key not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[CORRECT-FIELD] Calling OpenAI Vision for field: ${fieldName}`);

        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openaiApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: systemPrompt },
                            { type: "image_url", image_url: { url: imageDataUri, detail: "high" } }
                        ]
                    }
                ],
                max_tokens: 500,
                temperature: 0.1
            })
        });

        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            console.error("[CORRECT-FIELD] OpenAI API error:", errorText);
            return new Response(
                JSON.stringify({ error: "AI extraction failed" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const openaiData = await openaiResponse.json();
        let correctedValue = openaiData.choices?.[0]?.message?.content?.trim() || "";

        // Handle [EMPTY] response
        if (correctedValue === "[EMPTY]") {
            correctedValue = "";
        }

        console.log(`[CORRECT-FIELD] Extracted value: "${correctedValue}"`);

        // Update the extracted_data in the database
        const updatedExtractedData = {
            ...extracted_data,
            [fieldName]: correctedValue
        };

        const { error: updateError } = await supabase
            .from("document_requests")
            .update({
                extracted_data: updatedExtractedData,
                updated_at: new Date().toISOString()
            })
            .eq("id", requestId);

        if (updateError) {
            console.error("[CORRECT-FIELD] Failed to update database:", updateError);
            return new Response(
                JSON.stringify({ error: "Failed to save corrected value" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[CORRECT-FIELD] Successfully corrected field ${fieldName}`);

        return new Response(
            JSON.stringify({
                success: true,
                fieldName,
                correctedValue,
                previousValue: currentValue
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[CORRECT-FIELD] Unexpected error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
