import { expect } from "vitest";

// --- Types ---

export interface ParsedAgentOutput {
  raw: string;
  frontmatter: Record<string, unknown>;
  body: string;
  preloadedSkillIds: string[];
  dynamicSkillIds: string[];
}

// --- Internal Helpers ---

/** Lightweight YAML line parser for frontmatter — handles scalars and one array */
function parseYamlLines(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let arrayKey = "";
  let arrayItems: string[] = [];

  for (const line of lines) {
    if (/^\w+:$/.test(line.trim())) {
      if (arrayKey) {
        result[arrayKey] = [...arrayItems];
        arrayItems = [];
      }
      arrayKey = line.trim().slice(0, -1);
      continue;
    }
    if (arrayKey && line.trim().startsWith("- ")) {
      arrayItems.push(line.trim().slice(2));
      continue;
    }
    if (arrayKey) {
      result[arrayKey] = [...arrayItems];
      arrayKey = "";
      arrayItems = [];
    }
    const keyMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) result[keyMatch[1]] = keyMatch[2];
  }
  if (arrayKey && arrayItems.length > 0) result[arrayKey] = [...arrayItems];
  return result;
}

// --- Functions ---

/** Parse compiled agent content into structured frontmatter + body sections */
export function parseCompiledAgent(content: string): ParsedAgentOutput {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = fmMatch ? parseYamlLines(fmMatch[1]) : {};
  const body = content.split(/^---\n[\s\S]*?\n---\n/m)[1] ?? content;

  const preloadedSkillIds = (frontmatter.skills as string[] | undefined) ?? [];
  const dynamicSkillIds = [...body.matchAll(/skill:\s*"([^"]+)"/g)].map((m) => m[1]);

  return { raw: content, frontmatter, body, preloadedSkillIds, dynamicSkillIds };
}

/** Verify preloaded vs dynamic skill placement in compiled agent output */
export function expectAgentCompilation(
  content: string,
  expectations: {
    name?: string;
    preloadedSkills?: string[];
    dynamicSkills?: string[];
    noPreloadedSkills?: string[];
    noDynamicSkills?: string[];
  },
): void {
  const parsed = parseCompiledAgent(content);

  if (expectations.name) {
    expect(parsed.frontmatter.name).toBe(expectations.name);
  }
  if (expectations.preloadedSkills) {
    expect(parsed.preloadedSkillIds.sort()).toStrictEqual([...expectations.preloadedSkills].sort());
  }
  if (expectations.dynamicSkills) {
    expect(parsed.dynamicSkillIds.sort()).toStrictEqual([...expectations.dynamicSkills].sort());
  }
  if (expectations.noPreloadedSkills) {
    for (const id of expectations.noPreloadedSkills) {
      expect(parsed.preloadedSkillIds).not.toContain(id);
    }
  }
  if (expectations.noDynamicSkills) {
    for (const id of expectations.noDynamicSkills) {
      expect(parsed.dynamicSkillIds).not.toContain(id);
    }
  }
}

/** Verify structural validity of compiled agent markdown */
export function expectValidAgentMarkdown(
  content: string,
  agentName: string,
  options?: {
    hasCorePrinciples?: boolean;
    hasMethodologies?: boolean;
    hasSkillActivation?: boolean;
  },
): void {
  expect(content).toMatch(/^---\n/);
  expect(content).toContain(`name: ${agentName}`);
  expect(content).toContain("description:");

  if (options?.hasCorePrinciples !== false) {
    expect(content).toContain("<core_principles>");
  }
  if (options?.hasMethodologies !== false) {
    expect(content).toContain("<methodologies>");
  }
  if (options?.hasSkillActivation) {
    const hasProtocol = content.includes("<skill_activation_protocol>");
    const hasNote = content.includes("<skills_note>");
    expect(hasProtocol || hasNote).toBe(true);
  }
}

/** Verify compiled agent name list (order-independent) */
export function expectCompiledAgents(
  result: { compiledAgents: string[] },
  expected: string[],
): void {
  expect([...result.compiledAgents].sort()).toStrictEqual([...expected].sort());
}
