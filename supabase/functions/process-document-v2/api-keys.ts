/**
 * Shared API key store.
 * Keys are set by index.ts from the request body (passed from Vercel env vars)
 * and read by all sub-modules. Falls back to Deno.env if not set.
 */
const keys: Record<string, string> = {};

export function setApiKey(name: string, value: string) {
    keys[name] = value;
}

export function getApiKey(name: string): string {
    return keys[name] || Deno.env.get(name) || "";
}
