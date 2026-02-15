import { parse as parseYaml } from "yaml";
import type { z } from "zod";
import { MAX_CONFIG_FILE_SIZE } from "../consts";
import { readFileSafe } from "./fs";
import { warn } from "./logger";

/**
 * Reads a YAML file, parses it, and validates against a Zod schema.
 * Returns the validated data or null on any failure (missing file, parse error, validation error).
 * Warnings are emitted for parse and validation failures.
 * Enforces a file size limit (default: MAX_CONFIG_FILE_SIZE) to prevent DoS.
 */
export async function safeLoadYamlFile<T>(
  filePath: string,
  schema: z.ZodType<T>,
  maxSizeBytes: number = MAX_CONFIG_FILE_SIZE,
): Promise<T | null> {
  try {
    const content = await readFileSafe(filePath, maxSizeBytes);
    const parsed = parseYaml(content);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      warn(`Invalid YAML at '${filePath}': ${result.error.message}`);
      return null;
    }
    return result.data;
  } catch (error) {
    warn(`Failed to parse YAML at '${filePath}': ${error}`);
    return null;
  }
}
