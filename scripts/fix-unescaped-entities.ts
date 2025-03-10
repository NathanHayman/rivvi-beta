#!/usr/bin/env node
import fs from "fs";
import path from "path";

// List of files with unescaped entities from ESLint output
const filesToFix = [
  "src/app/(app)/page.tsx", // Already fixed
  "src/app/(auth)/login/[[...login]]/page.tsx",
  "src/app/(auth)/org-selection/page.tsx",
  "src/app/admin/playground/ai-test/_components/display.tsx", // Already fixed
  "src/app/admin/playground/ai-test/_components/streaming.tsx",
  "src/components/app/patient/patient-detail.tsx",
  "src/components/app/run/run-analytics.tsx",
  "src/components/app/run/run-details.tsx",
  "src/components/forms/campaign-edit-form.tsx",
  "src/components/forms/campaign-request-form.tsx",
  "src/components/forms/create-run-form/iterate-agent-step.tsx",
  "src/components/forms/organization-create-form.tsx",
  "src/components/forms/organization-edit-form.tsx",
  "src/components/forms/utils/accessible-tag-input.tsx",
  "src/components/settings/organization-settings.tsx",
  "src/components/tables/campaign-requests-table.tsx",
  "src/components/tables/organization-campaign-requests-table.tsx",
];

// Process each file
for (const filePath of filesToFix) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);

    // Skip files we've already fixed
    if (
      filePath === "src/app/(app)/page.tsx" ||
      filePath === "src/app/admin/playground/ai-test/_components/display.tsx"
    ) {
      console.log(`Skipping already fixed file: ${filePath}`);
      continue;
    }

    if (fs.existsSync(fullPath)) {
      let content = fs.readFileSync(fullPath, "utf8");

      // Replace unescaped single quotes in JSX context
      const singleQuoteFixed = content.replace(
        /(\s|>)('|')([^<>'"]*?)('|')(\s|<)/g,
        (match, before, openQuote, text, closeQuote, after) => {
          return `${before}&apos;${text}&apos;${after}`;
        },
      );

      // Replace unescaped double quotes in JSX context
      const doubleQuoteFixed = singleQuoteFixed.replace(
        /(\s|>)("|")([^<>'"]*?)("|")(\s|<)/g,
        (match, before, openQuote, text, closeQuote, after) => {
          return `${before}&quot;${text}&quot;${after}`;
        },
      );

      // This is a simple solution and might not catch all cases
      // For more complex cases, we'd need a proper JSX parser

      // If changes were made, write back to file
      if (content !== doubleQuoteFixed) {
        fs.writeFileSync(fullPath, doubleQuoteFixed, "utf8");
        console.log(`Fixed entities in: ${filePath}`);
      } else {
        console.log(`No entities to fix in: ${filePath}`);
      }
    } else {
      console.log(`File not found: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

console.log("Entity fixing complete. Run ESLint again to verify fixes.");
