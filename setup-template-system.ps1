# Template System Setup Script
# This script sets up the template analysis and matching system

Write-Host "🚀 Template System Setup" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
Write-Host "Checking Supabase CLI..." -ForegroundColor Yellow
$supabaseVersion = supabase --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Supabase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g supabase" -ForegroundColor White
    exit 1
}
Write-Host "✅ Supabase CLI found: $supabaseVersion" -ForegroundColor Green
Write-Host ""

# Step 1: Apply Database Migrations
Write-Host "📊 Step 1: Applying Database Migrations" -ForegroundColor Cyan
Write-Host "---------------------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will add the following fields to document_templates table:" -ForegroundColor White
Write-Host "  • full_template_text (for matching)" -ForegroundColor White
Write-Host "  • content_profile (for AI-based matching)" -ForegroundColor White
Write-Host ""

$applyMigration = Read-Host "Apply migration? (y/n)"
if ($applyMigration -eq 'y') {
    Write-Host "Applying migrations..." -ForegroundColor Yellow
    supabase db push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migrations applied successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Migration failed. Check the error above." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⏭️  Skipping migration" -ForegroundColor Yellow
}
Write-Host ""

# Step 2: Deploy Edge Functions
Write-Host "🔧 Step 2: Deploying Edge Functions" -ForegroundColor Cyan
Write-Host "-----------------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "Functions to deploy:" -ForegroundColor White
Write-Host "  1. analyze-template - Analyzes uploaded templates" -ForegroundColor White
Write-Host "  2. process-document-v2 - Processes user documents with template matching" -ForegroundColor White
Write-Host ""

$deployFunctions = Read-Host "Deploy functions? (y/n)"
if ($deployFunctions -eq 'y') {
    Write-Host ""
    Write-Host "Deploying analyze-template..." -ForegroundColor Yellow
    supabase functions deploy analyze-template
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ analyze-template deployed!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  analyze-template deployment had issues" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Deploying process-document-v2..." -ForegroundColor Yellow
    supabase functions deploy process-document-v2
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ process-document-v2 deployed!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  process-document-v2 deployment had issues" -ForegroundColor Yellow
    }
} else {
    Write-Host "⏭️  Skipping function deployment" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Check Environment Variables
Write-Host "🔑 Step 3: Environment Variables Check" -ForegroundColor Cyan
Write-Host "-------------------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "Required environment variables (set in Supabase Dashboard):" -ForegroundColor White
Write-Host ""
Write-Host "  ✓ OPENAI_API_KEY - For AI template analysis and data extraction" -ForegroundColor White
Write-Host "  ✓ PDF_CO_API_KEY - For PDF text extraction" -ForegroundColor White
Write-Host "  ✓ GOOGLE_CLOUD_VISION_API_KEY - For OCR on user documents" -ForegroundColor White
Write-Host ""
Write-Host "Set these in: Supabase Dashboard → Settings → Edge Functions → Secrets" -ForegroundColor Yellow
Write-Host ""

# Step 4: Summary
Write-Host "📋 Setup Summary" -ForegroundColor Cyan
Write-Host "================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ What's Ready:" -ForegroundColor Green
Write-Host "  • Template upload UI at /admin/templates" -ForegroundColor White
Write-Host "  • Template analysis with AI field detection" -ForegroundColor White
Write-Host "  • Smart template matching algorithm" -ForegroundColor White
Write-Host "  • Document processing with matched templates" -ForegroundColor White
Write-Host ""
Write-Host "📚 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Verify environment variables are set in Supabase Dashboard" -ForegroundColor White
Write-Host "  2. Upload your first template at /admin/templates" -ForegroundColor White
Write-Host "  3. Test by uploading a user document at /" -ForegroundColor White
Write-Host "  4. Check logs in Supabase Dashboard to see matching scores" -ForegroundColor White
Write-Host ""
Write-Host "📖 Documentation:" -ForegroundColor Cyan
Write-Host "  • TEMPLATE_ANALYSIS_IMPLEMENTATION.md - Full implementation details" -ForegroundColor White
Write-Host "  • TEMPLATE_WORKFLOW.md - User workflow guide" -ForegroundColor White
Write-Host ""
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
