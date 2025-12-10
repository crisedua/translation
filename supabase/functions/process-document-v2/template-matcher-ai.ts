interface Template {
    id: string;
    name: string;
    category_id: string;
    field_definitions: any[];
    full_template_text?: string;
    content_profile?: any;
}

export const matchTemplateWithAI = async (
    documentText: string,
    templates: Template[]
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

    const prompt = `You are an expert at matching Colombian civil documents to templates.

UPLOADED DOCUMENT TEXT (first 1500 chars):
${documentText.substring(0, 1500)}

AVAILABLE TEMPLATES:
${JSON.stringify(templateSummaries, null, 2)}

Match the uploaded document to the BEST template. Consider:
1. Document type (birth certificate, passport, etc.)
2. Format indicators (old vs new format - old has LIBRO/FOLIO, new has NUIP/barcodes)
3. Keyword presence in both document and template
4. Structural similarities

Return JSON:
{
  "matchedTemplateIndex": <0-based index>,
  "confidence": <0-100>,
  "reasoning": "Why this template matches best"
}

If no template is a good match, set confidence below 40.`;

    try {
        console.log("Matching with AI...");
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are a document classification expert for Colombian civil registry documents." },
                    { role: "user", content: prompt }
                ],
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
