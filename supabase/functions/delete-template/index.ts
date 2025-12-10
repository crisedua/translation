import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { templateId } = await req.json();

        if (!templateId) {
            throw new Error("templateId is required");
        }

        console.log(`Deleting template: ${templateId}`);

        // First, update any document_requests that reference this template
        // Set their template_id to null to avoid FK constraint errors
        await supabase
            .from('document_requests')
            .update({ template_id: null })
            .eq('template_id', templateId);

        // Now delete the template
        const { error } = await supabase
            .from('document_templates')
            .delete()
            .eq('id', templateId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error("Delete error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
