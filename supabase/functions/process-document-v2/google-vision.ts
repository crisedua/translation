import * as jose from 'npm:jose';

// Helper to create JWT using npm:jose
async function createJWT(serviceAccount: any): Promise<string> {
    const privateKey = await jose.importPKCS8(serviceAccount.private_key, 'RS256');

    const jwt = await new jose.SignJWT({
        scope: "https://www.googleapis.com/auth/cloud-vision"
    })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer(serviceAccount.client_email)
        .setAudience(serviceAccount.token_uri)
        .setExpirationTime('1h')
        .setIssuedAt()
        .sign(privateKey);

    return jwt;
}

async function getAccessToken(): Promise<string> {
    console.log("Getting Google Access Token...");

    // The secret is Base64-encoded to avoid issues with special characters
    const serviceAccountB64 = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_B64");
    if (!serviceAccountB64) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_B64 not set");
    }

    // Decode Base64 to get the JSON string
    const serviceAccountJson = atob(serviceAccountB64);
    const serviceAccount = JSON.parse(serviceAccountJson);

    const jwt = await createJWT(serviceAccount);

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    if (!response.ok) {
        const txt = await response.text();
        console.error("Token Exchange Error:", txt);
        throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Got Google Access Token successfully");
    return data.access_token;
}

export async function extractTextWithGoogleVision(fileBase64: string): Promise<string> {
    const accessToken = await getAccessToken();
    const url = "https://vision.googleapis.com/v1/images:annotate";

    const body = {
        requests: [{
            image: { content: fileBase64 },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
        }]
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Vision API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.responses?.[0]?.fullTextAnnotation?.text || "";
    console.log(`Google Vision extracted ${text.length} characters`);
    return text;
}

// Extract text from multiple images (for multi-page PDFs) using image URLs
export async function extractTextFromImages(imageUrls: string[]): Promise<string> {
    const accessToken = await getAccessToken();
    const url = "https://vision.googleapis.com/v1/images:annotate";

    // Process all images in parallel
    const requests = imageUrls.map(imageUrl => ({
        image: { source: { imageUri: imageUrl } },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
    }));

    const body = { requests };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Vision API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    // Combine text from all pages
    const allText = data.responses
        .map((resp: any) => resp.fullTextAnnotation?.text || "")
        .filter((text: string) => text.length > 0)
        .join("\n\n");
    
    console.log(`Google Vision extracted ${allText.length} characters from ${imageUrls.length} pages`);
    return allText;
}

// Extract text from base64 image data (for direct base64 images)
export async function extractTextFromBase64Images(imageBase64Array: string[]): Promise<string> {
    const accessToken = await getAccessToken();
    const url = "https://vision.googleapis.com/v1/images:annotate";

    const requests = imageBase64Array.map(base64 => ({
        image: { content: base64 },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
    }));

    const body = { requests };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Vision API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    const allText = data.responses
        .map((resp: any) => resp.fullTextAnnotation?.text || "")
        .filter((text: string) => text.length > 0)
        .join("\n\n");
    
    console.log(`Google Vision extracted ${allText.length} characters from ${imageBase64Array.length} images`);
    return allText;
}