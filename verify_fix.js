const validateData = (data) => {
    const errors = [];

    // Helper function to check if any of the alternative field names exist
    const hasAnyField = (alternatives) => {
        return alternatives.some(field => data[field] && String(data[field]).trim() !== '');
    };

    // Check for required fields with alternative names
    // nombres can be: nombres, Given Name(s), Registrant's Names, names, reg_names
    if (!hasAnyField(['nombres', 'Given Name(s)', "Registrant's Names", 'names', 'reg_names', 'primer_nombre'])) {
        errors.push(`Missing required field: nombres`);
    }

    // apellidos can be: apellidos, Registrant's Surnames, surnames, First Surname + Second Surname
    if (!hasAnyField(['apellidos', "Registrant's Surnames", 'surnames', 'First Surname', 'primer_apellido'])) {
        errors.push(`Missing required field: apellidos`);
    }

    // Validate date formats if present
    // Accept both DD/MM/YYYY and DD-MM-YYYY formats
    if (data.fecha_nacimiento) {
        const datePattern = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/;
        if (!datePattern.test(data.fecha_nacimiento)) {
            errors.push(`Invalid date format for fecha_nacimiento: ${data.fecha_nacimiento}`);
        }
    }

    // NUIP validation - accept both numeric and alphanumeric formats
    // nuip_top is alphanumeric (e.g., "3HXSP3L3EZRFL" or "VA1112083468")
    // nuip_bottom is numeric (e.g., "1112083468")
    // We do NOT reject alphanumeric NUIPs as they are valid for nuip_top
    // Only validate that nuip is not empty if present
    if (data.nuip && typeof data.nuip === 'string' && data.nuip.trim() === '') {
        errors.push(`NUIP field is empty`);
    }

    return {
        valid: errors.length === 0,
        errors,
    };
};

// Test Cases
const testCases = [
    {
        name: "Spanish fields (Original)",
        data: { nombres: "Juan", apellidos: "Perez", fecha_nacimiento: "01/01/2000" },
        shouldPass: true
    },
    {
        name: "English fields (Given Name/Surname)",
        data: { "Given Name(s)": "John", "surnames": "Doe" },
        shouldPass: true
    },
    {
        name: "English fields (Registrant's Names)",
        data: { "Registrant's Names": "Alice", "Registrant's Surnames": "Smith" },
        shouldPass: true
    },
    {
        name: "Missing Names",
        data: { apellidos: "Perez" },
        shouldPass: false
    },
    {
        name: "Missing Surnames",
        data: { nombres: "Juan" },
        shouldPass: false
    },
    {
        name: "Mixed fields (Spanish name, English surname)",
        data: { nombres: "Carlos", surnames: "Gomez" },
        shouldPass: true
    }
];

console.log("Running Validation Tests...\n");
let passed = 0;
let failed = 0;

testCases.forEach(test => {
    const result = validateData(test.data);
    const isSuccess = result.valid === test.shouldPass;

    if (isSuccess) {
        console.log(`✅ [PASS] ${test.name}`);
        passed++;
    } else {
        console.log(`❌ [FAIL] ${test.name}`);
        console.log(`   Expected valid: ${test.shouldPass}, Got: ${result.valid}`);
        console.log(`   Errors: ${JSON.stringify(result.errors)}`);
        failed++;
    }
});

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);

if (failed > 0) process.exit(1);
