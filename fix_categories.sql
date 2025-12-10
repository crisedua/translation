-- Quick check and fix for categories
-- Run this in Supabase SQL Editor

-- Check if categories exist
SELECT * FROM document_categories;

-- If empty, insert categories manually:
INSERT INTO document_categories (name, description) VALUES
  ('Birth Certificate', 'Colombian birth certificates (all formats)'),
  ('Marriage Certificate', 'Colombian marriage certificates'),
  ('Passport', 'Colombian passports'),
  ('DIAN', 'DIAN tax documents'),
  ('Other', 'Other document types')
ON CONFLICT DO NOTHING;

-- Verify categories were inserted
SELECT id, name FROM document_categories ORDER BY name;
