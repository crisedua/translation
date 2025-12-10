import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from 'npm:jose'; // Robust JWT library

// ... imports

// Helper to create JWT using npm:jose
async function createJWT(serviceAccount: any): Promise<string> {
    try {
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
    } catch (e) {
        console.error("JOSE JWT Error:", e);
        throw e;
    }
}
// ... rest of the file
