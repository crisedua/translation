# Deploying Edge Functions to Supabase

## Prerequisites
- Supabase CLI installed: `npm install -g supabase`
- Logged in to Supabase: `supabase login`
- Project linked: `supabase link --project-ref fsqvguceukcyvyuekvbz`

## Step 1: Set Environment Variables in Supabase Dashboard

Go to: https://supabase.com/dashboard/project/fsqvguceukcyvyuekvbz/settings/functions

Add these secrets:

GOOGLE_CLOUD_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project-id",...}
PDF_CO_API_KEY=your_pdf_co_api_key
OPENAI_API_KEY=your_openai_api_key
RESEND_API_KEY=(optional - for email notifications)
```

**IMPORTANT**: For `GOOGLE_CLOUD_SERVICE_ACCOUNT`, paste the entire JSON as a single line.

## Step 2: Deploy the Edge Functions

Deploy the main document processor:
```bash
supabase functions deploy process-document-v2
```

Deploy the template analyzer:
```bash
supabase functions deploy analyze-template
```

These will deploy all related modules for each function.

## Step 3: Test the Function

After deployment, you can test it:

```bash
supabase functions serve process-document-v2
```

Or invoke it directly:

```bash
curl -i --location --request POST \
  'https://fsqvguceukcyvyuekvbz.supabase.co/functions/v1/process-document-v2' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"fileUrl":"https://example.com/document.pdf","fileName":"test.pdf","userId":"user-id","categoryId":"category-id","timeline":"standard"}'
```

## Function URL

Once deployed, your function will be available at:
```
https://fsqvguceukcyvyuekvbz.supabase.co/functions/v1/process-document-v2
```

## Troubleshooting

### Check function logs:
```bash
supabase functions logs process-document-v2
```

### Common issues:
1. **Missing environment variables**: Make sure all secrets are set in the dashboard
2. **Import errors**: Deno uses URLs for imports, make sure all imports use full URLs
3. **CORS errors**: The function includes CORS headers, but verify in browser console
