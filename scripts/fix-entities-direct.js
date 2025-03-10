#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define specific replacements for each file and line
const replacements = [
    {
        file: 'src/components/forms/campaign-edit-form.tsx',
        line: 484,
        from: "The base prompt that defines the AI agent's behavior",
        to: "The base prompt that defines the AI agent&apos;s behavior"
    },
    {
        file: 'src/components/forms/campaign-request-form.tsx',
        line: 342,
        from: "We'll review your request and create a campaign that meets your needs.",
        to: "We&apos;ll review your request and create a campaign that meets your needs."
    },
    {
        file: 'src/components/forms/campaign-request-form.tsx',
        line: 459,
        from: "What's the purpose of this campaign?",
        to: "What&apos;s the purpose of this campaign?"
    },
    {
        file: 'src/components/forms/organization-create-form.tsx',
        line: 233,
        from: "Your organization's unique identifier",
        to: "Your organization&apos;s unique identifier"
    },
    {
        file: 'src/components/forms/organization-edit-form.tsx',
        line: 277,
        from: "Your organization's unique identifier",
        to: "Your organization&apos;s unique identifier"
    },
    {
        file: 'src/components/settings/organization-settings.tsx',
        line: 249,
        from: "Your organization's unique identifier",
        to: "Your organization&apos;s unique identifier"
    },
    {
        file: 'src/components/settings/organization-settings.tsx',
        line: 293,
        from: "This will be used for your organization's subdomain",
        to: "This will be used for your organization&apos;s subdomain"
    },
    {
        file: 'src/components/settings/organization-settings.tsx',
        line: 320,
        from: "Your organization's display name",
        to: "Your organization&apos;s display name"
    },
    {
        file: 'src/components/tables/campaign-requests-table.tsx',
        line: 847,
        from: "You don't have any campaign requests yet.",
        to: "You don&apos;t have any campaign requests yet."
    },
    {
        file: 'src/components/tables/organization-campaign-requests-table.tsx',
        line: 55,
        from: "There's no campaign requests yet.",
        to: "There&apos;s no campaign requests yet."
    },
    {
        file: 'src/components/tables/organization-campaign-requests-table.tsx',
        line: 60,
        from: "We'll notify you when there are new requests.",
        to: "We&apos;ll notify you when there are new requests."
    }
];

// Process each replacement
for (const replacement of replacements) {
    try {
        const { file, line, from, to } = replacement;
        const fullPath = path.resolve(process.cwd(), file);

        if (fs.existsSync(fullPath)) {
            let content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');

            // Check if the line exists and contains the text to replace
            if (line - 1 < lines.length) {
                const lineContent = lines[line - 1];

                if (lineContent.includes(from)) {
                    // Replace the text
                    lines[line - 1] = lineContent.replace(from, to);

                    // Write the file back
                    fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
                    console.log(`Fixed entity in ${file}:${line}`);
                } else {
                    console.log(`Text not found in ${file}:${line}`);
                    console.log(`Expected: "${from}"`);
                    console.log(`Found: "${lineContent.trim()}"`);
                }
            } else {
                console.log(`Line ${line} not found in ${file}`);
            }
        } else {
            console.log(`File not found: ${file}`);
        }
    } catch (error) {
        console.error(`Error processing ${replacement.file}:${replacement.line}:`, error);
    }
}

console.log('Direct entity fixing complete. Run ESLint again to verify fixes.');