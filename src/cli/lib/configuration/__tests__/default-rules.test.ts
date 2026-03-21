import { describe, it, expect } from "vitest";
import { defaultRules } from "../default-rules";

describe("defaultRules", () => {
  it("has version and relationships", () => {
    expect(defaultRules.version).toBe("1.0.0");
    expect(defaultRules.relationships).toBeDefined();
  });

  it("has conflict rules", () => {
    expect(defaultRules.relationships.conflicts.length).toBeGreaterThan(0);
    const frameworkConflict = defaultRules.relationships.conflicts.find((c) =>
      c.skills.includes("react"),
    );
    expect(frameworkConflict).toBeDefined();
    expect(frameworkConflict!.reason).toBe("Base frameworks are mutually exclusive");
  });

  it("has recommend rules as flat picks with skill and reason", () => {
    expect(defaultRules.relationships.recommends.length).toBeGreaterThan(0);
    const zustandRecommend = defaultRules.relationships.recommends.find(
      (r) => r.skill === "zustand",
    );
    expect(zustandRecommend).toBeDefined();
    expect(zustandRecommend!.reason).toBe("Best-in-class React state management");
  });

  it("has require rules", () => {
    expect(defaultRules.relationships.requires.length).toBeGreaterThan(0);
    const zustandRequires = defaultRules.relationships.requires.find((r) => r.skill === "zustand");
    expect(zustandRequires).toBeDefined();
    expect(zustandRequires!.needsAny).toBe(true);
  });

  it("has alternative groups", () => {
    expect(defaultRules.relationships.alternatives.length).toBeGreaterThan(0);
    const frameworkAlts = defaultRules.relationships.alternatives.find(
      (a) => a.purpose === "Base Framework",
    );
    expect(frameworkAlts).toBeDefined();
    expect(frameworkAlts!.skills).toContain("react");
  });

  it("has discourage rules (currently empty — conflicts prevent co-selection)", () => {
    expect(defaultRules.relationships.discourages).toStrictEqual([]);
  });
});
