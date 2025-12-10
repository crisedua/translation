interface Template {
    id: string;
    name: string;
    category_id: string;
    field_definitions: any[];
    full_template_text?: string;
    content_profile?: any;
}

export const matchTemplate = async (text: string, templates: Template[]): Promise<Template | null> => {
    if (!templates || templates.length === 0) {
        console.warn("No templates provided for matching");
        return null;
    }

    // Simple keyword-based matching for Colombian documents
    const lowerText = text.toLowerCase();

    const scores = templates.map(template => {
        let score = 0;
        const templateName = template.name.toLowerCase();

        // Birth certificate patterns
        if (templateName.includes('nacimiento') || templateName.includes('birth')) {
            if (lowerText.includes('registro civil de nacimiento') ||
                lowerText.includes('certificado de nacimiento') ||
                lowerText.includes('registro de nacimiento') ||
                lowerText.includes('registro nacimiento')) {
                score += 50;
            }

            // Old format indicators
            if (templateName.includes('antiguo') || templateName.includes('old')) {
                if (lowerText.includes('libro') && lowerText.includes('folio')) {
                    score += 30;
                }
            }

            // New format indicators
            if (templateName.includes('nuevo') || templateName.includes('new')) {
                if (lowerText.includes('nuip') || lowerText.includes('tarjeta de identidad')) {
                    score += 30;
                }
            }
        }

        // Passport patterns
        if (templateName.includes('pasaporte') || templateName.includes('passport')) {
            if (lowerText.includes('pasaporte') || lowerText.includes('passport')) {
                score += 50;
            }
            if (lowerText.includes('república de colombia')) {
                score += 20;
            }
        }

        // Marriage certificate patterns
        if (templateName.includes('matrimonio') || templateName.includes('marriage')) {
            if (lowerText.includes('matrimonio') || lowerText.includes('marriage')) {
                score += 50;
            }
        }

        // DIAN patterns
        if (templateName.includes('dian')) {
            if (lowerText.includes('dian') || lowerText.includes('dirección de impuestos')) {
                score += 50;
            }
        }

        // Check for template-specific keywords if available
        if (template.content_profile?.keywords) {
            const keywords = template.content_profile.keywords;
            keywords.forEach((keyword: string) => {
                if (lowerText.includes(keyword.toLowerCase())) {
                    score += 5;
                }
            });
        }

        // NEW: Check format indicators for more precise matching (HIGHEST PRIORITY)
        if (template.content_profile?.formatIndicators) {
            const formatIndicators = template.content_profile.formatIndicators;

            // Check version-specific markers with VERY HIGH weight
            if (formatIndicators.specificMarkers && Array.isArray(formatIndicators.specificMarkers)) {
                let markerMatchCount = 0;
                formatIndicators.specificMarkers.forEach((marker: string) => {
                    if (lowerText.includes(marker.toLowerCase())) {
                        markerMatchCount++;
                        score += 25; // Very high weight for format-specific markers
                    }
                });

                // Bonus for matching multiple markers from the same template
                if (markerMatchCount >= 2) {
                    score += 30; // Strong confidence boost
                }
            }

            // Bonus for matching version type with CLEAR indicators
            if (formatIndicators.version) {
                const version = formatIndicators.version.toLowerCase();

                if (version === 'old' || version === 'antiguo') {
                    // Old format: typewritten, LIBRO/FOLIO, no NUIP
                    if (lowerText.includes('libro') && lowerText.includes('folio')) {
                        console.log(`[Matcher] +40 Old format bonus (libro+folio) for ${template.name}`);
                        score += 40;
                    }
                    // Penalize if modern markers are present
                    if (lowerText.includes('nuip') || lowerText.includes('qr')) {
                        console.log(`[Matcher] -50 Modern penalty (nuip/qr) for ${template.name}`);
                        score -= 50;
                    }
                } else if (version === 'medium' || version === 'medio') {
                    // Medium format: has NUIP but no QR/digital signature
                    if (lowerText.includes('nuip')) {
                        console.log(`[Matcher] +20 Medium format bonus (nuip) for ${template.name}`);
                        score += 20;
                    }
                    if (!lowerText.includes('qr') && !lowerText.includes('digitally signed')) {
                        console.log(`[Matcher] +15 Medium format bonus (no qr) for ${template.name}`);
                        score += 15;
                    }
                    // Penalize if old markers are present
                    if (lowerText.includes('libro') && lowerText.includes('folio')) {
                        console.log(`[Matcher] -30 Old penalty (libro+folio) for ${template.name}`);
                        score -= 30;
                    }
                } else if (version === 'new' || version === 'nuevo') {
                    // New format: QR code, digital signature
                    if (lowerText.includes('qr') || lowerText.includes('digitally signed')) {
                        console.log(`[Matcher] +40 New format bonus (qr) for ${template.name}`);
                        score += 40;
                    }
                    if (lowerText.includes('nuip')) {
                        score += 10;
                    }
                    // Penalize if old markers are present
                    if (lowerText.includes('libro') && lowerText.includes('folio')) {
                        console.log(`[Matcher] -40 Old penalty (libro+folio) for ${template.name}`);
                        score -= 40;
                    }
                }
            }
        }

        // NEW: Use document type from content_profile for primary matching
        if (template.content_profile?.documentType) {
            const docType = template.content_profile.documentType;

            if (docType === 'birth_certificate') {
                if (lowerText.includes('registro civil de nacimiento') ||
                    lowerText.includes('certificado de nacimiento') ||
                    lowerText.includes('registro de nacimiento') ||
                    lowerText.includes('registro nacimiento')) {
                    score += 40;
                }
            } else if (docType === 'passport') {
                if (lowerText.includes('pasaporte') || lowerText.includes('passport')) {
                    score += 40;
                }
            } else if (docType === 'marriage_certificate') {
                if (lowerText.includes('matrimonio') || lowerText.includes('marriage')) {
                    score += 40;
                }
            } else if (docType === 'dian') {
                if (lowerText.includes('dian') || lowerText.includes('dirección de impuestos')) {
                    score += 40;
                }
            }
        }

        console.log(`Template "${template.name}" Final Score: ${score}`);
        return { template, score };
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Return the best match if score is above threshold
    const bestMatch = scores[0];
    if (bestMatch.score > 30) {
        console.log(`Matched template: ${bestMatch.template.name} with score ${bestMatch.score}`);
        return bestMatch.template;
    }

    console.warn("No template matched with sufficient confidence");
    return templates[0]; // Return first template as fallback
};
