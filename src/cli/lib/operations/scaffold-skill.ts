import path from "path";
import { loadConfig } from "../configuration/config-loader.js";
import { computeSkillFolderHash } from "../versioning.js";
import { writeFile, fileExists, ensureDir } from "../../utils/fs.js";
import { verbose } from "../../utils/logger.js";
import {
  DEFAULT_VERSION,
  KEBAB_CASE_PATTERN,
  SKILL_CATEGORIES_PATH,
  SKILL_RULES_PATH,
  STANDARD_FILES,
} from "../../consts.js";
import type { CategoryPath } from "../../types/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScaffoldSkillOptions = {
  name: string;
  author: string;
  category: CategoryPath;
  domain: string;
  skillDir: string;
};

export type ScaffoldSkillResult = {
  skillMdPath: string;
  metadataPath: string;
  contentHash: string;
};

export type RegistryUpdateOptions = {
  projectRoot: string;
  category: CategoryPath;
  domain: string;
};

export type RegistryUpdateResult = {
  categoriesCreated: boolean;
  categoriesUpdated: boolean;
  rulesCreated: boolean;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates that a skill name is non-empty and matches kebab-case format.
 *
 * @returns An error message string if invalid, or `null` if valid.
 */
export function validateSkillName(name: string): string | null {
  if (!name || name.trim() === "") {
    return "Skill name is required";
  }

  if (!KEBAB_CASE_PATTERN.test(name)) {
    return "Skill name must be kebab-case (lowercase letters, numbers, and hyphens, starting with a letter)";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Content generation
// ---------------------------------------------------------------------------

export function toTitleCase(kebabCase: string): string {
  return kebabCase
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function generateSkillMd(name: string): string {
  const titleName = toTitleCase(name);

  return `---
name: ${name}
description: Brief description of this skill
---

# ${titleName}

> **Quick Guide:** Add a brief summary of what this skill teaches.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

**(Add critical requirements here)**

</critical_requirements>

---

**When to use:**

- Add use cases here

**Key patterns covered:**

- Add patterns here

---

<patterns>

## Core Patterns

### Pattern 1: Example Pattern

Add your patterns here.

</patterns>

---

<critical_reminders>

## CRITICAL REMINDERS

**(Repeat critical requirements here)**

</critical_reminders>
`;
}

export function generateMetadataYaml(
  name: string,
  author: string,
  category: CategoryPath,
  contentHash: string,
  domain: string,
): string {
  const titleName = toTitleCase(name);

  return `# yaml-language-server: $schema=https://raw.githubusercontent.com/agents-inc/cli/main/src/schemas/custom-metadata.schema.json
custom: true
domain: ${domain}
category: ${category}
author: "${author}"
displayName: ${titleName}
slug: ${name}
cliDescription: Brief description
usageGuidance: Use when <guidance>.
contentHash: ${contentHash}
`;
}

const DEFAULT_CATEGORY_ORDER = 99;

const CATEGORIES_TS_COMMENT = "// Skill category definitions";
const RULES_TS_COMMENT = "// Skill rules configuration";

function formatTsExport(comment: string, data: unknown): string {
  const body = JSON.stringify(data, null, 2);
  return `${comment}\nexport default ${body};\n`;
}

function buildCategoryEntry(category: CategoryPath, domain: string): Record<string, unknown> {
  const categoryPart = category.includes("-")
    ? category.slice(category.indexOf("-") + 1)
    : category;
  const entry: Record<string, unknown> = {
    id: category,
    displayName: toTitleCase(categoryPart),
    description: `Skills for ${toTitleCase(categoryPart)}`,
    exclusive: true,
    required: false,
    order: DEFAULT_CATEGORY_ORDER,
    custom: true,
  };
  entry.domain = domain;
  return entry;
}

export function generateSkillCategoriesTs(category: CategoryPath, domain: string): string {
  const entry = buildCategoryEntry(category, domain);
  const data = {
    version: DEFAULT_VERSION,
    categories: {
      [category]: entry,
    },
  };
  return formatTsExport(CATEGORIES_TS_COMMENT, data);
}

export function generateSkillRulesTs(): string {
  const data = {
    version: DEFAULT_VERSION,
    relationships: {
      conflicts: [],
      discourages: [],
      recommends: [],
      requires: [],
      alternatives: [],
    },
  };
  return formatTsExport(RULES_TS_COMMENT, data);
}

// ---------------------------------------------------------------------------
// Scaffold operation
// ---------------------------------------------------------------------------

/**
 * Writes SKILL.md and metadata.yaml files for a new skill scaffold.
 *
 * Generates SKILL.md first, computes the content hash from the written file,
 * then generates and writes metadata.yaml with the hash included.
 *
 * Does NOT check whether the directory exists or handle --force logic;
 * the calling command is responsible for that.
 */
export async function scaffoldSkillFiles(
  options: ScaffoldSkillOptions,
): Promise<ScaffoldSkillResult> {
  const { name, author, category, domain, skillDir } = options;

  const skillMdContent = generateSkillMd(name);
  const skillMdPath = path.join(skillDir, STANDARD_FILES.SKILL_MD);
  const metadataPath = path.join(skillDir, STANDARD_FILES.METADATA_YAML);

  await writeFile(skillMdPath, skillMdContent);

  const contentHash = await computeSkillFolderHash(skillDir);
  const metadataContent = generateMetadataYaml(name, author, category, contentHash, domain);
  await writeFile(metadataPath, metadataContent);

  return { skillMdPath, metadataPath, contentHash };
}

// ---------------------------------------------------------------------------
// Registry update operation
// ---------------------------------------------------------------------------

/**
 * Updates skill-categories.ts and skill-rules.ts registry files in a
 * marketplace project.
 *
 * - If skill-categories.ts exists, appends the new category (skips if already present).
 * - If skill-categories.ts does not exist, creates it with the new category.
 * - If skill-rules.ts does not exist, creates a default one.
 *
 * Returns what was created/updated so the command can log appropriately.
 */
export async function updateSkillRegistryConfig(
  options: RegistryUpdateOptions,
): Promise<RegistryUpdateResult> {
  const { projectRoot, category, domain } = options;

  const categoriesPath = path.join(projectRoot, SKILL_CATEGORIES_PATH);
  const rulesPath = path.join(projectRoot, SKILL_RULES_PATH);

  let categoriesCreated = false;
  let categoriesUpdated = false;
  let rulesCreated = false;

  // Update skill-categories.ts
  if (await fileExists(categoriesPath)) {
    // Boundary cast: loadConfig returns unknown structure from TS file
    const parsed = (await loadConfig<Record<string, unknown>>(categoriesPath)) ?? {};
    const categories = (parsed.categories ?? {}) as Record<string, unknown>;
    if (!categories[category]) {
      categories[category] = buildCategoryEntry(category, domain);
      parsed.categories = categories;
      await writeFile(categoriesPath, formatTsExport(CATEGORIES_TS_COMMENT, parsed));
      verbose(`Added category '${category}' to ${SKILL_CATEGORIES_PATH}`);
      categoriesUpdated = true;
    }
  } else {
    await ensureDir(path.dirname(categoriesPath));
    await writeFile(categoriesPath, generateSkillCategoriesTs(category, domain));
    verbose(`Created ${SKILL_CATEGORIES_PATH}`);
    categoriesCreated = true;
  }

  // Create skill-rules.ts if it doesn't exist (no aliases to update -- slugs are in metadata.yaml)
  if (!(await fileExists(rulesPath))) {
    await ensureDir(path.dirname(rulesPath));
    await writeFile(rulesPath, generateSkillRulesTs());
    verbose(`Created ${SKILL_RULES_PATH}`);
    rulesCreated = true;
  }

  return { categoriesCreated, categoriesUpdated, rulesCreated };
}
