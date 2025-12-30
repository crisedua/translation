import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

/**
 * Extracts all form field names from a PDF buffer.
 * Using this allows us to know the *exact* target keys for AI extraction
 * without relying on a pre-populated database field.
 */
export async function extractPdfFields(pdfBuffer: ArrayBuffer): Promise<string[]> {
    try {
        console.log("[PDF-EXTRACTOR] Loading PDF document to extract fields...");

        // Load the PDF ignoring errors to be robust
        const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

        const form = pdfDoc.getForm();
        const fields = form.getFields();
        const fieldNames = fields.map(f => f.getName());

        console.log(`[PDF-EXTRACTOR] Successfully extracted ${fieldNames.length} form fields`);

        // Log top 5 fields for debugging
        if (fieldNames.length > 0) {
            console.log(`[PDF-EXTRACTOR] Sample fields: ${fieldNames.slice(0, 5).join(', ')}...`);
        } else {
            console.warn("[PDF-EXTRACTOR] No form fields found in this PDF!");
        }

        return fieldNames;
    } catch (error) {
        console.error("[PDF-EXTRACTOR] Error extracting fields from PDF:", error);
        // Return empty array so process can continue (fallback to heuristic extraction)
        return [];
    }
}
