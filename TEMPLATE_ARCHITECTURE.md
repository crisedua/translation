# Template System Architecture

## System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TEMPLATE MANAGEMENT SYSTEM                       │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ ADMIN SIDE - Template Upload & Analysis                                  │
└──────────────────────────────────────────────────────────────────────────┘

    [Admin] → /admin/templates
                    ↓
            ┌───────────────┐
            │ TemplateAdmin │ (React Component)
            │     .tsx      │
            └───────────────┘
                    ↓
            Upload PDF Template
                    ↓
    ┌───────────────────────────────────┐
    │   Supabase Storage                │
    │   Bucket: documents               │
    │   Path: templates/[filename].pdf  │
    └───────────────────────────────────┘
                    ↓
    ┌───────────────────────────────────────────────────────────┐
    │   Edge Function: analyze-template                         │
    │   ────────────────────────────────────────────────────   │
    │   1. Download PDF from Storage                            │
    │   2. Extract text using PDF.co API                        │
    │   3. Send to OpenAI GPT-4o-mini:                         │
    │      • Detect all form fields                             │
    │      • Identify document type                             │
    │      • Extract keywords                                   │
    │   4. Save to database:                                    │
    │      • field_definitions (array)                          │
    │      • full_template_text (string)                        │
    │      • content_profile (json)                             │
    └───────────────────────────────────────────────────────────┘
                    ↓
    ┌───────────────────────────────────┐
    │   Database: document_templates    │
    │   ─────────────────────────────   │
    │   • id                            │
    │   • name                          │
    │   • category_id                   │
    │   • template_file_url             │
    │   • field_definitions (JSONB)     │
    │   • full_template_text (TEXT)     │
    │   • content_profile (JSONB)       │
    └───────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────┐
│ USER SIDE - Document Processing & Template Matching                      │
└──────────────────────────────────────────────────────────────────────────┘

    [User] → / (Home Page)
                ↓
        ┌───────────────┐
        │ DocumentUpload│ (React Component)
        │     .tsx      │
        └───────────────┘
                ↓
        Upload Document (PDF/JPG/PNG)
                ↓
    ┌───────────────────────────────────┐
    │   Supabase Storage                │
    │   Bucket: documents               │
    │   Path: uploads/[filename]        │
    └───────────────────────────────────┘
                ↓
    ┌─────────────────────────────────────────────────────────────────┐
    │   Edge Function: process-document-v2                            │
    │   ─────────────────────────────────────────────────────────     │
    │                                                                  │
    │   STEP 1: Convert & Extract                                     │
    │   ├─ Convert PDF to images (PDF.co)                            │
    │   └─ OCR text extraction (Google Cloud Vision)                 │
    │                                                                  │
    │   STEP 2: Template Matching (template-matcher-robust.ts)       │
    │   ├─ Fetch all templates in selected category                  │
    │   ├─ Score each template:                                      │
    │   │   • Document type indicators (+50 points)                  │
    │   │   • Format-specific keywords (+30 points)                  │
    │   │   • Template keywords (+5 each)                            │
    │   └─ Select best match (score > 30)                            │
    │                                                                  │
    │   STEP 3: Data Extraction (ai-extractor.ts)                    │
    │   ├─ Use matched template's field_definitions                  │
    │   ├─ Send OCR text + field definitions to OpenAI              │
    │   └─ Extract structured data                                   │
    │                                                                  │
    │   STEP 4: Validation & Save                                    │
    │   ├─ Validate required fields                                  │
    │   ├─ Check data formats                                        │
    │   └─ Save to document_requests table                           │
    │                                                                  │
    └─────────────────────────────────────────────────────────────────┘
                ↓
    ┌───────────────────────────────────┐
    │   Database: document_requests     │
    │   ─────────────────────────────   │
    │   • id                            │
    │   • template_id (matched)         │
    │   • original_file_url             │
    │   • extracted_data (JSONB)        │
    │   • ocr_text                      │
    │   • status                        │
    └───────────────────────────────────┘
                ↓
    [Admin] → /admin/requests/:id
                ↓
        Review & Approve


┌──────────────────────────────────────────────────────────────────────────┐
│ TEMPLATE MATCHING ALGORITHM DETAILS                                      │
└──────────────────────────────────────────────────────────────────────────┘

Input: OCR Text from User Document
       Templates in Selected Category

Process:
    FOR EACH template:
        score = 0
        
        // Primary Document Type Matching
        IF template.name contains "birth" OR "nacimiento":
            IF text contains "registro civil de nacimiento":
                score += 50
        
        IF template.name contains "passport" OR "pasaporte":
            IF text contains "pasaporte":
                score += 50
        
        // Format-Specific Matching
        IF template.name contains "old" OR "antiguo":
            IF text contains "libro" AND "folio":
                score += 30
        
        IF template.name contains "new" OR "nuevo":
            IF text contains "nuip" OR "tarjeta de identidad":
                score += 30
        
        // Keyword Matching from content_profile
        FOR EACH keyword in template.content_profile.keywords:
            IF text contains keyword:
                score += 5
        
        RETURN { template, score }
    
    // Select Best Match
    best_match = template with highest score
    IF best_match.score > 30:
        RETURN best_match
    ELSE:
        RETURN first_template (fallback)


┌──────────────────────────────────────────────────────────────────────────┐
│ DATA FLOW EXAMPLE: Birth Certificate                                     │
└──────────────────────────────────────────────────────────────────────────┘

1. ADMIN UPLOADS TEMPLATE
   ├─ File: "Birth_Certificate_Old_Format.pdf"
   ├─ Category: "Birth Certificate"
   └─ AI Analysis Result:
       {
         "fields": [
           { "name": "nombres", "type": "text", "required": true },
           { "name": "apellidos", "type": "text", "required": true },
           { "name": "fecha_nacimiento", "type": "date", "required": true },
           ...
         ],
         "documentType": "birth_certificate",
         "keywords": ["registro civil", "nacimiento", "notaría", "libro", "folio"]
       }

2. USER UPLOADS DOCUMENT
   ├─ File: "juan_birth_cert.pdf"
   ├─ Category: "Birth Certificate"
   └─ OCR Text: "REGISTRO CIVIL DE NACIMIENTO ... Libro: 123 Folio: 456 ..."

3. TEMPLATE MATCHING
   ├─ Template "Birth Certificate - Old Format": 80 points
   │   • +50 (contains "registro civil de nacimiento")
   │   • +30 (contains "libro" + "folio")
   ├─ Template "Birth Certificate - New Format": 50 points
   │   • +50 (contains "registro civil de nacimiento")
   └─ ✅ MATCH: "Birth Certificate - Old Format"

4. DATA EXTRACTION
   ├─ Using matched template's field_definitions
   ├─ OpenAI extracts:
   │   {
   │     "nombres": "JUAN CARLOS",
   │     "apellidos": "RODRIGUEZ GARCIA",
   │     "fecha_nacimiento": "1990-05-15",
   │     ...
   │   }
   └─ Saved to document_requests.extracted_data

5. ADMIN REVIEW
   └─ Admin sees extracted data, can edit, approve, generate final document


┌──────────────────────────────────────────────────────────────────────────┐
│ EXTERNAL API DEPENDENCIES                                                │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│   PDF.co API    │  • PDF to text conversion
│                 │  • PDF to image conversion
└─────────────────┘

┌─────────────────┐
│   OpenAI API    │  • Template field analysis (GPT-4o-mini)
│  (GPT-4o-mini)  │  • Data extraction from documents
└─────────────────┘

┌─────────────────┐
│ Google Cloud    │  • OCR text extraction from images
│  Vision API     │  • Handwriting recognition
└─────────────────┘


┌──────────────────────────────────────────────────────────────────────────┐
│ DATABASE SCHEMA                                                           │
└──────────────────────────────────────────────────────────────────────────┘

document_templates
├─ id (uuid, PK)
├─ category_id (uuid, FK → document_categories)
├─ name (text)
├─ template_file_url (text)
├─ field_definitions (jsonb) ← Array of field objects
├─ full_template_text (text) ← For matching
├─ content_profile (jsonb) ← { documentType, keywords }
└─ created_at (timestamp)

document_requests
├─ id (uuid, PK)
├─ template_id (uuid, FK → document_templates) ← Matched template
├─ original_file_url (text)
├─ extracted_data (jsonb) ← Extracted field values
├─ ocr_text (text)
├─ status (text)
└─ created_at (timestamp)
```
