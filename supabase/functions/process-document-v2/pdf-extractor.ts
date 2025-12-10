// Simple PDF.co text extractor - replaces Google Vision
export const extractText = async (pdfUrl: string): Promise<string> => {
    const apiKey = Deno.env.get("PDF_CO_API_KEY");
    if (!apiKey) {
        throw new Error("PDF_CO_API_KEY environment variable is not set");
    }

    try {
        const extractUrl = "https://api.pdf.co/v1/pdf/convert/to/text";
        const extractResponse = await fetch(extractUrl, {
            method: 'POST',
            headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: pdfUrl,
                async: false,
                ocrMode: "TextFromImageOrVector",
                lang: "spa",
                inline: true
            })
        });

        if (!extractResponse.ok) {
            throw new Error(`PDF.co API error: ${extractResponse.status}`);
        }

        const extractData = await extractResponse.json();

        if (extractData.error) {
            throw new Error(`PDF.co extraction error: ${extractData.message}`);
        }

        const extractedText = extractData.body || "";

        if (!extractedText || extractedText.length < 10) {
            throw new Error("No text extracted from PDF");
        }

        return extractedText;

    } catch (error) {
        console.error("Error extracting text with PDF.co:", error);
        throw error;
    }
};
