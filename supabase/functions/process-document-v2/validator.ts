interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export const validateData = (data: any, template: any): ValidationResult => {
    const errors: string[] = [];

    // 1. Basic Check: Did we extract ANYTHING?
    const keys = Object.keys(data);
    const nonEmptyKeys = keys.filter(k => data[k] && String(data[k]).trim() !== '');

    if (nonEmptyKeys.length === 0) {
        return {
            valid: false,
            errors: ["No data could be extracted from the document."]
        };
    }

    // 2. Template-Based Validation
    const fields = template?.field_definitions || [];

    for (const field of fields) {
        // Only validate if explicitly marked 'required' in template
        if (field.required) {
            const val = data[field.name];
            if (!val || String(val).trim() === '') {
                errors.push(`Missing required field: ${field.name}`);
            }
        }
    }

    // 3. Generic Date Format Check (only if field has 'date' or 'fecha' in name)
    // This looks for OBVIOUSLY bad dates like "Unknown" or "Not Found" if they were extracted
    for (const key of nonEmptyKeys) {
        if ((key.includes('fecha') || key.includes('date')) && typeof data[key] === 'string') {
            // Basic sanity check - strictly optional, just catches garbage
            // Allow DD/MM/YYYY, YYYY-MM-DD, etc.
            // If it contains letters (except months like 'JAN'), might be an issue, but let's be lenient.
            if (data[key].length > 50) {
                errors.push(`Field '${key}' seems too long to be a date.`);
            }
        }
    }

    // 4. NUIP Strict Check REMOVED
    // We do NOT check for NUIP unless the template required it above.

    return {
        valid: errors.length === 0,
        errors,
    };
};
