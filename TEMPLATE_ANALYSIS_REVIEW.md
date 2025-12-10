# Template Analysis & Matching - Comprehensive Review

## 📊 Current System Analysis

### ✅ What's Working Well

1. **Template Upload Flow** (`analyze-template` Edge Function)
   - ✅ PDF upload to Supabase Storage
   - ✅ Text extraction via PDF.co API
   - ✅ AI analysis using OpenAI GPT-4o-mini
   - ✅ Database storage with proper fields

2. **Database Schema**
   - ✅ Migration `20231201000002_add_template_analysis_fields.sql` adds:
     - `full_template_text` (TEXT) - Complete extracted text
     - `content_profile` (JSONB) - Document type and keywords

3. **Template Matching** (`template-matcher-robust.ts`)
   - ✅ Keyword-based scoring system
   - ✅ Uses `content_profile.keywords` for matching
   - ✅ Fallback to first template if no good match

---

## ⚠️ Identified Issues & Improvements Needed

### Issue 1: **AI Analysis Prompt Lacks Specificity**

**Location**: `supabase/functions/analyze-template/index.ts` (lines 85-102)

**Problem**: The prompt doesn't guide the AI to extract comprehensive keywords and semantic information.

**Current Prompt**:
```typescript
const analysisPrompt = `Analyze this PDF template and extract all form fields.
    
Template text:
${templateText}

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
}`;
```

**Issues**:
- Doesn't specify what kinds of keywords to extract
- No guidance on identifying format-specific indicators (old vs new format)
- Missing semantic field descriptions
- No instruction to identify structural patterns

---

### Issue 2: **Template Matcher Doesn't Use Full Template Text**

**Location**: `supabase/functions/process-document-v2/template-matcher-robust.ts`

**Problem**: The matcher uses `content_profile.keywords` but doesn't leverage `full_template_text` for more sophisticated matching.

**Current Implementation**:
```typescript
// Only uses keywords from content_profile
if (template.content_profile?.keywords) {
    const keywords = template.content_profile.keywords;
    keywords.forEach((keyword: string) => {
        if (lowerText.includes(keyword.toLowerCase())) {
            score += 5;
        }
    });
}
```

**Missing**:
- No semantic similarity comparison
- No structural pattern matching
- Doesn't use `full_template_text` for deep analysis

---

### Issue 3: **Hardcoded Template Matching Logic**

**Location**: `template-matcher-robust.ts` (lines 23-67)

**Problem**: All matching logic is hardcoded with specific keywords. This won't scale as new templates are added.

**Current Approach**:
```typescript
// Birth certificate patterns
if (templateName.includes('nacimiento') || templateName.includes('birth')) {
    if (lowerText.includes('registro civil de nacimiento') ||
        lowerText.includes('certificado de nacimiento')) {
        score += 50;
    }
    // ...
}
```

**Issues**:
- Requires code changes for each new template type
- Doesn't adapt to variations in document language/format
- Template name is used for matching (fragile)

---

### Issue 4: **Missing Validation of Template Analysis Results**

**Location**: `analyze-template/index.ts`

**Problem**: No validation that the AI actually extracted meaningful data.

**Missing Checks**:
- ✗ Verify `templateText` is not empty
- ✗ Validate `analysis.fields` has at least some fields
- ✗ Check `analysis.keywords` is meaningful
- ✗ Ensure `documentType` is one of the expected types

---

### Issue 5: **No Semantic Field Descriptions**

**Problem**: The `content_profile` doesn't include semantic descriptions of what the template is for.

**Current Structure**:
```json
{
  "documentType": "birth_certificate",
  "keywords": ["registro civil", "nacimiento"]
}
```

**Missing**:
- Purpose/description of the template
- Expected field structure
- Format indicators (old/new, version, etc.)
- Typical use cases

---

## 🔧 Recommended Improvements

### Improvement 1: Enhanced Template Analysis Prompt

**File**: `supabase/functions/analyze-template/index.ts`

**New Prompt**:
```typescript
const analysisPrompt = `You are analyzing a PDF template for Colombian civil registry documents.

Template text:
${templateText}

Analyze this template thoroughly and return a JSON object with:

{
  "fields": [
    {
      "name": "field_name",
      "type": "text|date|checkbox|number",
      "description": "detailed description of what this field represents",
      "required": true|false,
      "expectedFormat": "format hint if applicable (e.g., DD/MM/YYYY for dates)"
    }
  ],
  "documentType": "birth_certificate|passport|marriage_certificate|dian|other",
  "keywords": [
    "List of 10-20 distinctive keywords that appear in this template",
    "Include official terms, field labels, headers, and unique phrases",
    "Examples: 'REGISTRO CIVIL', 'NOTARÍA', 'REPÚBLICA DE COLOMBIA'"
  ],
  "formatIndicators": {
    "version": "old|new|standard",
    "specificMarkers": ["libro", "folio"] or ["NUIP", "tarjeta de identidad"],
    "description": "What makes this format unique"
  },
  "semanticDescription": "A detailed description of what this template is for, its purpose, and typical use cases",
  "structuralPatterns": [
    "Describe the layout/structure of the document",
    "e.g., 'Header with official seal', 'Two-column layout', 'Footer with signatures'"
  ]
}

IMPORTANT:
1. Extract ALL visible text labels and field names
2. Identify format-specific markers (old vs new format indicators)
3. Include official terminology and legal phrases
4. Note any unique structural elements
5. Be comprehensive - more keywords are better than fewer`;
```

---

### Improvement 2: Enhanced Content Profile Schema

**Migration Update** (optional new migration):
```sql
-- Add enhanced fields to content_profile
COMMENT ON COLUMN document_templates.content_profile IS 'Enhanced JSON object:
{
  "documentType": "birth_certificate|passport|...",
  "keywords": ["array of distinctive keywords"],
  "formatIndicators": {
    "version": "old|new|standard",
    "specificMarkers": ["markers"],
    "description": "format description"
  },
  "semanticDescription": "detailed description",
  "structuralPatterns": ["layout patterns"]
}';
```

---

### Improvement 3: AI-Powered Template Matching

**New Approach**: Use OpenAI to match templates instead of hardcoded rules.

**New File**: `supabase/functions/process-document-v2/template-matcher-ai.ts`

```typescript
interface Template {
    id: string;
    name: string;
    category_id: string;
    field_definitions: any[];
    full_template_text?: string;
    content_profile?: any;
}

export const matchTemplateWithAI = async (
    documentText: string, 
    templates: Template[]
): Promise<Template | null> => {
    if (!templates || templates.length === 0) {
        console.warn("No templates provided for matching");
        return null;
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY not set");
    }

    // Prepare template summaries for AI
    const templateSummaries = templates.map((t, idx) => ({
        index: idx,
        name: t.name,
        documentType: t.content_profile?.documentType || "unknown",
        keywords: t.content_profile?.keywords || [],
        formatIndicators: t.content_profile?.formatIndicators || {},
        semanticDescription: t.content_profile?.semanticDescription || "",
        sampleText: t.full_template_text?.substring(0, 500) || ""
    }));

    const prompt = `You are an expert at matching documents to templates.

User uploaded document text (first 1000 characters):
${documentText.substring(0, 1000)}

Available templates:
${JSON.stringify(templateSummaries, null, 2)}

Analyze the document and determine which template it matches best.

Return a JSON object:
{
  "matchedTemplateIndex": <index of best matching template>,
  "confidence": <0-100>,
  "reasoning": "Brief explanation of why this template matches",
  "alternativeMatches": [<array of other possible template indices>]
}

Consider:
1. Document type indicators (birth certificate, passport, etc.)
2. Format-specific markers (old vs new format)
3. Keyword presence and frequency
4. Structural similarities
5. Official terminology`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { 
                        role: "system", 
                        content: "You are an expert at document classification and template matching for Colombian civil registry documents." 
                    },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                response_format: { type: "json_object" }
            }),
        });

        if (!response.ok) {
            console.error("AI matching failed, falling back to keyword matching");
            return fallbackKeywordMatch(documentText, templates);
        }

        const data = await response.json();
        const result = JSON.parse(data.choices?.[0]?.message?.content || "{}");

        const matchedIndex = result.matchedTemplateIndex;
        const confidence = result.confidence || 0;

        console.log(`AI matched template: ${templates[matchedIndex]?.name} (confidence: ${confidence}%)`);
        console.log(`Reasoning: ${result.reasoning}`);

        if (confidence >= 60 && matchedIndex >= 0 && matchedIndex < templates.length) {
            return templates[matchedIndex];
        }

        // Fallback to keyword matching if confidence is low
        console.warn(`Low confidence (${confidence}%), using fallback matching`);
        return fallbackKeywordMatch(documentText, templates);

    } catch (error) {
        console.error("Error in AI template matching:", error);
        return fallbackKeywordMatch(documentText, templates);
    }
};

// Keep the existing keyword-based matching as fallback
function fallbackKeywordMatch(text: string, templates: Template[]): Template | null {
    // Use the existing template-matcher-robust.ts logic here
    const lowerText = text.toLowerCase();
    
    const scores = templates.map(template => {
        let score = 0;
        
        // Check keywords from content_profile
        if (template.content_profile?.keywords) {
            template.content_profile.keywords.forEach((keyword: string) => {
                if (lowerText.includes(keyword.toLowerCase())) {
                    score += 5;
                }
            });
        }
        
        return { template, score };
    });
    
    scores.sort((a, b) => b.score - a.score);
    
    return scores[0]?.score > 10 ? scores[0].template : templates[0];
}
```

---

### Improvement 4: Add Validation to Template Analysis

**File**: `supabase/functions/analyze-template/index.ts`

**Add after line 127**:
```typescript
const analysis = JSON.parse(analysisText);

// VALIDATION
if (!templateText || templateText.length < 50) {
    throw new Error("Template text extraction failed - text too short");
}

if (!analysis.fields || analysis.fields.length === 0) {
    console.warn("No fields detected in template - AI may have failed");
    // Continue anyway, but log warning
}

if (!analysis.keywords || analysis.keywords.length < 3) {
    console.warn("Very few keywords extracted - template analysis may be incomplete");
}

const validDocTypes = ['birth_certificate', 'passport', 'marriage_certificate', 'dian', 'other'];
if (!validDocTypes.includes(analysis.documentType)) {
    console.warn(`Unexpected document type: ${analysis.documentType}`);
    analysis.documentType = 'other';
}

console.log(`Template analysis complete:`);
console.log(`- Fields detected: ${analysis.fields?.length || 0}`);
console.log(`- Keywords extracted: ${analysis.keywords?.length || 0}`);
console.log(`- Document type: ${analysis.documentType}`);
console.log(`- Template text length: ${templateText.length} characters`);
```

---

### Improvement 5: Add Template Re-Analysis Function

**New File**: `supabase/functions/reanalyze-template/index.ts`

This would allow admins to re-analyze existing templates if the AI prompt is improved.

```typescript
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
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { templateId } = await req.json();

        // Fetch existing template
        const { data: template, error: fetchError } = await supabase
            .from('document_templates')
            .select('*')
            .eq('id', templateId)
            .single();

        if (fetchError || !template) {
            throw new Error("Template not found");
        }

        // Re-analyze using the full_template_text
        // (Use the same AI analysis logic from analyze-template)
        
        // Update the template with new analysis
        // ...

        return new Response(
            JSON.stringify({ success: true, template }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
```

---

## 🎯 Implementation Priority

### High Priority (Do First)
1. ✅ **Enhance Template Analysis Prompt** - Immediate improvement to template quality
2. ✅ **Add Validation** - Catch issues early
3. ✅ **Log Template Analysis Results** - Better debugging

### Medium Priority (Do Soon)
4. **Implement AI-Powered Matching** - More accurate than keyword matching
5. **Update Content Profile Schema** - Store richer metadata

### Low Priority (Nice to Have)
6. **Re-analysis Function** - For updating existing templates
7. **Admin UI Improvements** - Show analysis quality metrics

---

## 🧪 Testing Checklist

After implementing improvements:

- [ ] Upload a new template and verify enhanced `content_profile`
- [ ] Check logs to see detailed analysis results
- [ ] Test template matching with various documents
- [ ] Compare AI matching vs keyword matching accuracy
- [ ] Verify fallback logic works when AI fails
- [ ] Test with edge cases (poor quality scans, unusual formats)

---

## 📝 Summary

The current template analysis system is **functional but basic**. The main improvements needed are:

1. **Better AI prompts** for template analysis
2. **Richer metadata** in `content_profile`
3. **AI-powered matching** instead of hardcoded rules
4. **Validation and logging** for debugging
5. **Flexibility** to handle new template types without code changes

These improvements will make the system more robust, accurate, and maintainable.
