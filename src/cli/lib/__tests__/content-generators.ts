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

export function renderCategoriesTs(categories: Record<string, unknown>): string {
  return renderConfigTs(categories);
}

export function renderRulesTs(rules: Record<string, unknown>): string {
  return renderConfigTs(rules);
}
