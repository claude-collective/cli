/**
 * Pure content renderers for test file generation.
 * Single source of truth for all test content templates.
 */

export function renderSkillMd(id: string, description?: string, body?: string): string {
  const desc = description ?? `${id} skill`;
  const content = body ?? `# ${id}\n\n${desc}`;
  return `---
name: ${id}
description: ${desc}
---

${content}
`;
}

export function renderConfigTs(config: Record<string, unknown>): string {
  return `export default ${JSON.stringify(config, null, 2)};\n`;
}

export function renderAgentYaml(
  name: string,
  description?: string,
  options?: { title?: string; tools?: string[] },
): string {
  const desc = description ?? `Test ${name} agent`;
  const title = options?.title ?? `${name} Agent`;
  const tools = options?.tools ?? ["Read", "Write"];
  return `id: ${name}
title: ${title}
description: ${desc}
tools:
${tools.map((t) => `  - ${t}`).join("\n")}`;
}

/**
 * Renders an installed agent markdown file with YAML frontmatter.
 * Used for `~/.claude/agents/<name>.md` or `<project>/.claude/agents/<name>.md`,
 * which is the format validated by `validateAgentFrontmatter`.
 */
export function renderAgentMd(
  name: string,
  description?: string,
  options?: { tools?: string[]; body?: string },
): string {
  const desc = description ?? `Test ${name} agent`;
  const tools = (options?.tools ?? ["Read", "Write"]).join(", ");
  const body = options?.body ?? `# ${name}\n\n${desc}`;
  return `---
name: ${name}
description: ${desc}
tools: ${tools}
---

${body}
`;
}

export function renderCategoriesTs(categories: Record<string, unknown>): string {
  return renderConfigTs(categories);
}

export function renderRulesTs(rules: Record<string, unknown>): string {
  return renderConfigTs(rules);
}
