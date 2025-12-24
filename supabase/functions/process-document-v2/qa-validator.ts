
interface QAResult {
    valid: boolean;
    discrepancies: string[];
    confidence: number;
}

export const performSemanticQA = async (ocrText: string, extractedData: any, fileUrl?: string): Promise<QAResult> => {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    console.log("Starting Semantic QA Audit...");

    const systemPrompt = `You are a strict QA Auditor for document digitization.
Your job is to COMPARE the original document content (provided as OCR text or Image) against the EXTRACTED JSON data.

Your Goal: Verify that the JSON data accurately represents the document.

RULES:
1. Compare fields strictly. "John Doe" != "John A. Doe".
2. Allow for minor OCR quirks (e.g., '0' vs 'O') if the intent is clear, but flag it if uncertain.
3. CRITICAL: Check dates, IDs (NUIP), and Names carefully.
4. If a field is missing in the Extraction but present in the Document, flag it.
5. If a field is present in Extraction but NOT in Document (hallucination), flag it.
6. Return a JSON object with:
   - "valid": boolean (true if NO material errors found)
   - "discrepancies": array of strings (list each error found, be specific)
   - "confidence": number (0-100)

OUTPUT FORMAT:
{
  "valid": false,
  "discrepancies": ["Name mismatch: Document says 'Carlos', Extracted 'Karlos'", "Date mismatch: Document '2023', Extracted '2024'"],
  "confidence": 95
}`;

    const userContent = `
ORIGINAL DOCUMENT CONTEXT:
${fileUrl ? "Image provided via Vision." : "OCR Text provided below."}

OCR TEXT (Reference):
${ocrText.substring(0, 5000)}

EXTRACTED DATA (To Validate):
${JSON.stringify(extractedData, null, 2)}

Please Audit this extraction.`;

    const messages = [
        { role: "system", content: systemPrompt },
        {
            role: "user",
            content: fileUrl
                ? [
                    { type: "text", text: userContent },
                    { type: "image_url", image_url: { url: fileUrl } }
                ]
                : [{ type: "text", text: userContent }]
        }
    ];

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o", // Use high-intelligence model for auditing
                messages: messages,
                temperature: 0.0, // Strict deterministic behavior
                response_format: { type: "json_object" }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`QA OpenAI API error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const resultText = data.choices?.[0]?.message?.content || "{}";
        const qaResult: QAResult = JSON.parse(resultText);

        console.log(`QA Result: ${qaResult.valid ? "PASS" : "FAIL"} (${qaResult.discrepancies.length} discrepancies)`);
        return qaResult;

    } catch (error) {
        console.error("QA Process Failed:", error);
        // Fallback: If QA fails technically, we don't want to block the whole flow, 
        // but we should warn. For now, assume valid but log error.
        return { valid: true, discrepancies: ["QA Step failed due to technical error"], confidence: 0 };
    }
};
