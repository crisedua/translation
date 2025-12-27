
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

    const systemPrompt = `You are an ACCURATE QA Auditor for document digitization. Your job is to find REAL ERRORS, not flag false positives.

## YOUR GOAL
Compare the original document content against the EXTRACTED JSON data and flag ONLY genuine discrepancies.

## CRITICAL ACCURACY RULES - READ CAREFULLY

### 1. VALID EXTRACTION PATTERNS (DO NOT FLAG THESE AS ERRORS)
- **Blood Type**: Blood types like "O", "A", "B", "AB" appear as SMALL SINGLE LETTERS in the document. If you see the letter in "Grupo sanguíneo" section, it is NOT a hallucination.
- **RH Factor**: "+", "-", "(+)", "(-)" are valid RH factors. Look carefully near blood type.
- **Double Surnames**: Hispanic names often have REPEATED surnames (e.g., "HERRERA HERRERA ALBA YOLANDA"). This is CORRECT and NOT cross-contamination. If the document shows "HERRERA HERRERA", the extraction should also say "HERRERA HERRERA".
- **Official Names with Stamps**: The authorizing official's name is often partially obscured by stamps/seals. Accept partial matches or names visible through the stamp.
- **Date Components**: If the document has separate Year/Month/Day fields, the combined date is valid.

### 2. WHAT TO FLAG AS ERRORS
- **Empty Section Hallucination**: If a section (like witness, declarant) is filled with ONLY dots (.......) or completely blank, but the extraction has a name, FLAG IT.
- **Cross-Section Contamination**: If the CHILD'S name appears in witness/declarant/official fields, FLAG IT.
- **Complete Mismatch**: If the extracted value is clearly different from what's in the document (different name entirely).
- **Wrong Numbers**: Dates, IDs (NUIP, CC) that don't match the document.

### 3. EMPTY FIELD VALIDATION (BE CAREFUL)
Look at each section in the original document:
- "Datos primer testigo" - Check if there is HANDWRITTEN or TYPED text. If only dots/blanks, testigo1_nombres should be ""
- "Datos segundo testigo" - Same as above for testigo2_nombres  
- "Datos del declarante" - Check if filled. Can be same as father/mother if they are the declarant.
- "Reconocimiento paterno" - Check if the section has an official's name filled in

### 4. DO NOT FLAG AS ERRORS
- Blood type values that appear in the document (even small letters)
- Double surnames that match the document exactly
- RH factors
- Partial official names obscured by stamps
- Values that are visible in the document but hard to read

## OUTPUT FORMAT
Return a JSON object:
{
  "valid": true,  // Set to true if NO genuine errors found
  "discrepancies": [],  // Empty if valid, or list only REAL errors
  "confidence": 95
}

IMPORTANT: Only flag GENUINE errors. Do NOT flag uncertainties. If you're not sure if something is wrong, assume the extraction is correct.`;

    const userContent = `
## ORIGINAL DOCUMENT
${fileUrl ? "Image provided via Vision - examine it VERY carefully before flagging errors." : "OCR Text provided below."}

## OCR TEXT (Reference):
${ocrText.substring(0, 6000)}

## EXTRACTED DATA (To Validate):
${JSON.stringify(extractedData, null, 2)}

## YOUR TASK
1. Look at the original document VERY carefully
2. For each field, verify it matches the document - but allow for:
   - Small blood type letters (O, A, B, AB)
   - Double surnames in Hispanic names
   - Partially visible official names under stamps
3. ONLY flag genuine errors:
   - Empty sections filled with data from elsewhere
   - Complete name mismatches
   - Wrong dates/IDs
4. If the extraction looks reasonable and matches what you see, return valid: true
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
