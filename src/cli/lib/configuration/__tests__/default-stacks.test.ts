import { describe, it, expect } from "vitest";
import { defaultStacks } from "../default-stacks";

const EXPECTED_STACK_COUNT = 6;

describe("defaultStacks", () => {
  it("has the expected number of stacks", () => {
    expect(defaultStacks).toHaveLength(EXPECTED_STACK_COUNT);
  });

  it("includes nextjs-fullstack with correct fields", () => {
    const stack = defaultStacks.find((s) => s.id === "nextjs-fullstack");
    expect(stack).toBeDefined();
    expect(stack!.name).toBe("Next.js Fullstack");
    expect(stack!.description).toBe("React + Hono full-stack");
    expect(stack!.philosophy).toBe("Ship fast, iterate faster");
  });

  it("includes angular-stack with correct fields", () => {
    const stack = defaultStacks.find((s) => s.id === "angular-stack");
    expect(stack).toBeDefined();
    expect(stack!.name).toBe("Modern Angular Stack");
    expect(stack!.philosophy).toBe("Enterprise-grade and type-safe");
  });

  it("includes solidjs-stack", () => {
    const stack = defaultStacks.find((s) => s.id === "solidjs-stack");
    expect(stack).toBeDefined();
    expect(stack!.name).toBe("SolidJS Stack");
  });

  it("all stacks have required fields", () => {
    for (const stack of defaultStacks) {
      expect(stack.id, `stack missing id`).toBeTruthy();
      expect(stack.name, `${stack.id} missing name`).toBeTruthy();
      expect(stack.description, `${stack.id} missing description`).toBeTruthy();
      expect(stack.agents, `${stack.id} missing agents`).toBeDefined();
    }
  });

  it("all stack agent configs have normalized SkillAssignment[] values", () => {
    for (const stack of defaultStacks) {
      for (const [agentName, agentConfig] of Object.entries(stack.agents)) {
        if (agentConfig == null) continue;
        for (const [subcategory, assignments] of Object.entries(agentConfig)) {
          expect(
            Array.isArray(assignments),
            `${stack.id} > ${agentName} > ${subcategory} should be an array`,
          ).toBe(true);
          for (const assignment of assignments) {
            expect(
              typeof assignment.id,
              `${stack.id} > ${agentName} > ${subcategory} assignment should have string id`,
            ).toBe("string");
            expect(
              typeof assignment.preloaded,
              `${stack.id} > ${agentName} > ${subcategory} assignment should have boolean preloaded`,
            ).toBe("boolean");
          }
        }
      }
    }
  });

  it("nextjs-fullstack has web-developer with preloaded react framework", () => {
    const stack = defaultStacks.find((s) => s.id === "nextjs-fullstack");
    const webDev = stack!.agents["web-developer"];
    expect(webDev).toBeDefined();
    const framework = webDev!["web-framework"];
    expect(framework).toBeDefined();
    expect(framework).toContainEqual({ id: "web-framework-react", preloaded: true });
  });

  it("nextjs-fullstack has methodology skills preloaded", () => {
    const stack = defaultStacks.find((s) => s.id === "nextjs-fullstack");
    const webDev = stack!.agents["web-developer"];
    const methodology = webDev!["shared-methodology"];
    expect(methodology).toBeDefined();
    expect(methodology!.length).toBeGreaterThan(0);
    for (const assignment of methodology!) {
      expect(assignment.preloaded).toBe(true);
    }
  });
});
