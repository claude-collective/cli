import path from "path";
import { fileURLToPath } from "url";
import { mkdir, writeFile, readFile } from "fs/promises";
import { parse as parseYaml } from "yaml";
import { createJiti } from "jiti";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../../consts";
import { renderConfigTs } from "../content-generators";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Resolve @agents-inc/cli/config to the source config-exports.ts so jiti can load it in dev. */
const CONFIG_EXPORTS_PATH = path.resolve(__dirname, "../../../config-exports.ts");

export async function readTestYaml<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");
  // Boundary cast: YAML parse returns `unknown`, caller provides expected type
  return parseYaml(content) as T;
}

/**
 * Load a config file using jiti. Handles defineConfig(), satisfies, and plain exports.
 */
export async function readTestTsConfig<T>(filePath: string): Promise<T> {
  const jiti = createJiti(import.meta.url, {
    moduleCache: false,
    interopDefault: true,
    alias: { "@agents-inc/cli/config": CONFIG_EXPORTS_PATH },
  });
  // Boundary cast: jiti returns unknown, caller provides expected type
  const result = await jiti.import(filePath, { default: true });
  return result as T;
}

/** Writes a config file with the given object into the given subdirectory (defaults to CLAUDE_SRC_DIR) */
export async function writeTestTsConfig(
  projectDir: string,
  config: Record<string, unknown>,
  configSubdir: string = CLAUDE_SRC_DIR,
): Promise<void> {
  const configDir = path.join(projectDir, configSubdir);
  await mkdir(configDir, { recursive: true });
  await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_TS), renderConfigTs(config));
}
