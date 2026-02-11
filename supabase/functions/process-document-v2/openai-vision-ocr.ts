/**
 * OpenAI Vision OCR Module
 * 
 * Uses GPT-4o Vision for unified OCR + structured extraction.
 * Benefits over Google Vision:
 * - Semantic understanding of form fields
 * - Better handling of blank/empty fields
 * - Can be instructed to split combined values
 */

interface OpenAIVisionOCRResult {
    ocrText: string;
    confidence: number;
}

/**
 * Extract raw text from an image using OpenAI Vision
 * This replaces Google Vision's DOCUMENT_TEXT_DETECTION
 */
export async function extractTextWithOpenAIVision(
    imageBase64: string,
    mimeType: string = 'image/jpeg'
): Promise<string> {
    const { getApiKey } = await import("./api-keys.ts");
    const apiKey = getApiKey("OPENAI_API_KEY");
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const dataUri = `data:${mimeType};base64,${imageBase64}`;

    const systemPrompt = `You are an OCR engine. Your task is to extract ALL visible text from this document image.

## CRITICAL INSTRUCTIONS

1. **Extract EVERY piece of text** you can see, including:
   - Headers and labels
   - Form field contents
   - Printed text
   - Handwritten text
   - Stamps and annotations
   - Numbers and codes
   - Notes sections

2. **Preserve document structure**:
   - Use newlines to separate different sections
   - Indicate form field labels followed by their values
   - Format: "Label: Value" where applicable

3. **Handle blank/empty fields** - THIS IS CRITICAL:
   - If a form field shows "---", "-", "N/A", or is visually blank/empty, output: "FieldLabel: [EMPTY]"
   - The "---" symbol is a STANDARD empty field indicator in Colombian documents - treat it as BLANK
   - Do NOT skip empty fields - explicitly mark them as [EMPTY]
   - Do NOT put data from other fields into empty fields

4. **Be complete**:
   - Include ALL text from top to bottom
   - Don't summarize or skip content
   - Include stamps, annotations, margin notes

5. **Special attention to**:
   - NUIP numbers (include leading letters like V2A)
   - Names (all parts, don't truncate)
   - Dates (preserve exact format)
   - Location fields (country, department, municipality)
   - Township/Corregimiento field - if it shows "---", it is EMPTY

Return ONLY the extracted text, no explanations.`;

    const userPrompt = "Extract all text from this document image following the OCR instructions exactly.";

    try {
        console.log("[OPENAI-VISION-OCR] Starting text extraction...");

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: userPrompt },
                            { type: "image_url", image_url: { url: dataUri } }
                        ]
                    }
                ],
                temperature: 0.1,
                max_tokens: 16384
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const extractedText = data.choices?.[0]?.message?.content || "";

        console.log(`[OPENAI-VISION-OCR] Extracted ${extractedText.length} characters`);

        // Log first 500 chars for debugging
        if (extractedText.length > 0) {
            console.log(`[OPENAI-VISION-OCR] Preview: ${extractedText.substring(0, 500)}...`);
        }

        return extractedText;

    } catch (error) {
        console.error("[OPENAI-VISION-OCR] Error:", error);
        throw error;
    }
}

/**
 * Extract text from multiple images (for multi-page PDFs)
 * Each page is processed and combined
 */
export async function extractTextFromImagesWithOpenAI(
    imageUrls: string[]
): Promise<string> {
    const { getApiKey } = await import("./api-keys.ts");
    const apiKey = getApiKey("OPENAI_API_KEY");
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    console.log(`[OPENAI-VISION-OCR] Processing ${imageUrls.length} page(s)...`);

    const systemPrompt = `You are an OCR engine. Extract ALL visible text from this document page.

CRITICAL RULES:
1. Extract EVERY piece of text - headers, labels, values, stamps, handwriting
2. EMPTY FIELD DETECTION: If a field shows "---", "-", "N/A", or is blank, mark as "FieldLabel: [EMPTY]"
   - The "---" symbol means the field is EMPTY in Colombian documents
3. Preserve structure with newlines between sections
4. Include NUIP with leading letters (e.g., V2A0001156)
5. Include complete names (don't truncate)
6. Extract margin notes and stamps completely
7. Township/Corregimiento: If it shows "---", it is EMPTY - return [EMPTY]

Return ONLY the extracted text.`;

    const allTexts: string[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        console.log(`[OPENAI-VISION-OCR] Processing page ${i + 1}/${imageUrls.length}...`);

        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: systemPrompt },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: `Extract all text from page ${i + 1}.` },
                                { type: "image_url", image_url: { url: imageUrl } }
                            ]
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 16384
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[OPENAI-VISION-OCR] Page ${i + 1} error:`, errorText);
                continue;
            }

            const data = await response.json();
            const pageText = data.choices?.[0]?.message?.content || "";

            if (pageText.length > 0) {
                allTexts.push(`=== PAGE ${i + 1} ===\n${pageText}`);
                console.log(`[OPENAI-VISION-OCR] Page ${i + 1}: ${pageText.length} characters`);
            }

        } catch (pageError) {
            console.error(`[OPENAI-VISION-OCR] Failed to process page ${i + 1}:`, pageError);
        }
    }

    const combinedText = allTexts.join("\n\n");
    console.log(`[OPENAI-VISION-OCR] Total extracted: ${combinedText.length} characters from ${allTexts.length} pages`);

    return combinedText;
}

/**
 * Extract text from base64 image array (for direct base64 images)
 */
export async function extractTextFromBase64ImagesWithOpenAI(
    imageBase64Array: string[],
    mimeType: string = 'image/jpeg'
): Promise<string> {
    console.log(`[OPENAI-VISION-OCR] Processing ${imageBase64Array.length} base64 image(s)...`);

    const allTexts: string[] = [];

    for (let i = 0; i < imageBase64Array.length; i++) {
        try {
            const pageText = await extractTextWithOpenAIVision(imageBase64Array[i], mimeType);
            if (pageText.length > 0) {
                allTexts.push(`=== PAGE ${i + 1} ===\n${pageText}`);
            }
        } catch (pageError) {
            console.error(`[OPENAI-VISION-OCR] Failed to process image ${i + 1}:`, pageError);
        }
    }

    const combinedText = allTexts.join("\n\n");
    console.log(`[OPENAI-VISION-OCR] Total extracted: ${combinedText.length} characters from ${allTexts.length} images`);

    return combinedText;
}
