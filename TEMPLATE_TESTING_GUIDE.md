# Template System Testing Guide

## 🧪 Quick Testing Checklist

### Prerequisites
- [ ] Database migration applied (`20231201000002_add_template_analysis_fields.sql`)
- [ ] Edge Functions deployed (`analyze-template`, `process-document-v2`)
- [ ] Environment variables set in Supabase Dashboard:
  - [ ] `OPENAI_API_KEY`
  - [ ] `PDF_CO_API_KEY`
  - [ ] `GOOGLE_CLOUD_VISION_API_KEY`
- [ ] Categories seeded in database

---

## Test 1: Upload a Template

### Steps:
1. Navigate to `/admin/templates`
2. Fill in the form:
   - **Template Name**: "Birth Certificate - Old Format"
   - **Category**: Select "Birth Certificate"
   - **PDF Template**: Upload a sample birth certificate PDF
3. Click "Upload Template"

### Expected Results:
✅ Success message: "Template uploaded and analyzed successfully!"
✅ Template appears in "Existing Templates" list
✅ Shows number of fields detected (e.g., "12 fields detected")

### Verify in Database:
```sql
SELECT 
  name,
  category_id,
  jsonb_array_length(field_definitions) as field_count,
  length(full_template_text) as text_length,
  content_profile->>'documentType' as doc_type,
  jsonb_array_length(content_profile->'keywords') as keyword_count
FROM document_templates
ORDER BY created_at DESC
LIMIT 1;
```

### Expected Database Values:
- `field_definitions`: Array with detected fields
- `full_template_text`: Should contain extracted text (length > 0)
- `content_profile`: Should have `documentType` and `keywords`

### Check Logs:
Supabase Dashboard → Edge Functions → `analyze-template` → Logs

Look for:
```
Analyzing template: Birth Certificate - Old Format
```

---

## Test 2: Upload a User Document (Template Matching)

### Steps:
1. Navigate to `/` (home page)
2. Select category: "Birth Certificate"
3. Select delivery timeline: "Standard (5-7 days)"
4. Upload a sample birth certificate document
5. Click "Process Document"

### Expected Results:
✅ Success message or redirect to request review page
✅ Document processing completes

### Verify Template Matching in Logs:
Supabase Dashboard → Edge Functions → `process-document-v2` → Logs

Look for:
```
Matched template: Birth Certificate - Old Format with score 80
```

Or check for scoring details:
```
Template scores:
- Birth Certificate - Old Format: 80
- Birth Certificate - New Format: 50
```

### Verify in Database:
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

### Expected Database Values:
- `template_id`: Should match the uploaded template's ID
- `extracted_data`: Should contain extracted field values
- `status`: Should be "pending" or "processing"

---

## Test 3: Review Extracted Data

### Steps:
1. Navigate to `/admin/requests`
2. Click on the most recent request
3. Review extracted data

### Expected Results:
✅ All fields from template are shown
✅ Values are populated from the document
✅ Can edit field values
✅ Can approve/reject request

---

## Test 4: Test Different Document Types

### Birth Certificate - Old Format
**Indicators to include in test document:**
- "REGISTRO CIVIL DE NACIMIENTO"
- "Libro: [number]"
- "Folio: [number]"

**Expected Match**: Template with "old" or "antiguo" in name
**Expected Score**: 80+ points

### Birth Certificate - New Format
**Indicators to include in test document:**
- "REGISTRO CIVIL DE NACIMIENTO"
- "NUIP" or "Tarjeta de Identidad"

**Expected Match**: Template with "new" or "nuevo" in name
**Expected Score**: 80+ points

### Passport
**Indicators to include in test document:**
- "PASAPORTE"
- "REPÚBLICA DE COLOMBIA"

**Expected Match**: Passport template
**Expected Score**: 70+ points

---

## Test 5: Verify Keyword Matching

### Setup:
Upload a template and check the `content_profile.keywords` in the database.

### Test:
Upload a document that contains those keywords.

### Verify:
Check logs to see if keyword matching added points to the score.

Example log output:
```
Scoring template: Birth Certificate - Old Format
- Base score: 50 (document type match)
- Format bonus: 30 (old format indicators)
- Keyword matches: 3 keywords × 5 points = 15
- Total score: 95
```

---

## Test 6: Test Fallback Behavior

### Setup:
Upload a document that doesn't match any template well.

### Expected Behavior:
- All templates score < 30 points
- System falls back to first template in category
- Log shows: "No template matched with sufficient confidence"

### Verify in Logs:
```
No template matched with sufficient confidence
Using fallback template: [First Template Name]
```

---

## Debugging Common Issues

### Issue 1: Template Upload Fails
**Check:**
- [ ] PDF.co API key is set
- [ ] OpenAI API key is set
- [ ] Storage bucket "documents" exists
- [ ] Check `analyze-template` function logs for errors

### Issue 2: No Fields Detected
**Check:**
- [ ] Template PDF has extractable text (not scanned image)
- [ ] OpenAI API key is valid
- [ ] Check AI response in logs

### Issue 3: Wrong Template Matched
**Check:**
- [ ] Document contains expected keywords
- [ ] Template `content_profile` has correct keywords
- [ ] Check matching scores in logs
- [ ] Adjust scoring thresholds in `template-matcher-robust.ts`

### Issue 4: No Data Extracted
**Check:**
- [ ] Template has `field_definitions`
- [ ] OCR text extraction succeeded
- [ ] OpenAI API key is valid
- [ ] Check `process-document-v2` logs for extraction errors

---

## Performance Testing

### Template Upload
**Expected Time**: 10-30 seconds
- PDF upload: 1-2 seconds
- Text extraction: 3-5 seconds
- AI analysis: 5-15 seconds
- Database save: <1 second

### Document Processing
**Expected Time**: 20-45 seconds
- PDF to images: 5-10 seconds
- OCR: 5-10 seconds
- Template matching: <1 second
- Data extraction: 10-20 seconds
- Database save: <1 second

---

## SQL Queries for Testing

### View All Templates with Analysis Data
```sql
SELECT 
  id,
  name,
  category_id,
  jsonb_array_length(field_definitions) as fields,
  content_profile->>'documentType' as type,
  content_profile->'keywords' as keywords,
  created_at
FROM document_templates
ORDER BY created_at DESC;
```

### View Recent Requests with Matched Templates
```sql
SELECT 
  dr.id,
  dr.created_at,
  dt.name as template_name,
  dr.status,
  jsonb_object_keys(dr.extracted_data) as extracted_fields
FROM document_requests dr
LEFT JOIN document_templates dt ON dr.template_id = dt.id
ORDER BY dr.created_at DESC
LIMIT 10;
```

### Check Template Matching Success Rate
```sql
SELECT 
  dt.name as template_name,
  COUNT(dr.id) as times_matched
FROM document_requests dr
LEFT JOIN document_templates dt ON dr.template_id = dt.id
GROUP BY dt.name
ORDER BY times_matched DESC;
```

---

## API Testing with cURL

### Test analyze-template Function
```bash
curl -X POST https://[your-project].supabase.co/functions/v1/analyze-template \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "templateUrl": "https://[storage-url]/template.pdf",
    "templateName": "Test Template",
    "categoryId": "[category-uuid]"
  }'
```

### Test process-document-v2 Function
```bash
curl -X POST https://[your-project].supabase.co/functions/v1/process-document-v2 \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "documentUrl": "https://[storage-url]/document.pdf",
    "categoryId": "[category-uuid]",
    "deliveryTimeline": "standard"
  }'
```

---

## Success Criteria

### ✅ Template System is Working When:
1. Templates can be uploaded successfully
2. AI detects fields and keywords correctly
3. `full_template_text` and `content_profile` are populated
4. User documents match correct templates (score > 30)
5. Extracted data contains all template fields
6. Matching scores are logged correctly
7. Admin can review and approve requests

### ⚠️ System Needs Tuning When:
- Templates consistently match incorrectly
- Scores are too low (< 30 for correct matches)
- Too many fallback matches
- Field extraction is incomplete

### 🔧 Tuning Options:
1. Adjust scoring weights in `template-matcher-robust.ts`
2. Add more keywords to `content_profile`
3. Improve AI prompts in `analyze-template`
4. Add more document type indicators
5. Lower/raise minimum score threshold (currently 30)
