-- Seed initial document categories

INSERT INTO document_categories (name, description) VALUES
  ('Birth Certificate', 'Colombian birth certificates (all formats)'),
  ('Passport', 'Colombian passports'),
  ('Marriage Certificate', 'Colombian marriage certificates'),
  ('DIAN', 'DIAN tax documents'),
  ('Other', 'Other document types')
ON CONFLICT DO NOTHING;
