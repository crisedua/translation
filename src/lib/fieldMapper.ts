import { FIELD_ALIASES } from './dataAliases';

interface MappedData {
    [key: string]: string | undefined;
}

export const mapFields = (extractedData: any): MappedData => {
    const mapped: MappedData = {};

    // Helper to find value for a set of aliases
    const findValue = (aliases: string[], source: any): string | undefined => {
        for (const alias of aliases) {
            // Check direct property
            if (source[alias]) return source[alias];

            // Check nested in 'fields' or similar if structure varies
            // This is a simple implementation, can be expanded for deep search
        }
        return undefined;
    };

    // Iterate through our defined structure and map values
    Object.entries(FIELD_ALIASES).forEach(([category, fields]) => {
        Object.entries(fields).forEach(([canonicalName, aliases]) => {
            // Try to find the value in the extracted data
            // We assume extractedData might be flat or nested
            let value = findValue(aliases, extractedData);

            // If not found at top level, check if extractedData has categories
            if (!value && extractedData[category]) {
                value = findValue(aliases, extractedData[category]);
            }

            if (value) {
                mapped[canonicalName] = value;
            }
        });
    });

    return mapped;
};

export const flattenData = (data: any): Record<string, string> => {
    const result: Record<string, string> = {};

    const recurse = (cur: any, prop: string) => {
        if (Object(cur) !== cur) {
            result[prop] = cur;
        } else if (Array.isArray(cur)) {
            for (let i = 0, l = cur.length; i < l; i++)
                recurse(cur[i], prop ? prop + "." + i : "" + i);
            if (cur.length == 0)
                result[prop] = "";
        } else {
            let isEmpty = true;
            for (const p in cur) {
                isEmpty = false;
                recurse(cur[p], prop ? prop + "." + p : p);
            }
            if (isEmpty && prop)
                result[prop] = "";
        }
    };

    recurse(data, "");
    return result;
};
