# Setup Instructions

## ✅ Google Cloud Vision - CONFIGURED

Your Google Cloud service account has been configured in `.env.local`.

**Service Account:** `translation@traduccion-471914.iam.gserviceaccount.com`
**Project ID:** `traduccion-471914`

The system will automatically:
1. Generate JWT tokens from your service account
2. Exchange them for access tokens
3. Use the access tokens to call the Vision API

## 🔧 Remaining API Keys Needed

### 1. PDF.co API Key
- Sign up at: https://pdf.co/
- Get your API key from the dashboard
- Add to `.env.local`: `PDF_CO_API_KEY=your_key_here`

### 2. OpenAI API Key
- Sign up at: https://platform.openai.com/
- Create an API key
- Add to `.env.local`: `OPENAI_API_KEY=sk-...`

### 3. Resend API Key (for email notifications)
- Sign up at: https://resend.com/
- Get your API key
- Add to `.env.local`: `RESEND_API_KEY=re_...`

### 4. Supabase Setup
1. Create a project at: https://supabase.com/
2. Get your project URL and anon key from Settings > API
3. Add to `.env.local`:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key
   ```

## 📦 Deploy to Supabase

### 1. Install Supabase CLI
```bash
npm install -g supabase
```

### 2. Login to Supabase
```bash
supabase login
```

### 3. Link to your project
```bash
supabase link --project-ref your-project-ref
```

### 4. Apply database migrations
```bash
supabase db push
```

### 5. Deploy Edge Functions
```bash
supabase functions deploy process-document-v2
```

### 6. Set Environment Variables in Supabase
Go to your Supabase dashboard > Edge Functions > Settings and add:
- `GOOGLE_CLOUD_SERVICE_ACCOUNT` (paste the entire JSON)
- `PDF_CO_API_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`

## 🧪 Testing Locally

To test the Edge Functions locally:
```bash
supabase functions serve process-document-v2
```

## 🚀 Next Steps

1. Get the remaining API keys
2. Set up Supabase project
3. Deploy the Edge Functions
4. Test document upload and processing
