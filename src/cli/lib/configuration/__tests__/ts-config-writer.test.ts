import { describe, it, expect } from "vitest";
import { generateTsConfigSource } from "../ts-config-writer";
import type { ProjectConfig } from "../../../types";

describe("generateTsConfigSource", () => {
  it("produces valid TypeScript with import and export default defineConfig", () => {
    const config: ProjectConfig = {
      name: "test-project",
      agents: ["web-developer"],
      skills: ["web-framework-react"],
    };
    const source = generateTsConfigSource(config);
    expect(source).toContain('import { defineConfig } from "@agents-inc/cli/config"');
    expect(source).toContain("export default defineConfig(");
    expect(source).toContain('"name": "test-project"');
  });

  it("omits undefined fields", () => {
    const config: ProjectConfig = {
      name: "sparse-project",
      agents: [],
      skills: [],
      description: undefined,
      author: undefined,
    };
    const source = generateTsConfigSource(config);
    expect(source).not.toContain("description");
    expect(source).not.toContain("author");
    expect(source).toContain('"name": "sparse-project"');
  });

  it("compacts stack with bare strings for non-preloaded skills", () => {
    const config: ProjectConfig = {
      name: "stack-project",
      agents: ["web-developer"],
      skills: ["web-framework-react"],
      stack: {
        "web-developer": {
          "web-framework": [{ id: "web-framework-react", preloaded: false }],
        },
      },
    };
    const source = generateTsConfigSource(config);
    // Non-preloaded single skill should be compacted to a bare string
    expect(source).toContain('"web-framework": "web-framework-react"');
  });

  it("preserves preloaded flag as object in stack", () => {
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
    const source = generateTsConfigSource(config);
    expect(source).toContain('"preloaded": true');
    expect(source).toContain('"api-framework-hono"');
  });

  it("handles config without stack", () => {
    const config: ProjectConfig = {
      name: "simple-project",
      agents: ["web-developer"],
      skills: ["web-framework-react"],
    };
    const source = generateTsConfigSource(config);
    expect(source).not.toContain('"stack"');
  });

  it("uses @agents-inc/cli/config import path", () => {
    const config: ProjectConfig = {
      name: "import-check",
      agents: [],
      skills: [],
    };
    const source = generateTsConfigSource(config);
    const importLine = source.split("\n")[0];
    expect(importLine).toBe('import { defineConfig } from "@agents-inc/cli/config";');
  });
});
