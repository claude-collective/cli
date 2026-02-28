import type { ProjectConfig } from "../../types";
import { compactStackForYaml } from "./config-generator";

/**
 * Generates a TypeScript config file source from a ProjectConfig object.
 * Output is a valid `defineConfig()` call that can be loaded back by ts-config-loader.
 */
export function generateTsConfigSource(config: ProjectConfig): string {
  const serializable = config.stack
    ? { ...config, stack: compactStackForYaml(config.stack) }
    : { ...config };

  // JSON.parse(JSON.stringify(x)) removes undefined values
  const cleaned = JSON.parse(JSON.stringify(serializable));

  const body = JSON.stringify(cleaned, null, 2);

  return [
    `import { defineConfig } from "@agents-inc/cli/config";`,
    ``,
    `export default defineConfig(${body});`,
    ``,
  ].join("\n");
}
