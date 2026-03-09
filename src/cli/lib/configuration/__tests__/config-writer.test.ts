import { describe, it, expect } from "vitest";
import { generateConfigSource } from "../config-writer";
import { buildProjectConfig, buildSkillConfigs } from "../../__tests__/helpers";

describe("generateConfigSource", () => {
  it("produces valid TypeScript with import type, export default, and named variables", () => {
    const config = buildProjectConfig();
    const source = generateConfigSource(config);
    expect(source).not.toContain("defineConfig");
    expect(source).toContain('from "./config-types"');
    expect(source).toContain("export default {");
    expect(source).toContain("satisfies ProjectConfig;");
    expect(source).toContain('"name": "test-project"');
    // Named variables below export default
    expect(source).toContain("const skills: SkillConfig[]");
    expect(source).toContain("const agents: AgentScopeConfig[]");
  });

  it("puts named variables before export default", () => {
    const config = buildProjectConfig();
    const source = generateConfigSource(config);
    const exportIdx = source.indexOf("export default");
    const skillsIdx = source.indexOf("const skills:");
    const agentsIdx = source.indexOf("const agents:");
    expect(skillsIdx).toBeLessThan(exportIdx);
    expect(agentsIdx).toBeLessThan(exportIdx);
  });

  it("omits undefined fields", () => {
    const config = buildProjectConfig({
      name: "sparse-project",
      agents: [],
      skills: [],
      description: undefined,
      author: undefined,
    });
    const source = generateConfigSource(config);
    expect(source).not.toContain("description");
    expect(source).not.toContain("author");
    expect(source).toContain('"name": "sparse-project"');
  });

  it("uses inline empty arrays for empty skills/agents", () => {
    const config = buildProjectConfig({
      name: "sparse-project",
      agents: [],
      skills: [],
    });
    const source = generateConfigSource(config);
    // Empty arrays should be inline, not extracted
    expect(source).toContain("skills: [],");
    expect(source).toContain("agents: [],");
    expect(source).not.toContain("const skills:");
    expect(source).not.toContain("const agents:");
  });

  it("compacts stack with bare strings for non-preloaded skills", () => {
    const config = buildProjectConfig({
      name: "stack-project",
      stack: {
        "web-developer": {
          "web-framework": [{ id: "web-framework-react", preloaded: false }],
        },
      },
    });
    const source = generateConfigSource(config);
    // Non-preloaded single skill should be compacted to a bare string
    expect(source).toContain('"web-framework": "web-framework-react"');
    // Stack should be extracted as named variable
    expect(source).toContain("const stack: Record<AgentName, StackAgentConfig>");
  });

  it("preserves preloaded flag as object in stack", () => {
    const config = buildProjectConfig({
      name: "preloaded-project",
      agents: [{ name: "api-developer", scope: "project" }],
      skills: buildSkillConfigs(["api-framework-hono"]),
      stack: {
        "api-developer": {
          "api-api": [{ id: "api-framework-hono", preloaded: true }],
        },
      },
    });
    const source = generateConfigSource(config);
    expect(source).toContain('"preloaded": true');
    expect(source).toContain('"api-framework-hono"');
  });

  it("handles config without stack", () => {
    const config = buildProjectConfig({ name: "simple-project" });
    const source = generateConfigSource(config);
    expect(source).not.toContain("const stack:");
    expect(source).not.toContain("stack,");
  });

  it("only imports used types", () => {
    // Empty skills/agents, no stack, no domains: only ProjectConfig needed
    const config = buildProjectConfig({ name: "minimal", agents: [], skills: [] });
    const source = generateConfigSource(config);
    const importLine = source.split("\n")[0];
    expect(importLine).toBe('import type { ProjectConfig } from "./config-types";');
    expect(source).not.toContain("defineConfig");
    expect(source).not.toContain("@agents-inc/cli/config");
  });

  it("imports SkillConfig and AgentScopeConfig when skills and agents are present", () => {
    const config = buildProjectConfig();
    const source = generateConfigSource(config);
    expect(source).toContain("SkillConfig");
    expect(source).toContain("AgentScopeConfig");
  });

  it("imports AgentName and StackAgentConfig when stack is present", () => {
    const config = buildProjectConfig({
      stack: {
        "web-developer": {
          "web-framework": [{ id: "web-framework-react", preloaded: false }],
        },
      },
    });
    const source = generateConfigSource(config);
    expect(source).toContain("AgentName");
    expect(source).toContain("StackAgentConfig");
  });

  it("imports Domain when domains are present", () => {
    const config = buildProjectConfig({ domains: ["web"] });
    const source = generateConfigSource(config);
    expect(source).toContain("Domain");
    expect(source).toContain('const domains: Domain[] = ["web"]');
  });

  it("extracts domains as named variable", () => {
    const config = buildProjectConfig({ domains: ["web", "api"] });
    const source = generateConfigSource(config);
    expect(source).toContain("const domains: Domain[]");
    expect(source).toContain('"web"');
    expect(source).toContain('"api"');
    // In export default, domains should be a shorthand reference
    const exportBlock = source.slice(
      source.indexOf("export default"),
      source.indexOf("satisfies ProjectConfig;"),
    );
    expect(exportBlock).toContain("domains,");
  });
});
