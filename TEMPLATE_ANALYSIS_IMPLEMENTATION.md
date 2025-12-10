# Template Analysis & Matching Implementation

## ✅ What's Been Implemented

### 1. **Template Upload & Analysis** (`analyze-template` Edge Function)

When an admin uploads a template via `/admin/templates`, the system:

1. **Uploads PDF** to Supabase Storage (`documents/templates/` folder)
2. **Extracts Text** using PDF.co API
3. **AI Analysis** using OpenAI GPT-4o-mini to:
   - Detect all form fields (name, type, description, required)
   - Identify document type (birth_certificate, passport, marriage_certificate, dian)
   - Extract keywords for matching
4. **Saves to Database**:
   - `field_definitions` - Array of detected fields
   - `full_template_text` - Complete extracted text
   - `content_profile` - Document type and keywords

**File**: `supabase/functions/analyze-template/index.ts`

### 2. **Template Matching Algorithm** (`template-matcher-robust.ts`)

When a user uploads a document, the system:

1. **Extracts text** from the uploaded document (OCR via Google Cloud Vision)
2. **Compares** against all templates in the selected category
3. **Scores each template** based on:
   - Document type indicators (e.g., "registro civil de nacimiento")
   - Format-specific keywords (e.g., "libro", "folio" for old format)
   - Template-specific keywords from `content_profile`
4. **Selects best match** (minimum score threshold: 30)
5. **Uses matched template's fields** for data extraction

**File**: `supabase/functions/process-document-v2/template-matcher-robust.ts`

### 3. **Scoring System**

The matching algorithm uses weighted scoring:

- **Primary indicators** (document type): +50 points
  - "registro civil de nacimiento" → Birth Certificate
  - "pasaporte" → Passport
  - "matrimonio" → Marriage Certificate
  - "dian" → DIAN documents

- **Format indicators**: +30 points
  - Old format: "libro" + "folio"
  - New format: "nuip" or "tarjeta de identidad"

- **Template keywords**: +5 points each
  - From AI-extracted keywords in `content_profile`

- **Fallback**: If no template scores >30, uses first template in category

### 4. **Database Schema**

**Migration Created**: `20231201000002_add_template_analysis_fields.sql`

Added to `document_templates` table:
- `full_template_text` (text) - Full extracted PDF text
- `content_profile` (jsonb) - Contains:
  ```json
  {
    "documentType": "birth_certificate",
    "keywords": ["registro civil", "nacimiento", "notaría"]
  }
  ```

## 🔄 Complete Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ADMIN UPLOADS TEMPLATE                                   │
│    /admin/templates                                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. ANALYZE-TEMPLATE FUNCTION                                │
│    • Upload PDF to Storage                                  │
│    • Extract text with PDF.co                               │
│    • AI analysis with OpenAI                                │
│    • Save field_definitions + content_profile               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. USER UPLOADS DOCUMENT                                    │
│    / (home page)                                             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. PROCESS-DOCUMENT-V2 FUNCTION                             │
│    • Convert PDF to images (if needed)                      │
│    • OCR with Google Cloud Vision                           │
│    • Fetch all templates in category                        │
│    • Match template using scoring algorithm                 │
│    • Extract data using matched template fields             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. ADMIN REVIEWS & APPROVES                                 │
│    /admin/requests/:id                                       │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Required Setup Steps

### ✅ Already Done:
1. ✅ Template upload UI (`TemplateAdmin.tsx`)
2. ✅ Template analysis function (`analyze-template`)
3. ✅ Template matching algorithm (`template-matcher-robust.ts`)
4. ✅ Database migration created

### 🔧 TODO - Apply Migration:

You need to apply the new migration to add the required fields:

```bash
# Option 1: Using Supabase CLI (recommended)
cd "c:\Desarrollo Cursos\new_translation"
supabase db reset  # Resets and applies all migrations

# Option 2: Apply specific migration
supabase migration up
```

**OR** manually run the SQL in Supabase Dashboard:
1. Go to Supabase Dashboard → SQL Editor
2. Run the contents of `supabase/migrations/20231201000002_add_template_analysis_fields.sql`

### 🔧 TODO - Deploy Edge Functions:

```bash
# Deploy analyze-template function
supabase functions deploy analyze-template

# Deploy process-document-v2 function
supabase functions deploy process-document-v2
```

### 🔧 TODO - Set Environment Variables:

Make sure these are set in Supabase Dashboard → Settings → Edge Functions → Secrets:

```
OPENAI_API_KEY=sk-...
PDF_CO_API_KEY=...
GOOGLE_CLOUD_VISION_API_KEY=...
```

## 🎯 How Matching Works - Examples

### Example 1: Old Format Birth Certificate

**User uploads**: Document with text containing:
- "REGISTRO CIVIL DE NACIMIENTO"
- "Libro: 123"
- "Folio: 456"

**Matching scores**:
- Template "Birth Certificate - Old Format": 80 points
  - +50 (contains "registro civil de nacimiento")
  - +30 (contains "libro" + "folio")
- Template "Birth Certificate - New Format": 50 points
  - +50 (contains "registro civil de nacimiento")
  - +0 (no "nuip" or "tarjeta de identidad")

**Result**: Matches "Birth Certificate - Old Format" ✅

### Example 2: Passport

**User uploads**: Document with text containing:
- "PASAPORTE"
- "REPÚBLICA DE COLOMBIA"

**Matching scores**:
- Template "Colombian Passport": 70 points
  - +50 (contains "pasaporte")
  - +20 (contains "república de colombia")
- Template "Birth Certificate": 0 points

**Result**: Matches "Colombian Passport" ✅

## 🔍 Debugging Template Matching

To see which template was matched, check the logs in:
- Supabase Dashboard → Edge Functions → process-document-v2 → Logs

Look for:
```
Matched template: [Template Name] with score [Score]
```

Or:
```
No template matched with sufficient confidence
```

## 📝 AI Prompt for Template Analysis

The `analyze-template` function uses this prompt:

```
Analyze this PDF template and extract all form fields.

Template text:
[Full extracted text from PDF]

Return a JSON object with:
{
  "fields": [
    {
      "name": "field_name",
      "type": "text|date|checkbox|number",
      "description": "what this field represents",
      "required": true|false
    }
  ],
  "documentType": "birth_certificate|passport|marriage_certificate|dian",
  "keywords": ["keyword1", "keyword2"]
}
```

## 🚀 Testing the Implementation

### 1. Upload a Template:
1. Go to `/admin/templates`
2. Upload a sample birth certificate template
3. Check Supabase logs to verify analysis completed
4. Check database to see `content_profile` was saved

### 2. Test Matching:
1. Upload a user document via home page
2. Check `process-document-v2` logs for matching score
3. Verify correct template was selected
4. Check extracted data matches template fields

## 📚 Related Files

- **UI**: `src/pages/TemplateAdmin.tsx`
- **Analysis**: `supabase/functions/analyze-template/index.ts`
- **Matching**: `supabase/functions/process-document-v2/template-matcher-robust.ts`
- **Processing**: `supabase/functions/process-document-v2/index.ts`
- **Migration**: `supabase/migrations/20231201000002_add_template_analysis_fields.sql`
- **Workflow**: `TEMPLATE_WORKFLOW.md`

## ⚠️ Important Notes

1. **Migration Required**: The new fields won't work until migration is applied
2. **Re-upload Templates**: After applying migration, you may need to re-upload existing templates to populate the new fields
3. **Minimum Score**: Templates need score >30 to match, otherwise falls back to first template
4. **Category Filtering**: Matching only compares templates within the selected category
5. **AI Costs**: Each template upload calls OpenAI API (GPT-4o-mini)
