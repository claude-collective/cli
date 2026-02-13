/**
 * Generates JSON Schema files from Zod schemas.
 * Run: npx tsx scripts/generate-json-schemas.ts
 */
import { z } from "zod";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import {
  agentYamlGenerationSchema,
  agentFrontmatterValidationSchema,
  hooksRecordSchema,
  marketplaceSchema,
  metadataValidationSchema,
  pluginManifestSchema,
  projectSourceConfigSchema,
  skillFrontmatterValidationSchema,
  skillsMatrixConfigSchema,
  stackConfigValidationSchema,
  stacksConfigSchema,
} from "../src/cli/lib/schemas.ts";

const SCHEMAS_DIR = path.resolve(import.meta.dirname, "../src/schemas");

type SchemaEntry = {
  filename: string;
  schema: z.ZodType;
  metadata: {
    $id: string;
    title: string;
    description: string;
  };
};

const SCHEMA_ENTRIES: SchemaEntry[] = [
  {
    filename: "agent.schema.json",
    schema: agentYamlGenerationSchema,
    metadata: {
      $id: "schemas/agent.schema.json",
      title: "Agent Definition",
      description: "Schema for agent.yaml files defining Claude Code agents.",
    },
  },
  {
    filename: "agent-frontmatter.schema.json",
    schema: agentFrontmatterValidationSchema,
    metadata: {
      $id: "schemas/agent-frontmatter.schema.json",
      title: "Agent Frontmatter",
      description: "Schema for agent .md file frontmatter fields.",
    },
  },
  {
    filename: "hooks.schema.json",
    schema: hooksRecordSchema,
    metadata: {
      $id: "schemas/hooks.schema.json",
      title: "Hooks Configuration",
      description: "Schema for agent hook definitions.",
    },
  },
  {
    filename: "marketplace.schema.json",
    schema: marketplaceSchema,
    metadata: {
      $id: "schemas/marketplace.schema.json",
      title: "Marketplace",
      description: "Schema for marketplace.json plugin listings.",
    },
  },
  {
    filename: "metadata.schema.json",
    schema: metadataValidationSchema,
    metadata: {
      $id: "schemas/metadata.schema.json",
      title: "Skill Metadata",
      description: "Schema for skill metadata.yaml files.",
    },
  },
  {
    filename: "plugin.schema.json",
    schema: pluginManifestSchema,
    metadata: {
      $id: "schemas/plugin.schema.json",
      title: "Plugin Manifest",
      description: "Schema for plugin.json manifest files.",
    },
  },
  {
    filename: "project-source-config.schema.json",
    schema: projectSourceConfigSchema,
    metadata: {
      $id: "schemas/project-source-config.schema.json",
      title: "Project Source Configuration",
      description: "Schema for .claude-src/config.yaml source configuration files.",
    },
  },
  {
    filename: "skill-frontmatter.schema.json",
    schema: skillFrontmatterValidationSchema,
    metadata: {
      $id: "schemas/skill-frontmatter.schema.json",
      title: "Skill Frontmatter",
      description: "Schema for SKILL.md file frontmatter fields.",
    },
  },
  {
    filename: "skills-matrix.schema.json",
    schema: skillsMatrixConfigSchema,
    metadata: {
      $id: "schemas/skills-matrix.schema.json",
      title: "Skills Matrix Configuration",
      description:
        "Schema for config/skills-matrix.yaml defining skill categories and relationships.",
    },
  },
  {
    filename: "stacks.schema.json",
    schema: stacksConfigSchema,
    metadata: {
      $id: "schemas/stacks.schema.json",
      title: "Stacks Configuration",
      description: "Schema for config/stacks.yaml defining agent groupings.",
    },
  },
  {
    filename: "stack.schema.json",
    schema: stackConfigValidationSchema,
    metadata: {
      $id: "schemas/stack.schema.json",
      title: "Stack Config",
      description: "Schema for individual stack config.yaml files.",
    },
  },
];

function generate(): void {
  mkdirSync(SCHEMAS_DIR, { recursive: true });

  let generated = 0;

  for (const entry of SCHEMA_ENTRIES) {
    const jsonSchema = z.toJSONSchema(entry.schema, { target: "draft-07" });

    // Overlay metadata
    const output = {
      $schema: jsonSchema.$schema,
      $id: entry.metadata.$id,
      title: entry.metadata.title,
      description: entry.metadata.description,
      ...Object.fromEntries(Object.entries(jsonSchema).filter(([key]) => key !== "$schema")),
    };

    const filePath = path.join(SCHEMAS_DIR, entry.filename);
    writeFileSync(filePath, JSON.stringify(output, null, 2) + "\n");
    generated++;
    console.log(`  ✓ ${entry.filename}`);
  }

  console.log(`\n  Generated ${generated} schema files in src/schemas/\n`);
}

generate();
