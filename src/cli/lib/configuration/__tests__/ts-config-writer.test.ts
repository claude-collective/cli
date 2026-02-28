import { describe, it, expect } from "vitest";
import { generateTsConfigSource } from "../ts-config-writer";
import type { ProjectConfig } from "../../../types";

describe("generateTsConfigSource", () => {
  it("produces valid TypeScript with import type and export default object literal", () => {
    const config: ProjectConfig = {
      name: "test-project",
      agents: ["web-developer"],
      skills: ["web-framework-react"],
    };
    const source = generateTsConfigSource(config);
    expect(source).not.toContain("defineConfig");
    expect(source).toContain('import type { ProjectConfig } from "./config-types"');
    expect(source).toContain("export default {");
    expect(source).toContain("satisfies ProjectConfig;");
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

  it("uses import type for config-types and no defineConfig import", () => {
    const config: ProjectConfig = {
      name: "import-check",
      agents: [],
      skills: [],
    };
    const source = generateTsConfigSource(config);
    const lines = source.split("\n");
    expect(lines[0]).toBe('import type { ProjectConfig } from "./config-types";');
    expect(source).not.toContain("defineConfig");
    expect(source).not.toContain("@agents-inc/cli/config");
  });
});
