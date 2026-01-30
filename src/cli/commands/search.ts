import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { loadSkillsMatrixFromSource } from "../lib/source-loader";
import { EXIT_CODES } from "../lib/exit-codes";
import type { ResolvedSkill } from "../types-matrix";

/**
 * Minimum column widths for table output
 */
const MIN_ID_WIDTH = 25;
const MIN_CATEGORY_WIDTH = 15;
const MAX_DESCRIPTION_WIDTH = 50;

/**
 * Truncate a string to a maximum length with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Check if a skill matches the search query (case-insensitive)
 */
function matchesQuery(skill: ResolvedSkill, query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // Match against name
  if (skill.name.toLowerCase().includes(lowerQuery)) return true;

  // Match against ID
  if (skill.id.toLowerCase().includes(lowerQuery)) return true;

  // Match against alias
  if (skill.alias?.toLowerCase().includes(lowerQuery)) return true;

  // Match against description
  if (skill.description.toLowerCase().includes(lowerQuery)) return true;

  // Match against category
  if (skill.category.toLowerCase().includes(lowerQuery)) return true;

  // Match against tags
  if (skill.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))) {
    return true;
  }

  return false;
}

/**
 * Check if a skill matches the category filter (case-insensitive)
 */
function matchesCategory(skill: ResolvedSkill, category: string): boolean {
  const lowerCategory = category.toLowerCase();
  return skill.category.toLowerCase().includes(lowerCategory);
}

/**
 * Format skills as a table for display
 */
function formatResultsTable(skills: ResolvedSkill[]): string {
  if (skills.length === 0) {
    return "";
  }

  // Calculate column widths
  const idWidth = Math.max(
    MIN_ID_WIDTH,
    ...skills.map((s) => (s.alias || s.id).length),
  );
  const categoryWidth = Math.max(
    MIN_CATEGORY_WIDTH,
    ...skills.map((s) => s.category.length),
  );

  // Build header
  const header =
    pc.bold("ID".padEnd(idWidth)) +
    "  " +
    pc.bold("Category".padEnd(categoryWidth)) +
    "  " +
    pc.bold("Description");

  const separator = "-".repeat(
    idWidth + categoryWidth + MAX_DESCRIPTION_WIDTH + 4,
  );

  // Build rows
  const rows = skills.map((skill) => {
    const id = (skill.alias || skill.id).padEnd(idWidth);
    const category = skill.category.padEnd(categoryWidth);
    const description = truncate(skill.description, MAX_DESCRIPTION_WIDTH);

    return `${pc.cyan(id)}  ${pc.dim(category)}  ${description}`;
  });

  return [header, separator, ...rows].join("\n");
}

export const searchCommand = new Command("search")
  .description("Search available skills")
  .argument(
    "<query>",
    "Search query (matches name, description, category, tags)",
  )
  .option("-s, --source <source>", "Skills source path or URL")
  .option("-c, --category <category>", "Filter by category")
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(
    async (query: string, options: { source?: string; category?: string }) => {
      const s = p.spinner();

      try {
        s.start("Loading skills...");

        const { matrix, sourcePath, isLocal } =
          await loadSkillsMatrixFromSource({
            sourceFlag: options.source,
          });

        s.stop(
          pc.dim(`Loaded from ${isLocal ? "local" : "remote"}: ${sourcePath}`),
        );

        // Get all skills as array
        const allSkills = Object.values(matrix.skills);

        // Filter by query
        let results = allSkills.filter((skill) => matchesQuery(skill, query));

        // Apply category filter if provided
        if (options.category) {
          results = results.filter((skill) =>
            matchesCategory(skill, options.category as string),
          );
        }

        // Sort results by name
        results.sort((a, b) => a.name.localeCompare(b.name));

        // Display results
        console.log("");
        if (results.length === 0) {
          p.log.warn(`No skills found matching "${query}"`);
          if (options.category) {
            p.log.info(pc.dim(`Category filter: ${options.category}`));
          }
        } else {
          p.log.info(
            `Found ${pc.green(String(results.length))} skill${results.length === 1 ? "" : "s"} matching "${pc.cyan(query)}"`,
          );
          if (options.category) {
            p.log.info(pc.dim(`Category filter: ${options.category}`));
          }
          console.log("");
          console.log(formatResultsTable(results));
        }
        console.log("");
      } catch (error) {
        s.stop(pc.red("Failed to load skills"));
        const message = error instanceof Error ? error.message : String(error);
        console.error(pc.red(`\nError: ${message}\n`));
        process.exit(EXIT_CODES.ERROR);
      }
    },
  );
