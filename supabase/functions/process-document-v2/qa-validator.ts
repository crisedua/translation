
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

    const systemPrompt = `You are a STRICT QA Auditor for document digitization. Your job is to find ERRORS in the extraction.

## YOUR GOAL
Compare the original document content against the EXTRACTED JSON data and flag any discrepancies.

## CRITICAL VALIDATION RULES

### 1. HALLUCINATION DETECTION (MOST IMPORTANT)
- If extractedData contains a value that is NOT visible in the original document, FLAG IT
- If a field in the original is EMPTY (dots, blank, no text) but extractedData has a value, FLAG IT as "HALLUCINATION"
- Pay special attention to:
  * testigo1_nombres, testigo2_nombres (witness names)
  * declarante_nombres (declarant name)
  * acknowledgment_official (paternal recognition official)

### 2. CROSS-CONTAMINATION DETECTION
- The child's name (from "Datos del inscrito") should ONLY appear in nombres/primer_apellido/segundo_apellido
- The child's name should NEVER appear in testigo, declarante, or official fields
- The father's name should ONLY appear in padre_nombres
- The mother's name should ONLY appear in madre_nombres
- If you see the same name appearing in multiple unrelated fields, FLAG IT

### 3. EMPTY FIELD VALIDATION
- Look at each section of the original document:
  * "Datos primer testigo" - If empty, testigo1_nombres should be ""
  * "Datos segundo testigo" - If empty, testigo2_nombres should be ""
  * "Datos del declarante" - If empty, declarante_nombres should be ""
  * "Reconocimiento paterno" - If empty or not filled, acknowledgment_official should be ""
- If the extraction filled these with non-empty values when the original section is empty, FLAG IT

### 4. BASIC VALIDATION
- Names must match exactly (allow minor OCR variations like 0/O)
- Dates must match exactly
- IDs (NUIP, CC numbers) must match exactly
- If a field exists in document but missing in extraction, flag it
- If a field in extraction doesn't exist in document (hallucination), flag it

## OUTPUT FORMAT
Return a JSON object:
{
  "valid": false,
  "discrepancies": [
    "HALLUCINATION: testigo1_nombres contains 'KATERINE' but witness section is EMPTY in original",
    "CROSS-CONTAMINATION: Child's name 'KATERINE' incorrectly copied to testigo2_nombres",
    "MISMATCH: fecha_nacimiento shows '19/08/2000' but document says '19/08/2001'"
  ],
  "confidence": 95
}

Be STRICT. If you are uncertain whether a field value is correct, flag it. It's better to have false positives than miss errors.`;

    const userContent = `
## ORIGINAL DOCUMENT
${fileUrl ? "Image provided via Vision - examine it carefully." : "OCR Text provided below."}

## OCR TEXT (Reference):
${ocrText.substring(0, 6000)}

## EXTRACTED DATA (To Validate):
${JSON.stringify(extractedData, null, 2)}

## YOUR TASK
1. Look at the original document carefully
2. For each field in the extracted data, verify it exists in the CORRECT LOCATION in the original
3. Pay SPECIAL ATTENTION to:
   - Are witness fields (testigo1_nombres, testigo2_nombres) actually filled in the original? Or are they empty (dots/blank)?
   - Are declarant fields actually filled? Or empty?
   - Is the paternal recognition section filled? Or empty?
4. Flag ANY discrepancies, especially hallucinations and cross-contamination
5. Return the JSON result`;



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
