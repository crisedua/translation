# Quick Testing Guide - Enhanced Template Analysis

## 🧪 How to Test the Improvements

### Step 1: Deploy the Changes

```bash
# Deploy the updated Edge Functions
supabase functions deploy analyze-template
supabase functions deploy process-document-v2
```

### Step 2: Upload a Test Template

1. Go to: `http://localhost:5173/admin/templates` (or your deployed URL)
2. Upload a birth certificate template (PDF)
3. Fill in:
   - **Template Name**: "Birth Certificate - Old Format"
   - **Category**: Select "Birth Certificate"
4. Click "Upload Template"

### Step 3: Check the Logs

Go to: **Supabase Dashboard → Edge Functions → analyze-template → Logs**

You should see output like:
```
Analyzing template: Birth Certificate - Old Format
=== Template Analysis Validation ===
✓ Template text length: 1234 characters
✓ Fields detected: 15
✓ Keywords extracted: 18
✓ Document type: birth_certificate
✓ Format version: old
✓ Format markers: libro, folio, registro civil
✓ Semantic description: This template is for old format birth certificates...
=== Analysis Complete ===
```

### Step 4: Verify Database Storage

Run this query in Supabase SQL Editor:

```sql
SELECT 
  name,
  category_id,
  jsonb_array_length(field_definitions) as field_count,
  length(full_template_text) as text_length,
  content_profile->>'documentType' as doc_type,
  jsonb_array_length(content_profile->'keywords') as keyword_count,
  content_profile->'formatIndicators'->>'version' as format_version,
  content_profile->'formatIndicators'->'specificMarkers' as format_markers,
  content_profile->>'semanticDescription' as description
FROM document_templates
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Results**:
- `field_count`: > 0 (should have detected fields)
- `text_length`: > 50 (should have extracted text)
- `doc_type`: "birth_certificate" (or appropriate type)
- `keyword_count`: 10-20 (should have many keywords)
- `format_version`: "old", "new", "standard", or "unknown"
- `format_markers`: Array like `["libro", "folio"]`
- `description`: Detailed text description

### Step 5: Test Template Matching

1. Go to home page: `http://localhost:5173/`
2. Select category: "Birth Certificate"
3. Upload a sample birth certificate document
4. Click "Process Document"

### Step 6: Check Matching Logs

Go to: **Supabase Dashboard → Edge Functions → process-document-v2 → Logs**

You should see:
```
Template "Birth Certificate - Old Format" score: 85
Template "Birth Certificate - New Format" score: 45
Matched template: Birth Certificate - Old Format with score 85
```

### Step 7: Verify Extracted Data

Check the database:

```sql
SELECT 
  dr.id,
  dt.name as matched_template,
  dr.extracted_data,
  dr.status
FROM document_requests dr
LEFT JOIN document_templates dt ON dr.template_id = dt.id
ORDER BY dr.created_at DESC
LIMIT 1;
```

**Expected**:
- `matched_template`: Should match the correct template
- `extracted_data`: Should have extracted field values
- `status`: "pending" or "processing"

---

## 🔍 What to Look For

### ✅ Good Signs:
- Template text length > 500 characters
- 10+ keywords extracted
- Format version identified (not "unknown")
- Format markers present
- Semantic description is detailed
- Template matching score > 50 for correct template
- Template matching score < 30 for incorrect templates

### ⚠️ Warning Signs:
- Template text length < 100 characters → PDF extraction may have failed
- < 5 keywords → AI analysis may be incomplete
- Format version = "unknown" → AI couldn't identify format
- All templates have similar scores → Matching may not be working well

---

## 🐛 Troubleshooting

### Issue: "Template text extraction failed - text too short"
**Cause**: PDF.co couldn't extract text from the PDF
**Solution**: 
- Check if PDF is text-based (not scanned image)
- Verify PDF_CO_API_KEY is set correctly
- Try a different PDF

### Issue: "No fields detected in template"
**Cause**: AI couldn't identify form fields
**Solution**:
- Check if template actually has form fields
- Review the template text in logs
- May need to adjust AI prompt

### Issue: "Very few keywords extracted"
**Cause**: AI didn't extract enough keywords
**Solution**:
- Check template text quality
- May need to adjust AI prompt
- Template may be too simple

### Issue: Template matching scores are all low
**Cause**: Document doesn't match any template well
**Solution**:
- Verify document is the correct type
- Check if keywords from template appear in document
- May need to upload more templates

---

## 📊 Sample Test Data

### Good Template Analysis Result:
```json
{
  "documentType": "birth_certificate",
  "keywords": [
    "REGISTRO CIVIL DE NACIMIENTO",
    "REPÚBLICA DE COLOMBIA",
    "NOTARÍA",
    "LIBRO",
    "FOLIO",
    "NOMBRES",
    "APELLIDOS",
    "FECHA DE NACIMIENTO",
    "LUGAR DE NACIMIENTO",
    "PADRE",
    "MADRE",
    "REGISTRADOR",
    "FIRMA",
    "SELLO"
  ],
  "formatIndicators": {
    "version": "old",
    "specificMarkers": ["libro", "folio", "registro civil"],
    "description": "Old format with libro and folio numbers"
  },
  "semanticDescription": "Colombian birth certificate in old format...",
  "structuralPatterns": ["Header with seal", "Two-column layout"]
}
```

### Good Matching Result:
```
Template "Birth Certificate - Old Format" score: 95
  - Document type match: +40
  - Format markers (libro, folio): +30
  - Keywords (15 matches): +75
  - Version match: +10
  
Template "Birth Certificate - New Format" score: 35
  - Document type match: +40
  - Keywords (3 matches): +15
```

---

## 🎯 Success Criteria

Your implementation is working well if:
- ✅ Templates are analyzed with 10+ keywords
- ✅ Format version is correctly identified
- ✅ Template matching scores differ by at least 20 points
- ✅ Correct template has score > 60
- ✅ Validation logs show all ✓ (no ⚠)
- ✅ Extracted data is accurate

---

## 📝 Next Steps After Testing

If tests pass:
1. Deploy to production
2. Re-upload all existing templates
3. Monitor matching accuracy
4. Collect feedback from users

If tests fail:
1. Check logs for specific errors
2. Review troubleshooting section
3. Adjust AI prompts if needed
4. Contact support if issues persist
