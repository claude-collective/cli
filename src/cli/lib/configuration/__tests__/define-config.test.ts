import { describe, it, expect } from "vitest";
import { defineConfig } from "../define-config";
import type { ProjectConfig } from "../../../types";

describe("defineConfig", () => {
  it("returns its input unchanged for a minimal config", () => {
    const config: ProjectConfig = {
      name: "test-project",
      agents: ["web-developer"],
      skills: [{ id: "web-framework-react", scope: "project", source: "local" }],
    };
    const result = defineConfig(config);
    expect(result).toBe(config);
  });

  it("returns its input unchanged for a full config", () => {
    const config: ProjectConfig = {
      name: "full-project",
      description: "A complete project",
      version: "1",
      agents: ["web-developer", "api-developer"],
      skills: [
        { id: "web-framework-react", scope: "project", source: "local" },
        { id: "api-framework-hono", scope: "project", source: "local" },
      ],
      author: "@vince",
      domains: ["web", "api"],
      selectedAgents: ["web-developer", "api-developer"],
      stack: {
        "web-developer": {
          "web-framework": [{ id: "web-framework-react", preloaded: false }],
        },
        "api-developer": {
          "api-api": [{ id: "api-framework-hono", preloaded: true }],
        },
      },
    };
    const result = defineConfig(config);
    expect(result).toBe(config);
  });

  it("preserves object identity (identity function)", () => {
    const config: ProjectConfig = {
      name: "identity-test",
      agents: [],
      skills: [],
    };
    expect(defineConfig(config)).toBe(config);
  });
});
