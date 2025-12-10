# Template Management & Document Processing Workflow

## 📋 Overview

The system uses uploaded PDF templates to match and extract data from user-submitted documents. Here's how it works:

## 🔄 Complete Workflow

### 1. Admin Uploads Templates

**Location**: `/admin/templates` page

1. Admin logs in to admin panel
2. Navigates to Template Management
3. Uploads a PDF template (e.g., "Birth Certificate - Old Format.pdf")
4. Selects document category
5. System automatically:
   - Uploads PDF to Supabase Storage
   - Extracts text from PDF using PDF.co
   - Analyzes template with OpenAI to detect fields
   - Saves template with field definitions to database

### 2. User Uploads Document

**Location**: `/` (home page)

1. User selects document category
2. Chooses delivery timeline
3. Uploads their document (PDF/JPG/PNG)
4. Clicks "Process Document"

### 3. System Processes Document

**Backend**: `process-document-v2` Edge Function

1. **Convert**: PDF → Images (if needed) via PDF.co
2. **OCR**: Extract text via Google Cloud Vision
3. **Match**: Find best matching template from uploaded templates
4. **Extract**: Use OpenAI to extract structured data based on template fields
5. **Validate**: Check required fields and formats
6. **Save**: Store in database with status
7. **Notify**: Send email to user (optional)

### 4. Admin Reviews Request

**Location**: `/admin/requests/:id`

1. Admin sees extracted data
2. Can edit/correct any fields
3. Approves or rejects request
4. System generates final translated document

## 📁 Template Structure

Each template contains:
- **PDF file**: The actual template document
- **Field definitions**: Auto-detected fields (name, type, description)
- **Content profile**: Document type, keywords for matching
- **Full text**: Extracted text for matching algorithm

## 🎯 Matching Algorithm

When a document is uploaded, the system:
1. Extracts text from the document
2. Compares against all templates in the selected category
3. Uses keyword matching and document indicators
4. Selects best matching template
5. Uses that template's field definitions for extraction

## 📝 Example Flow

```
Admin uploads: "Birth Certificate - Old Format.pdf"
↓
System detects fields: nombres, apellidos, fecha_nacimiento, etc.
↓
User uploads: "Juan's birth certificate.pdf"
↓
System matches to "Birth Certificate - Old Format"
↓
Extracts data using detected fields
↓
Admin reviews and approves
↓
Final document generated
```

## 🔧 Setup Requirements

Before templates can be used:

1. ✅ Database migrations applied
2. ✅ Storage bucket `documents` created
3. ✅ Edge Functions deployed:
   - `analyze-template`
   - `process-document-v2`
4. ✅ Categories seeded (Birth Certificate, Passport, etc.)

## 📚 Related Files

- [TemplateAdmin.tsx](file:///c:/Desarrollo%20Cursos/new_translation/src/pages/TemplateAdmin.tsx) - Template upload UI
- [analyze-template/index.ts](file:///c:/Desarrollo%20Cursos/new_translation/supabase/functions/analyze-template/index.ts) - Template analysis
- [template-matcher-robust.ts](file:///c:/Desarrollo%20Cursos/new_translation/supabase/functions/process-document-v2/template-matcher-robust.ts) - Matching logic
- [STORAGE_SETUP.md](file:///c:/Desarrollo%20Cursos/new_translation/supabase/STORAGE_SETUP.md) - Storage configuration
