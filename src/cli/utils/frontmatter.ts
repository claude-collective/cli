import { parse as parseYaml } from "yaml";

/**
 * Extract and parse YAML frontmatter from a markdown string.
 * Returns the parsed YAML object, or null if no valid frontmatter found.
 */
export function extractFrontmatter(content: string): unknown | null {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const match = content.match(frontmatterRegex);

  if (!match || !match[1]) {
    return null;
  }

  try {
    return parseYaml(match[1]);
  } catch {
    return null;
  }
}
