import { describe, it, expect } from "vitest";
import { typedEntries } from "../../../utils/typed-object";
import { defaultStacks } from "../default-stacks";

const EXPECTED_STACK_COUNT = 9;

/** Flat list of every (stack, agent, category) combination for parameterized tests */
const agentCategoryCases = defaultStacks.flatMap((stack) =>
  typedEntries(stack.agents).flatMap(([agentName, agentConfig]) => {
    if (agentConfig == null) return [];
    return typedEntries(agentConfig).map(([category, assignments]) => ({
      stackId: stack.id,
      agentName,
      category,
      assignments,
    }));
  }),
);

describe("defaultStacks", () => {
  it("has the expected number of stacks", () => {
    expect(defaultStacks).toHaveLength(EXPECTED_STACK_COUNT);
  });

  it("includes nextjs-fullstack with correct fields", () => {
    const stack = defaultStacks.find((s) => s.id === "nextjs-fullstack");
    expect(stack).toBeDefined();
    expect(stack!.name).toBe("Next.js Fullstack");
    expect(stack!.description).toBe("Next.js + Hono full-stack");
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

  it.each(defaultStacks)("stack $id has required fields", (stack) => {
    expect(stack.id).toBeTruthy();
    expect(stack.name).toBeTruthy();
    expect(stack.description).toBeTruthy();
    expect(stack.agents).toBeDefined();
  });

  it.each(agentCategoryCases)(
    "$stackId > $agentName > $category has normalized SkillAssignment[] values",
    ({ assignments }) => {
      expect(Array.isArray(assignments)).toBe(true);
      expect(assignments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            preloaded: expect.any(Boolean),
          }),
        ]),
      );
    },
  );

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
    expect(methodology!.every((a) => a.preloaded === true)).toBe(true);
  });
});
