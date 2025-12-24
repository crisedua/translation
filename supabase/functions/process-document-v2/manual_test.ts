
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CONFIGURATION
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-document-v2`;

// MOCK DATA
const MOCK_PAYLOAD = {
    fileUrl: "https://example.com/sample_document.pdf", // REPLACE WITH A REAL URL
    fileName: "sample_document.pdf",
    userId: "test-user-id",
    categoryId: "test-category",
    timeline: "EXPRESS"
};

async function testProcessDocument() {
    console.log("Starting test...");

    try {
        const response = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(MOCK_PAYLOAD)
        });

        const data = await response.json();
        console.log("Response Status:", response.status);
        console.log("Response Data:", JSON.stringify(data, null, 2));

        if (data.validationResult && !data.validationResult.valid) {
            console.log("Validation Failed (Expected if QA found issues):");
            console.log(data.validationResult.errors);
        } else {
            console.log("Validation Passed!");
        }

    } catch (error) {
        console.error("Test failed:", error);
    }
}

testProcessDocument();
