export const convertPdfToImage = async (pdfBuffer: ArrayBuffer): Promise<string[]> => {
    const apiKey = Deno.env.get("PDF_CO_API_KEY");
    if (!apiKey) {
        throw new Error("PDF_CO_API_KEY environment variable is not set");
    }

    // 1. Upload the file to PDF.co to get a temporary URL
    const uploadUrl = "https://api.pdf.co/v1/file/upload/get-presigned-url";
    const fileName = `upload_${Date.now()}.pdf`;

    try {
        // Get presigned URL
        const uploadResponse = await fetch(`${uploadUrl}?name=${fileName}&encrypt=true`, {
            headers: { "x-api-key": apiKey }
        });

        if (!uploadResponse.ok) throw new Error("Failed to get PDF.co upload URL");
        const uploadData = await uploadResponse.json();

        if (uploadData.error) throw new Error(`PDF.co error: ${uploadData.message}`);

        const { presignedUrl, url: fileUrl } = uploadData;

        // Upload the file binary
        const putResponse = await fetch(presignedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/pdf' },
            body: pdfBuffer
        });

        if (!putResponse.ok) throw new Error("Failed to upload file to PDF.co");

        // 2. Convert PDF to JPG
        const convertUrl = "https://api.pdf.co/v1/pdf/convert/to/jpg";
        const convertResponse = await fetch(convertUrl, {
            method: 'POST',
            headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: fileUrl,
                inline: true,
                pages: "0-", // All pages
                async: false // Wait for result
            })
        });

        if (!convertResponse.ok) throw new Error("Failed to convert PDF to Image");
        const convertData = await convertResponse.json();

        if (convertData.error) throw new Error(`PDF.co conversion error: ${convertData.message}`);

        const imageUrls = convertData.urls;
        if (!imageUrls || imageUrls.length === 0) return [];

        return imageUrls;

    } catch (error) {
        console.error("Error in PDF.co conversion:", error);
        throw error;
    }
};
