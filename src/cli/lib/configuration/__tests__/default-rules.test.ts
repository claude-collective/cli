import { describe, it, expect } from "vitest";
import { defaultRules } from "../default-rules";

describe("defaultRules", () => {
  it("has version, aliases, relationships, and perSkill", () => {
    expect(defaultRules.version).toBe("1.0.0");
    expect(defaultRules.aliases).toBeDefined();
    expect(defaultRules.relationships).toBeDefined();
    expect(defaultRules.perSkill).toBeDefined();
  });

  it("has expected alias entries", () => {
    expect(defaultRules.aliases.react).toBe("web-framework-react");
    expect(defaultRules.aliases.zustand).toBe("web-state-zustand");
    expect(defaultRules.aliases.hono).toBe("api-framework-hono");
    expect(defaultRules.aliases.vitest).toBe("web-testing-vitest");
  });

  it("has conflict rules", () => {
    expect(defaultRules.relationships.conflicts.length).toBeGreaterThan(0);
    const frameworkConflict = defaultRules.relationships.conflicts.find((c) =>
      c.skills.includes("web-framework-react"),
    );
    expect(frameworkConflict).toBeDefined();
    expect(frameworkConflict!.reason).toBe("Frameworks are mutually exclusive");
  });

  it("has recommend rules", () => {
    expect(defaultRules.relationships.recommends.length).toBeGreaterThan(0);
    const reactRecommends = defaultRules.relationships.recommends.find(
      (r) => r.when === "web-framework-react",
    );
    expect(reactRecommends).toBeDefined();
    expect(reactRecommends!.suggest).toContain("web-state-zustand");
  });

  it("has require rules", () => {
    expect(defaultRules.relationships.requires.length).toBeGreaterThan(0);
    const zustandRequires = defaultRules.relationships.requires.find(
      (r) => r.skill === "web-state-zustand",
    );
    expect(zustandRequires).toBeDefined();
    expect(zustandRequires!.needsAny).toBe(true);
  });

  it("has alternative groups", () => {
    expect(defaultRules.relationships.alternatives.length).toBeGreaterThan(0);
    const frameworkAlts = defaultRules.relationships.alternatives.find(
      (a) => a.purpose === "Frontend Framework",
    );
    expect(frameworkAlts).toBeDefined();
    expect(frameworkAlts!.skills).toContain("web-framework-react");
  });

  it("has discourage rules", () => {
    expect(defaultRules.relationships.discourages.length).toBeGreaterThan(0);
  });

  it("has perSkill entries", () => {
    expect(defaultRules.perSkill.zustand).toBeDefined();
    expect(defaultRules.perSkill.zustand!.compatibleWith).toContain("web-framework-react");
  });
});
