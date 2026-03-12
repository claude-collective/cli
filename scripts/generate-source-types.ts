/**
 * Generates TypeScript types from skills source and agent metadata.
 * Run: bun run generate:types [skills-source-path]
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";

// Accept skills source path as CLI arg (default: sibling skills repo)
const skillsSource = process.argv[2] || path.resolve(import.meta.dirname, "../../skills");
const cliRoot = path.resolve(import.meta.dirname, "..");

type SkillEntry = { slug: string; id: string; category: string; domain: string };

// -- Extract skills ----------------------------------------------------------

function extractSkills(): SkillEntry[] {
  const skillsDir = path.join(skillsSource, "src/skills");
  const entries: SkillEntry[] = [];

  for (const dir of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;

    const metadataPath = path.join(skillsDir, dir.name, "metadata.yaml");
    const skillMdPath = path.join(skillsDir, dir.name, "SKILL.md");

    let metadataRaw: string;
    let skillMdRaw: string;
    try {
      metadataRaw = readFileSync(metadataPath, "utf-8");
      skillMdRaw = readFileSync(skillMdPath, "utf-8");
    } catch {
      console.warn(`  ⚠ Skipping ${dir.name}: missing metadata.yaml or SKILL.md`);
      continue;
    }

    const metadata = parseYaml(metadataRaw);
    if (metadata.custom) continue; // custom skills register at runtime

    // Extract name from SKILL.md frontmatter
    const fmMatch = skillMdRaw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      console.warn(`  ⚠ Skipping ${dir.name}: no frontmatter in SKILL.md`);
      continue;
    }
    const frontmatter = parseYaml(fmMatch[1]);

    entries.push({
      slug: metadata.slug,
      id: frontmatter.name,
      category: metadata.category,
      domain: metadata.domain,
    });
  }

  return entries;
}

// -- Extract agents ----------------------------------------------------------

function extractAgents(): string[] {
  const agentsDir = path.join(cliRoot, "src/agents");
  const agents: string[] = [];

  // Walk two levels: src/agents/{group}/{agent}/metadata.yaml
  for (const group of readdirSync(agentsDir, { withFileTypes: true })) {
    if (!group.isDirectory() || group.name === "_templates") continue;
    const groupDir = path.join(agentsDir, group.name);

    for (const agent of readdirSync(groupDir, { withFileTypes: true })) {
      if (!agent.isDirectory()) continue;
      const metadataPath = path.join(groupDir, agent.name, "metadata.yaml");

      let raw: string;
      try {
        raw = readFileSync(metadataPath, "utf-8");
      } catch {
        continue;
      }

      const metadata = parseYaml(raw);
      if (metadata.custom) continue;
      if (metadata.id) agents.push(metadata.id);
    }
  }

  return agents;
}

// -- Generate ----------------------------------------------------------------

function generate(): void {
  console.log("Generating source types...\n");

  const skills = extractSkills();
  const agentNames = [...new Set(extractAgents())].sort();

  // Build SKILL_MAP entries sorted by slug
  const sortedBySlug = [...skills].sort((a, b) => a.slug.localeCompare(b.slug));

  // Validate uniqueness
  const slugCounts = new Map<string, string[]>();
  for (const s of skills) {
    slugCounts.set(s.slug, [...(slugCounts.get(s.slug) || []), s.id]);
  }
  for (const [slug, ids] of slugCounts) {
    if (ids.length > 1) {
      throw new Error(`Duplicate slug "${slug}" maps to: ${ids.join(", ")}`);
    }
  }

  const idSet = new Set(skills.map((s) => s.id));
  if (idSet.size !== skills.length) {
    throw new Error("Duplicate skill IDs detected");
  }

  // Collect unique sorted values
  const categories = [...new Set(skills.map((s) => s.category))].sort();
  const domains = [...new Set(skills.map((s) => s.domain))].sort();
  const skillIds = [...new Set(skills.map((s) => s.id))].sort();

  // Write generated file
  const outDir = path.join(cliRoot, "src/cli/types/generated");
  mkdirSync(outDir, { recursive: true });

  const lines: string[] = [
    "// AUTO-GENERATED from skills source and agent metadata — do not edit manually",
    "// Run: bun run generate:types",
    "",
    "// ── Skill Map (slug → ID) ─────────────────────────────────────",
    "",
    "export const SKILL_MAP = {",
  ];

  for (const entry of sortedBySlug) {
    lines.push(`  "${entry.slug}": "${entry.id}",`);
  }

  lines.push(
    "} as const;",
    "",
    "export type SkillSlug = keyof typeof SKILL_MAP;",
    "export type SkillId = (typeof SKILL_MAP)[SkillSlug];",
    "",
    "// Derived arrays for Zod enum compatibility",
    "// (z.enum() requires a readonly tuple, not Object.keys/values)",
    "export const SKILL_SLUGS = [",
  );

  for (const entry of sortedBySlug) {
    lines.push(`  "${entry.slug}",`);
  }

  lines.push(
    "] as const satisfies readonly SkillSlug[];",
    "",
    "export const SKILL_IDS = [",
  );

  for (const id of skillIds) {
    lines.push(`  "${id}",`);
  }

  lines.push(
    "] as const satisfies readonly SkillId[];",
    "",
    "// ── Categories ─────────────────────────────────────────────────",
    "",
    "export const CATEGORIES = [",
  );

  for (const cat of categories) {
    lines.push(`  "${cat}",`);
  }

  lines.push(
    "] as const;",
    "",
    "export type Category = (typeof CATEGORIES)[number];",
    "",
    "// ── Domains ────────────────────────────────────────────────────",
    "",
    "export const DOMAINS = [",
  );

  for (const d of domains) {
    lines.push(`  "${d}",`);
  }

  lines.push(
    "] as const;",
    "",
    "export type Domain = (typeof DOMAINS)[number];",
    "",
    "// ── Agent Names ────────────────────────────────────────────────",
    "",
    "export const AGENT_NAMES = [",
  );

  for (const a of agentNames) {
    lines.push(`  "${a}",`);
  }

  lines.push(
    "] as const;",
    "",
    "export type AgentName = (typeof AGENT_NAMES)[number];",
    "",
  );

  const outPath = path.join(outDir, "source-types.ts");
  writeFileSync(outPath, lines.join("\n"));

  console.log(`  ✓ ${path.relative(cliRoot, outPath)}`);
  console.log(
    `\n  Generated: ${skills.length} skills, ${categories.length} categories, ${domains.length} domains, ${agentNames.length} agents\n`,
  );
}

generate();
