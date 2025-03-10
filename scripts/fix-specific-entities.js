#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extract specific line numbers from ESLint output
const entitiesToFix = [
    { file: 'src/app/(app)/page.tsx', line: 106, type: 'single' }, // Already fixed
    { file: 'src/app/(auth)/login/[[...login]]/page.tsx', line: 131, type: 'single' }, // Already fixed
    { file: 'src/app/(auth)/org-selection/page.tsx', line: 113, type: 'single' }, // Already fixed
    { file: 'src/app/(auth)/org-selection/page.tsx', line: 170, type: 'single' }, // Already fixed
    { file: 'src/app/admin/playground/ai-test/_components/display.tsx', line: 273, type: 'double' }, // Already fixed
    { file: 'src/app/admin/playground/ai-test/_components/display.tsx', line: 273, type: 'double' }, // Already fixed
    { file: 'src/app/admin/playground/ai-test/_components/display.tsx', line: 273, type: 'double' }, // Already fixed
    { file: 'src/app/admin/playground/ai-test/_components/display.tsx', line: 273, type: 'double' }, // Already fixed
    { file: 'src/app/admin/playground/ai-test/_components/streaming.tsx', line: 463, type: 'double' },
    { file: 'src/app/admin/playground/ai-test/_components/streaming.tsx', line: 463, type: 'double' },
    { file: 'src/app/admin/playground/ai-test/_components/streaming.tsx', line: 463, type: 'double' },
    { file: 'src/app/admin/playground/ai-test/_components/streaming.tsx', line: 463, type: 'double' },
    { file: 'src/components/app/patient/patient-detail.tsx', line: 70, type: 'single' },
    { file: 'src/components/app/patient/patient-detail.tsx', line: 227, type: 'single' },
    { file: 'src/components/app/run/run-analytics.tsx', line: 937, type: 'single' },
    { file: 'src/components/app/run/run-details.tsx', line: 366, type: 'double' },
    { file: 'src/components/app/run/run-details.tsx', line: 366, type: 'double' },
    { file: 'src/components/app/run/run-details.tsx', line: 366, type: 'double' },
    { file: 'src/components/app/run/run-details.tsx', line: 366, type: 'double' },
    { file: 'src/components/forms/campaign-edit-form.tsx', line: 484, type: 'single' },
    { file: 'src/components/forms/campaign-request-form.tsx', line: 342, type: 'single' },
    { file: 'src/components/forms/campaign-request-form.tsx', line: 459, type: 'single' },
    { file: 'src/components/forms/create-run-form/iterate-agent-step.tsx', line: 348, type: 'double' },
    { file: 'src/components/forms/create-run-form/iterate-agent-step.tsx', line: 348, type: 'double' },
    { file: 'src/components/forms/create-run-form/iterate-agent-step.tsx', line: 348, type: 'double' },
    { file: 'src/components/forms/create-run-form/iterate-agent-step.tsx', line: 348, type: 'double' },
    { file: 'src/components/forms/organization-create-form.tsx', line: 233, type: 'single' },
    { file: 'src/components/forms/organization-edit-form.tsx', line: 277, type: 'single' },
    { file: 'src/components/forms/utils/accessible-tag-input.tsx', line: 100, type: 'double' },
    { file: 'src/components/forms/utils/accessible-tag-input.tsx', line: 100, type: 'double' },
    { file: 'src/components/settings/organization-settings.tsx', line: 249, type: 'single' },
    { file: 'src/components/settings/organization-settings.tsx', line: 293, type: 'single' },
    { file: 'src/components/settings/organization-settings.tsx', line: 320, type: 'single' },
    { file: 'src/components/tables/campaign-requests-table.tsx', line: 847, type: 'single' },
    { file: 'src/components/tables/organization-campaign-requests-table.tsx', line: 55, type: 'single' },
    { file: 'src/components/tables/organization-campaign-requests-table.tsx', line: 60, type: 'single' }
];

// Create unique file entries to avoid redundant processing
const uniqueFiles = [...new Set(entitiesToFix.map(entry => entry.file))];

// Files we've already fixed manually
const alreadyFixed = [
    'src/app/(app)/page.tsx',
    'src/app/(auth)/login/[[...login]]/page.tsx',
    'src/app/(auth)/org-selection/page.tsx',
    'src/app/admin/playground/ai-test/_components/display.tsx'
];

// Process remaining files
for (const filePath of uniqueFiles) {
    if (alreadyFixed.includes(filePath)) {
        console.log(`Skipping already fixed file: ${filePath}`);
        continue;
    }

    try {
        const fullPath = path.resolve(process.cwd(), filePath);

        if (fs.existsSync(fullPath)) {
            let content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');

            // Get entities to fix for this file
            const fileEntities = entitiesToFix.filter(entry => entry.file === filePath);

            // Track if we made changes to this file
            let fileChanged = false;

            // Group by line number to avoid processing the same line multiple times
            const lineGroups = {};
            fileEntities.forEach(entity => {
                if (!lineGroups[entity.line]) {
                    lineGroups[entity.line] = [];
                }
                lineGroups[entity.line].push(entity);
            });

            // Process each line that needs fixing
            for (const [lineNum, entities] of Object.entries(lineGroups)) {
                const lineIndex = parseInt(lineNum, 10) - 1; // Convert to 0-indexed
                if (lineIndex >= 0 && lineIndex < lines.length) {
                    let line = lines[lineIndex];

                    // Check if the line has single quotes to replace
                    if (entities.some(e => e.type === 'single') && line.includes("'")) {
                        line = line.replace(/(\s|>)('|')([^<>"']*?)('|')(\s|<|$)/g,
                            (match, before, openQuote, text, closeQuote, after) => {
                                return `${before}&apos;${text}&apos;${after}`;
                            }
                        );
                    }

                    // Check if the line has double quotes to replace
                    if (entities.some(e => e.type === 'double') && line.includes('"')) {
                        line = line.replace(/(\s|>)("|")([^<>"']*?)("|")(\s|<|$)/g,
                            (match, before, openQuote, text, closeQuote, after) => {
                                return `${before}&quot;${text}&quot;${after}`;
                            }
                        );
                    }

                    // Update the line if changed
                    if (lines[lineIndex] !== line) {
                        lines[lineIndex] = line;
                        fileChanged = true;
                    }
                }
            }

            // If we made changes, write the file back
            if (fileChanged) {
                fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
                console.log(`Fixed entities in: ${filePath}`);
            } else {
                console.log(`No entities fixed in: ${filePath}`);
            }
        } else {
            console.log(`File not found: ${filePath}`);
        }
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
    }
}

console.log('Entity fixing complete. Run ESLint again to verify fixes.'); 