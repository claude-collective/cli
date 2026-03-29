---
type: standard-gap
severity: high
affected_files:
  - src/cli/lib/source-validator.ts
standards_docs:
  - src/cli/lib/schemas.ts
date: 2026-03-29
reporting_agent: cli-tester
category: testing
domain: cli
root_cause: enforcement-gap
---

## What Was Wrong

`source-validator.ts` always used `metadataValidationSchema` (strict) for ALL skills, even when `custom: true` was set in metadata. The strict schema requires `z.enum(CATEGORIES)` for category and `z.enum(SKILL_SLUGS)` for slug, which rejects any non-built-in values. This meant custom skills with user-defined categories or slugs would always fail source validation, despite `customMetadataValidationSchema` existing in `schemas.ts` specifically for this purpose.

The `customMetadataValidationSchema` accepts `z.string()` for both category and slug, allowing custom skills to define their own vocabulary.

## Fix Applied

Modified `source-validator.ts` Phase 2 to detect `custom: true` in raw metadata and use `customMetadataValidationSchema` instead of the strict `metadataValidationSchema`. The detection uses safe type narrowing (`rawMetadata != null && typeof rawMetadata === 'object' && 'custom' in rawMetadata`) before accessing the field.

Added test coverage in `validate.test.ts` verifying that custom skills with non-standard categories pass validation without errors.

## Proposed Standard

Add to `.ai-docs/standards/clean-code-standards.md` or a validation-specific doc:

**When adding a validation schema variant (e.g., `customMetadataValidationSchema`), ensure ALL validation entry points that process the relevant data type check the discriminator field and select the correct schema.** Schema variants without entry-point wiring are dead code.
