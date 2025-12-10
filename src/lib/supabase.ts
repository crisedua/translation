import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase Setup Error:', {
        url: supabaseUrl ? 'Set' : 'Missing',
        key: supabaseAnonKey ? 'Set' : 'Missing',
        urlValue: supabaseUrl // CAREFUL: Only for debugging, remove later if sensitive
    });
    throw new Error(
        `Missing Supabase environment variables. URL: ${supabaseUrl ? 'Set' : 'Missing'}, Key: ${supabaseAnonKey ? 'Set' : 'Missing'}`
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
