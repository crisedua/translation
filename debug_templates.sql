-- CHECK: List all categories and how many templates they have
SELECT 
    c.name as category_name, 
    c.id as category_id, 
    COUNT(t.id) as template_count 
FROM document_categories c
LEFT JOIN document_templates t ON t.category_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;

-- CHECK: List all templates and their assigned category IDs
SELECT id as template_id, name as template_name, category_id 
FROM document_templates;
