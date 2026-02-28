import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { z } from "zod";
import { loadTsConfig } from "../ts-config-loader";
import { createTempDir, cleanupTempDir } from "../../__tests__/helpers";

let tempDir: string;

beforeEach(async () => {
  tempDir = await createTempDir("ts-config-loader-");
});

afterEach(async () => {
  await cleanupTempDir(tempDir);
});

describe("loadTsConfig", () => {
  it("returns null for nonexistent file", async () => {
    const result = await loadTsConfig(path.join(tempDir, "nonexistent.ts"));
    expect(result).toBeNull();
  });

  it("loads a valid TS config file with default export", async () => {
    const configPath = path.join(tempDir, "config.ts");
    await writeFile(
      configPath,
      `export default { name: "my-project", agents: ["web-developer"], skills: [] };`,
    );
    const result = await loadTsConfig<{ name: string }>(configPath);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("my-project");
  });

  it("returns null for malformed TS file with syntax error", async () => {
    const configPath = path.join(tempDir, "bad-syntax.ts");
    await writeFile(configPath, `export default {{{{{ broken syntax`);
    const result = await loadTsConfig(configPath);
    expect(result).toBeNull();
  });

  it("returns null when Zod schema rejects the data", async () => {
    const configPath = path.join(tempDir, "invalid-schema.ts");
    await writeFile(configPath, `export default { count: 42 };`);

    const schema = z.object({ name: z.string() });
    const result = await loadTsConfig(configPath, schema);
    expect(result).toBeNull();
  });

  it("returns validated data when Zod schema accepts", async () => {
    const configPath = path.join(tempDir, "valid-schema.ts");
    await writeFile(
      configPath,
      `export default { name: "validated", agents: ["web-developer"], skills: [] };`,
    );

    const schema = z.object({
      name: z.string(),
      agents: z.array(z.string()),
      skills: z.array(z.string()),
    });
    const result = await loadTsConfig<{ name: string; agents: string[]; skills: string[] }>(
      configPath,
      schema,
    );
    expect(result).not.toBeNull();
    expect(result!.name).toBe("validated");
  });

  it("handles TS config that uses defineConfig identity function", async () => {
    // Write a helper module that the config imports
    const helperPath = path.join(tempDir, "helper.ts");
    await writeFile(
      helperPath,
      `export function defineConfig<const T>(config: T): T { return config; }`,
    );

    const configPath = path.join(tempDir, "with-define.ts");
    await writeFile(
      configPath,
      [
        `import { defineConfig } from "./helper";`,
        `export default defineConfig({ name: "defined", agents: [], skills: [] });`,
      ].join("\n"),
    );
    const result = await loadTsConfig<{ name: string }>(configPath);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("defined");
  });
});
