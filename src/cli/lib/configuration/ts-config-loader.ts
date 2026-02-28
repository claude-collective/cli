import path from "path";
import { fileURLToPath } from "url";
import { createJiti } from "jiti";
import { fileExists } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { getErrorMessage } from "../../utils/errors";

/** Resolve @agents-inc/cli/config to the source config-exports.ts so jiti can load it in dev. */
const CONFIG_EXPORTS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../config-exports.ts",
);

type ZodLikeSchema = {
  safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: unknown };
};

/**
 * Loads a TypeScript config file using jiti.
 * Returns null on failure (mirrors safeLoadYamlFile pattern).
 *
 * @param configPath - Absolute path to the .ts config file
 * @param schema - Optional Zod schema for validation (same pattern as safeLoadYamlFile)
 */
export async function loadTsConfig<T>(
  configPath: string,
  schema?: ZodLikeSchema,
): Promise<T | null> {
  if (!(await fileExists(configPath))) {
    verbose(`TS config not found at ${configPath}`);
    return null;
  }

  try {
    const jiti = createJiti(import.meta.url, {
      moduleCache: false,
      interopDefault: true,
      alias: { "@agents-inc/cli/config": CONFIG_EXPORTS_PATH },
    });

    const raw = await jiti.import(configPath, { default: true });

    if (schema) {
      const result = schema.safeParse(raw);
      if (!result.success) {
        verbose(`TS config validation failed at ${configPath}: ${JSON.stringify(result.error)}`);
        return null;
      }
      // Post-safeParse cast: schema.safeParse widened by passthrough, narrow to actual type
      return result.data as T;
    }

    // Boundary cast: jiti returns unknown, caller provides expected type
    return raw as T;
  } catch (error) {
    verbose(`Failed to load TS config from ${configPath}: ${getErrorMessage(error)}`);
    return null;
  }
}
