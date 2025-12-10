-- First, let's see what categories exist
SELECT id, name, description, created_at 
FROM document_categories 
ORDER BY name, created_at;

-- Delete duplicate categories, keeping only the oldest one for each name
DELETE FROM document_categories
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM document_categories
  ORDER BY name, created_at ASC
);

-- Verify the cleanup
SELECT id, name, description, created_at 
FROM document_categories 
ORDER BY name;
