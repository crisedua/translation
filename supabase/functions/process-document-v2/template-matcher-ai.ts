interface Template {
    id: string;
    name: string;
    category_id: string;
    field_definitions: any[];
    full_template_text?: string;
    content_profile?: any;
    template_file_url?: string;
}

export const matchTemplateWithAI = async (
    documentText: string,
    templates: Template[],
    visionDataUri?: string
): Promise<Template | null> => {
    if (!templates || templates.length === 0) {
        console.warn("No templates provided for matching");
        return null;
    }

    // If only 1 template, use it directly
    if (templates.length === 1) {
        console.log(`Only one template available, using: ${templates[0].name}`);
        return templates[0];
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
        console.error("OPENAI_API_KEY not set, using first template");
        return templates[0];
    }

    // Prepare template summaries
    const templateSummaries = templates.map((t, idx) => ({
        index: idx,
        name: t.name,
        documentType: t.content_profile?.documentType || "unknown",
        keywords: t.content_profile?.keywords || [],
        formatVersion: t.content_profile?.formatIndicators?.version || "unknown",
        formatMarkers: t.content_profile?.formatIndicators?.specificMarkers || [],
        semanticDescription: t.content_profile?.semanticDescription || "",
        textSample: t.full_template_text?.substring(0, 300) || ""
    }));

    const textPrompt = `You are an expert at matching Colombian civil documents to templates.

UPLOADED DOCUMENT TEXT (first 1500 chars):
${documentText.substring(0, 1500)}

AVAILABLE TEMPLATES:
${JSON.stringify(templateSummaries, null, 2)}

Match the uploaded document to the BEST template. Consider:

1. VISUAL LAYOUT & STRUCTURE (If image provided):
   - Look for QR codes, barcodes, or neither
   - Check for digital signature text ("digitally signed document")
   - Observe overall layout and formatting style

2. Document type (birth certificate, passport, marriage certificate, etc.)

3. Format indicators - CRITICAL for Birth Certificates:
   Birth certificates have 3 main variants in Colombia:
   
   a) OLD/MEDIUM Format:
      - Contains: "ORDINALS", "MONTH CODES", "Superintendence of Notaries"
      - Does NOT have: NUIP, barcode, QR code
      - Visual: Older structured format with coded month fields
   
   b) NEW Format (Medium):
      - Contains: "NUIP", "barcode", "ELECTORAL ORGANIZATION", "NATIONAL CIVIL REGISTRY DIRECTORATE"
      - Does NOT have: QR code, digital signature
      - Visual: Modern format with NUIP box at top and barcode
   
   c) NEW Format (Newest/Digital):
      - Contains: "NUIP", "QR code", "digitally signed document", "Valid for 3 months"
      - Contains: "Digital Civil Status Registration", "Civil Registry Information System"
      - Visual: Fully digital format with QR code and digital signatures

4. Keyword presence and marker matching:
   - Count how many specific markers from each template appear in the document
   - Prioritize templates with the most unique marker matches

Return JSON:
{
  "matchedTemplateIndex": <0-based index>,
  "confidence": <0-100>,
  "reasoning": "Explain which specific markers were found (e.g., 'Found NUIP + QR code + digital signature text, indicating newest birth certificate format')"
}

If no template is a good match, set confidence below 40.`;

    const messages: any[] = [
        { role: "system", content: "You are a document classification expert for Colombian civil registry documents." }
    ];

    if (visionDataUri) {
        // Visual + Text Matching
        messages.push({
            role: "user",
            content: [
                { type: "text", text: textPrompt },
                {
                    type: "image_url",
                    image_url: {
                        url: visionDataUri,
                        detail: "low" // Low detail is enough for layout matching and cheaper/faster
                    }
                }
            ]
        });
    } else {
        // Text-only Matching
        messages.push({ role: "user", content: textPrompt });
    }

    try {
        console.log(`Matching with AI (Vision: ${!!visionDataUri})...`);
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", // GPT-4o-mini supports vision
                messages: messages,
                temperature: 0.1,
                response_format: { type: "json_object" }
            }),
        });


        if (!response.ok) {
            console.error("AI matching failed, using keyword fallback");
            return keywordMatch(documentText, templates);
        }

        const data = await response.json();
        const result = JSON.parse(data.choices?.[0]?.message?.content || "{}");

        const matchedIndex = result.matchedTemplateIndex;
        const confidence = result.confidence || 0;

        console.log(`AI Match: ${templates[matchedIndex]?.name} (${confidence}%)`);
        console.log(`Reason: ${result.reasoning}`);

        if (confidence >= 40 && matchedIndex >= 0 && matchedIndex < templates.length) {
            return templates[matchedIndex];
        }

        // Fallback to keyword matching
        console.warn(`Low confidence (${confidence}%), trying keyword match`);
        return keywordMatch(documentText, templates);

    } catch (error) {
        console.error("AI matching error:", error);
        return keywordMatch(documentText, templates);
    }
};

// Fallback keyword-based matching
function keywordMatch(documentText: string, templates: Template[]): Template | null {
    const lowerDoc = documentText.toLowerCase();

    let bestMatch: Template | null = null;
    let bestScore = 0;

    for (const template of templates) {
        let score = 0;
        const keywords = template.content_profile?.keywords || [];
        const markers = template.content_profile?.formatIndicators?.specificMarkers || [];

        // Check keywords
        for (const kw of keywords) {
            if (lowerDoc.includes(kw.toLowerCase())) {
                score += 5;
            }
        }

        // Check format markers (higher weight)
        for (const marker of markers) {
            if (lowerDoc.includes(marker.toLowerCase())) {
                score += 15;
            }
        }

        // Check template text similarity
        const templateText = template.full_template_text?.toLowerCase() || "";
        if (templateText) {
            const docWords = new Set(lowerDoc.split(/\s+/).filter(w => w.length > 4));
            const templateWords = new Set(templateText.split(/\s+/).filter(w => w.length > 4));
            let overlap = 0;
            for (const word of docWords) {
                if (templateWords.has(word)) overlap++;
            }
            score += overlap * 2;
        }

        console.log(`  ${template.name}: score ${score}`);

        if (score > bestScore) {
            bestScore = score;
            bestMatch = template;
        }
    }

    if (bestMatch) {
        console.log(`Keyword match: ${bestMatch.name} (score: ${bestScore})`);
    } else {
        console.warn("No keyword match found, using first template");
        bestMatch = templates[0];
    }

    return bestMatch;
}
