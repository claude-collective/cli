import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { generateTsConfigSource } from "../ts-config-writer";
import { loadTsConfig } from "../ts-config-loader";
import { defineConfig } from "../define-config";
import { createTempDir, cleanupTempDir } from "../../__tests__/helpers";
import type { ProjectConfig } from "../../../types";

let tempDir: string;

beforeEach(async () => {
  tempDir = await createTempDir("ts-config-roundtrip-");
});

afterEach(async () => {
  await cleanupTempDir(tempDir);
});

/**
 * Helper: write the config's defineConfig import to a local file so jiti can resolve it.
 * The generated source imports from "@agents-inc/cli/config" which jiti can't resolve
 * in tests. We patch the import to a local helper file instead.
 */
async function writeAndLoad(config: ProjectConfig): Promise<unknown> {
  // Write defineConfig helper
  const helperPath = path.join(tempDir, "config-helper.ts");
  await writeFile(
    helperPath,
    `export function defineConfig<const T>(config: T): T { return config; }`,
  );

  // Generate source and patch the import path
  let source = generateTsConfigSource(config);
  source = source.replace(
    'import { defineConfig } from "@agents-inc/cli/config";',
    'import { defineConfig } from "./config-helper";',
  );

  const configPath = path.join(tempDir, "config.ts");
  await writeFile(configPath, source);

  return loadTsConfig(configPath);
}

/**
 * Normalize config for comparison: the writer compacts stack values
 * (bare strings for non-preloaded single skills). After round-trip,
 * bare strings come back as strings (not SkillAssignment objects).
 * We normalize the original to match.
 */
function normalizeForComparison(config: ProjectConfig): Record<string, unknown> {
  // Remove undefined values (same as JSON.parse(JSON.stringify(x)))
  return JSON.parse(JSON.stringify(config));
}

/**
 * Normalize the loaded config's stack to match the compacted format.
 * The writer outputs compacted stack (bare strings for non-preloaded),
 * and jiti loads them back as-is (no normalization to SkillAssignment[]).
 */
function normalizeStack(
  stack: Record<string, Record<string, unknown>> | undefined,
): Record<string, Record<string, unknown>> | undefined {
  if (!stack) return undefined;

  const result: Record<string, Record<string, unknown>> = {};
  for (const [agent, agentConfig] of Object.entries(stack)) {
    const compacted: Record<string, unknown> = {};
    for (const [sub, value] of Object.entries(agentConfig as Record<string, unknown>)) {
      if (Array.isArray(value) && value.length === 1) {
        const assignment = value[0];
        if (typeof assignment === "object" && assignment !== null && "id" in assignment) {
          const a = assignment as { id: string; preloaded?: boolean };
          compacted[sub] = a.preloaded ? { id: a.id, preloaded: true } : a.id;
        } else {
          compacted[sub] = value;
        }
      } else if (Array.isArray(value)) {
        compacted[sub] = value.map((item: unknown) => {
          if (typeof item === "object" && item !== null && "id" in item) {
            const a = item as { id: string; preloaded?: boolean };
            return a.preloaded ? { id: a.id, preloaded: true } : a.id;
          }
          return item;
        });
      } else {
        compacted[sub] = value;
      }
    }
    result[agent] = compacted;
  }
  return result;
}

describe("TS config round-trip", () => {
  it("round-trips a minimal config", async () => {
    const config: ProjectConfig = {
      name: "minimal-project",
      agents: ["web-developer"],
      skills: ["web-framework-react"],
    };

    const loaded = await writeAndLoad(config);
    expect(loaded).toEqual(normalizeForComparison(config));
  });

  it("round-trips a config with stack (non-preloaded)", async () => {
    const config: ProjectConfig = {
      name: "stack-project",
      agents: ["web-developer", "api-developer"],
      skills: ["web-framework-react", "api-framework-hono"],
      stack: {
        "web-developer": {
          "web-framework": [{ id: "web-framework-react", preloaded: false }],
        },
        "api-developer": {
          "api-api": [{ id: "api-framework-hono", preloaded: false }],
        },
      },
    };

    const loaded = (await writeAndLoad(config)) as ProjectConfig;
    // Stack gets compacted: non-preloaded single skills become bare strings
    expect(loaded.name).toBe("stack-project");
    expect(loaded.agents).toEqual(["web-developer", "api-developer"]);
    expect(loaded.skills).toEqual(["web-framework-react", "api-framework-hono"]);

    // After compaction, bare strings
    const webDev = loaded.stack?.["web-developer"] as Record<string, unknown>;
    expect(webDev["web-framework"]).toBe("web-framework-react");
  });

  it("round-trips a config with preloaded stack skills", async () => {
    const config: ProjectConfig = {
      name: "preloaded-project",
      agents: ["api-developer"],
      skills: ["api-framework-hono"],
      stack: {
        "api-developer": {
          "api-api": [{ id: "api-framework-hono", preloaded: true }],
        },
      },
    };

    const loaded = (await writeAndLoad(config)) as ProjectConfig;
    const apiDev = loaded.stack?.["api-developer"] as Record<string, unknown>;
    // Preloaded stays as object
    expect(apiDev["api-api"]).toEqual({ id: "api-framework-hono", preloaded: true });
  });

  it("round-trips a full config with all optional fields", async () => {
    const config: ProjectConfig = {
      name: "full-project",
      description: "A complete project configuration",
      version: "1",
      agents: ["web-developer", "api-developer"],
      skills: ["web-framework-react", "api-framework-hono", "web-state-zustand"],
      author: "@vince",
      installMode: "local",
      domains: ["web", "api"],
      selectedAgents: ["web-developer", "api-developer"],
      source: "github:agents-inc/skills",
      marketplace: "agents-inc",
    };

    const loaded = await writeAndLoad(config);
    expect(loaded).toEqual(normalizeForComparison(config));
  });

  it("round-trips a config with multiple skills per subcategory", async () => {
    const config: ProjectConfig = {
      name: "multi-skill-project",
      agents: ["web-developer"],
      skills: ["web-testing-vitest", "web-testing-playwright-e2e"],
      stack: {
        "web-developer": {
          "web-testing": [
            { id: "web-testing-vitest", preloaded: false },
            { id: "web-testing-playwright-e2e", preloaded: true },
          ],
        },
      },
    };

    const loaded = (await writeAndLoad(config)) as ProjectConfig;
    const webDev = loaded.stack?.["web-developer"] as Record<string, unknown>;
    // Multiple skills: array with compacted elements
    expect(webDev["web-testing"]).toEqual([
      "web-testing-vitest",
      { id: "web-testing-playwright-e2e", preloaded: true },
    ]);
  });

  it("omits undefined fields in round-trip", async () => {
    const config: ProjectConfig = {
      name: "sparse-project",
      agents: [],
      skills: [],
      description: undefined,
      author: undefined,
      stack: undefined,
    };

    const loaded = (await writeAndLoad(config)) as Record<string, unknown>;
    expect(loaded).toEqual({ name: "sparse-project", agents: [], skills: [] });
    expect("description" in loaded).toBe(false);
    expect("author" in loaded).toBe(false);
    expect("stack" in loaded).toBe(false);
  });
});
