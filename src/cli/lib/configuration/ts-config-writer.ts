import type { ProjectConfig } from "../../types";
import { compactStackForYaml } from "./config-generator";

/**
 * Generates a TypeScript config file source from a ProjectConfig object.
 * Output is a plain object literal with `satisfies ProjectConfig` for type safety.
 */
export function generateTsConfigSource(config: ProjectConfig): string {
  const serializable = config.stack
    ? { ...config, stack: compactStackForYaml(config.stack) }
    : { ...config };

  // JSON.parse(JSON.stringify(x)) removes undefined values
  const cleaned = JSON.parse(JSON.stringify(serializable));

  const body = JSON.stringify(cleaned, null, 2);

  return [
    `import type { ProjectConfig } from "./config-types";`,
    ``,
    `export default ${body} satisfies ProjectConfig;`,
    ``,
  ].join("\n");
}
