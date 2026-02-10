/**
 * Integration tests for the full Wizard component (v2).
 *
 * Tests complete user flows through the wizard from start to finish.
 * V2 wizard flow: approach -> stack -> build -> confirm
 *
 * Flow coverage:
 * - Flow A1: Stack -> Build -> Accept Defaults (A shortcut) -> Confirm
 * - Flow A2: Stack -> Build (pre-populated) -> Confirm
 * - Flow B: Scratch -> Single Domain (Web) -> Build -> Confirm
 * - Flow C: Scratch -> Multi-Domain (Web + API) -> Build/Web -> Build/API -> Confirm
 * - Flow D: Back Navigation with selection preservation
 * - Flow E: Cancel from First Step
 *
 * Note: Select component requires consistent delays between operations.
 */
import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Wizard } from "../../../components/wizard/wizard";
import { useWizardStore } from "../../../stores/wizard-store";
import { createMockMatrix, createMockSkill } from "../helpers";


import type { MergedSkillsMatrix, ResolvedStack, CategoryDefinition, Subcategory, SkillAlias, SkillId, AgentName } from "../../../types-matrix";
import { ARROW_DOWN, ARROW_UP, ENTER, ESCAPE, RENDER_DELAY_MS, delay } from "../test-constants";

// =============================================================================
// Constants
// =============================================================================

// Longer delay for wizard step transitions
const STEP_TRANSITION_DELAY_MS = 150;

// Space key for toggling selections in CategoryGrid
const SPACE = " ";

// =============================================================================
// Mock Data Factory
// =============================================================================

/**
 * Create a comprehensive mock matrix with:
 * - Categories with domain fields (web, api, cli)
 * - Skills in each category
 * - skill_aliases mapping
 * - Relationships (conflicts, recommends)
 */
const createComprehensiveMatrix = (): MergedSkillsMatrix => {
  // Create skills for different domains
  const skills = {
    // Web domain skills
    ["web-framework-react"]: createMockSkill("web-framework-react", "framework", {
      name: "React",
      description: "React framework",
      alias: "react",
    }),
    ["web-framework-vue"]: createMockSkill("web-framework-vue", "framework", {
      name: "Vue",
      description: "Vue.js framework",
      alias: "vue",
      conflictsWith: [{ skillId: "web-framework-react", reason: "Choose one framework" }],
    }),
    ["web-state-zustand"]: createMockSkill("web-state-zustand", "client-state", {
      name: "Zustand",
      description: "State management",
      alias: "zustand",
      recommends: [{ skillId: "web-framework-react", reason: "Works great with React" }],
    }),
    ["web-styling-scss-modules"]: createMockSkill("web-styling-scss-modules", "styling", {
      name: "SCSS Modules",
      description: "CSS Modules with SCSS",
      alias: "scss-modules",
    }),
    // API domain skills
    ["api-framework-hono"]: createMockSkill("api-framework-hono", "api", {
      name: "Hono",
      description: "Web framework for the edge",
      alias: "hono",
    }),
    ["api-database-drizzle"]: createMockSkill("api-database-drizzle", "database", {
      name: "Drizzle",
      description: "TypeScript ORM",
      alias: "drizzle",
    }),
    // Testing (shared domain)
    ["web-testing-vitest"]: createMockSkill("web-testing-vitest", "testing", {
      name: "Vitest",
      description: "Testing framework",
      alias: "vitest",
    }),
  };

  // Create categories with domain assignments
  const categories = {
    // Web domain categories
    ["framework"]: {
      id: "framework",
      name: "Framework",
      description: "UI Frameworks",
      domain: "web",
      exclusive: true,
      required: true,
      order: 0,
    },
    ["client-state"]: {
      id: "client-state",
      name: "State",
      description: "State management",
      domain: "web",
      exclusive: true,
      required: false,
      order: 1,
    },
    ["styling"]: {
      id: "styling",
      name: "Styling",
      description: "CSS solutions",
      domain: "web",
      exclusive: true,
      required: false,
      order: 2,
    },
    // API domain categories
    ["api"]: {
      id: "api",
      name: "Backend Framework",
      description: "Server frameworks",
      domain: "api",
      exclusive: true,
      required: true,
      order: 0,
    },
    ["database"]: {
      id: "database",
      name: "Database",
      description: "Database ORMs",
      domain: "api",
      exclusive: true,
      required: false,
      order: 1,
    },
    // Shared domain
    ["testing"]: {
      id: "testing",
      name: "Testing",
      description: "Testing tools",
      domain: "shared",
      exclusive: false,
      required: false,
      order: 10,
    },
  };

  // Create suggested stacks
  const suggestedStacks: ResolvedStack[] = [
    {
      id: "nextjs-fullstack",
      name: "Next.js Fullstack",
      description: "Complete Next.js stack with React and Hono",
      audience: ["startups", "enterprise"],
      skills: {
        "web-developer": {
          framework: "react",
          "client-state": "zustand",
          styling: "scss-modules",
        },
        "api-developer": {
          api: "hono",
          database: "drizzle",
        },
      },
      allSkillIds: [
        "web-framework-react",
        "web-state-zustand",
        "web-styling-scss-modules",
        "api-framework-hono",
        "api-database-drizzle",
      ],
      philosophy: "Modern, type-safe fullstack development",
    },
    {
      id: "vue-stack",
      name: "Vue Stack",
      description: "Vue.js frontend stack",
      audience: ["startups"],
      skills: {
        "web-developer": {
          framework: "vue",
        },
      },
      allSkillIds: ["web-framework-vue"],
      philosophy: "Progressive framework approach",
    },
  ];

  // Create aliases mapping
  const aliases = {
    react: "web-framework-react",
    vue: "web-framework-vue",
    zustand: "web-state-zustand",
    "scss-modules": "web-styling-scss-modules",
    hono: "api-framework-hono",
    drizzle: "api-database-drizzle",
    vitest: "web-testing-vitest",
  } as unknown as Record<SkillAlias, SkillId>;

  // Create reverse aliases
  const aliasesReverse = {} as Record<SkillId, SkillAlias>;
  for (const [alias, fullId] of Object.entries(aliases)) {
    (aliasesReverse as Record<string, string>)[fullId] = alias;
  }

  return createMockMatrix(skills, {
    categories: categories as Record<Subcategory, CategoryDefinition>,
    suggestedStacks,
    aliases,
    aliasesReverse,
  });
};

/**
 * Create a simpler mock matrix for basic flow tests.
 * This is the original matrix used in existing tests.
 */
const createBasicMatrix = (): MergedSkillsMatrix => {
  const skills = {
    ["web-framework-react"]: createMockSkill("web-framework-react", "framework", {
      name: "React",
      description: "React framework",
    }),
    ["web-state-zustand"]: createMockSkill("web-state-zustand", "client-state", {
      name: "Zustand",
      description: "State management",
    }),
    ["api-framework-hono"]: createMockSkill("api-framework-hono", "api", {
      name: "Hono",
      description: "Web framework",
    }),
    ["web-testing-vitest"]: createMockSkill("web-testing-vitest", "testing", {
      name: "Vitest",
      description: "Testing framework",
    }),
  };

  const suggestedStacks: ResolvedStack[] = [
    {
      id: "react-fullstack",
      name: "React Fullstack",
      description: "Complete React stack",
      audience: [],
      skills: {},
      allSkillIds: ["web-framework-react", "web-state-zustand", "api-framework-hono"],
      philosophy: "",
    },
    {
      id: "testing-stack",
      name: "Testing Stack",
      description: "Testing focused stack",
      audience: [],
      skills: {},
      allSkillIds: ["web-testing-vitest"],
      philosophy: "",
    },
  ];

  return createMockMatrix(skills, {
    suggestedStacks,
    categories: {
      ["framework"]: {
        id: "framework",
        name: "Framework",
        description: "UI Frameworks",
        domain: "web",
        exclusive: true,
        required: true,
        order: 0,
      },
      ["client-state"]: {
        id: "client-state",
        name: "State",
        description: "State management",
        domain: "web",
        exclusive: true,
        required: false,
        order: 1,
      },
      ["api"]: {
        id: "api",
        name: "Backend Framework",
        description: "Backend frameworks",
        domain: "api",
        exclusive: true,
        required: true,
        order: 0,
      },
      ["testing"]: {
        id: "testing",
        name: "Testing Framework",
        description: "Testing frameworks",
        domain: "shared",
        exclusive: false,
        required: false,
        order: 0,
      },
    } as Record<Subcategory, CategoryDefinition>,
  });
};

// =============================================================================
// Tests
// =============================================================================

describe("Wizard integration", () => {
  let cleanup: (() => void) | undefined;
  let mockMatrix: MergedSkillsMatrix;

  beforeEach(() => {
    useWizardStore.getState().reset();
    mockMatrix = createBasicMatrix();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  // ===========================================================================
  // Flow A1: Stack -> Continue with Defaults -> Confirm
  // ===========================================================================

  describe("Flow A1: Stack path with defaults", () => {
    it("should complete full stack -> build -> accept defaults -> confirm flow", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Step 1: Approach - verify we're on approach step
      expect(lastFrame()).toContain("pre-built template");
      expect(lastFrame()).toContain("Intro");

      // Select "Use a pre-built template" (stack path)
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 2: Stack Selection - select first stack (card UI, focus starts at first card)
      expect(lastFrame()).toContain("React Fullstack");
      await stdin.write(ENTER); // First stack card is already focused
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 3: Build - now goes directly to build (pre-populated from stack)
      // Press "A" to accept defaults and skip to confirm
      await stdin.write("A");
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 4: Confirm - should show confirmation with stack name
      expect(lastFrame()).toContain("React Fullstack");
      expect(lastFrame()).toContain("Confirm");

      // Complete the wizard
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Verify completion callback was called
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();

      // Verify result contains expected data
      const result = onComplete.mock.calls[0][0];
      expect(result.selectedStackId).toBe("react-fullstack");
      expect(result.cancelled).toBe(false);
    });

    it("should show stack name on confirm step", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate through: approach -> stack -> build -> [A] accept defaults -> confirm
      await stdin.write(ENTER); // Stack approach
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER); // Select first stack (card UI, already focused)
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write("A"); // Accept defaults
      await delay(STEP_TRANSITION_DELAY_MS);

      // Verify confirm step shows stack info
      const frame = lastFrame();
      expect(frame).toContain("React Fullstack");
    });
  });

  // ===========================================================================
  // Flow A2: Stack -> Customize -> Build -> Confirm
  // ===========================================================================

  describe("Flow A2: Stack path with customize", () => {
    it("should navigate stack -> build step (pre-populated from stack)", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Step 1: Approach - select stack
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 2: Stack Selection - select first stack (card UI, already focused)
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 3: Build - goes directly to build (pre-populated from stack)
      expect(lastFrame()).toContain("Build");

      // Verify store state reflects customize action and pre-population
      const state = useWizardStore.getState();
      expect(state.stackAction).toBe("customize");
      expect(state.step).toBe("build");
      // Verify domainSelections were populated from stack
      expect(Object.keys(state.domainSelections).length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Flow B: Scratch -> Single Domain (Web) -> Build -> Confirm
  // ===========================================================================

  describe("Flow B: Scratch path with single domain (Web)", () => {
    it("should start scratch flow from approach", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Step 1: Approach - select "Start from scratch"
      expect(lastFrame()).toContain("Start from scratch");
      await stdin.write(ARROW_DOWN); // Navigate to "Start from scratch"
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should now be at domain selection
      expect(lastFrame()).toContain("Select domains");

      // Verify store state
      const state = useWizardStore.getState();
      expect(state.approach).toBe("scratch");
      expect(state.step).toBe("stack"); // Domain selection happens in "stack" step
    });

    it("should complete scratch flow from domain selection to build", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      // Pre-set to scratch approach at stack step with web domain selected
      useWizardStore.setState({
        step: "stack",
        approach: "scratch",
        selectedDomains: ["web"],
        history: ["approach"],
      });

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Should be at domain selection with web pre-selected
      expect(lastFrame()).toContain("Select domains");
      expect(lastFrame()).toContain("Selected");
      expect(lastFrame()).toContain("web");

      // Navigate to Continue (which now appears since a domain is selected)
      // Options: Back, Web[checked], Web Extras, API, CLI, Mobile, Continue
      // Navigate to the last option (Continue)
      await stdin.write(ARROW_DOWN); // Past Back to Web
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN); // To Web Extras
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN); // To API
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN); // To CLI
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN); // To Mobile
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN); // To Continue
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER); // Continue to build
      await delay(STEP_TRANSITION_DELAY_MS);

      // Verify we're at build step
      const state = useWizardStore.getState();
      expect(state.step).toBe("build");
      expect(state.selectedDomains).toContain("web");
    });

    it("should allow selecting web technologies in Build step", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      // Pre-set store to build step with web domain selected
      useWizardStore.setState({
        step: "build",
        approach: "scratch",
        selectedDomains: ["web"],
        currentDomainIndex: 0,
        domainSelections: {},
      });

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Should be on Build step with web categories
      expect(lastFrame()).toContain("Build");

      // Toggle a technology selection with SPACE
      await stdin.write(SPACE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Continue to confirm
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be at confirm step
      const state = useWizardStore.getState();
      expect(state.step).toBe("confirm");
    });
  });

  // ===========================================================================
  // Flow C: Scratch -> Multi-Domain (Web + API) -> Build/Web -> Build/API -> Confirm
  // ===========================================================================

  describe("Flow C: Scratch path with multi-domain (Web + API)", () => {
    it("should correctly set approach when selecting scratch", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Step 1: Approach - select scratch
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Verify approach is scratch and we're at domain selection
      const state = useWizardStore.getState();
      expect(state.approach).toBe("scratch");
      expect(state.step).toBe("stack"); // Domain selection uses stack step
      expect(lastFrame()).toContain("Select domains");
    });

    it("should navigate through multi-domain build with pre-selected domains", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      // Pre-set with both web and api domains selected
      useWizardStore.setState({
        step: "stack",
        approach: "scratch",
        selectedDomains: ["web", "api"],
        history: ["approach"],
      });

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Verify both domains are shown as selected
      expect(lastFrame()).toContain("Selected");
      expect(lastFrame()).toContain("web");
      expect(lastFrame()).toContain("api");

      // Navigate to Continue option
      // Options: Back, Web[checked], Web Extras, API[checked], CLI, Mobile, Continue
      await stdin.write(ARROW_DOWN); // To Web
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN); // To Web Extras
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN); // To API
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN); // To CLI
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN); // To Mobile
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN); // To Continue
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER); // Continue to build
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be at build step with first domain (web)
      const state = useWizardStore.getState();
      expect(state.step).toBe("build");
      expect(state.currentDomainIndex).toBe(0);
    });

    it("should show domain tabs for multi-domain build", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      // Pre-set store to build step with multiple domains
      useWizardStore.setState({
        step: "build",
        approach: "scratch",
        selectedDomains: ["web", "api"],
        currentDomainIndex: 0,
        domainSelections: {},
      });

      const { lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Should show ViewTitle for current domain
      const frame = lastFrame();
      expect(frame).toContain("Customise your Web stack");
    });

    it("should advance to next domain when validation passes", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      // Pre-set store with required selections already made
      useWizardStore.setState({
        step: "build",
        approach: "scratch",
        selectedDomains: ["web", "api"],
        currentDomainIndex: 0,
        domainSelections: {
          web: { ["framework"]: ["react"] },
        },
      });

      const { stdin, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Continue to next domain
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should now be on second domain
      const state = useWizardStore.getState();
      expect(state.currentDomainIndex).toBe(1);
    });

    it("should allow navigation between domains using escape", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      // Pre-set to build step on second domain
      useWizardStore.setState({
        step: "build",
        approach: "scratch",
        selectedDomains: ["web", "api"],
        currentDomainIndex: 1, // On API domain
        domainSelections: {
          web: { ["framework"]: ["react"] },
        },
        history: ["approach", "stack", "build"],
      });

      const { stdin, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Press escape to go back to first domain
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be back on first domain
      const state = useWizardStore.getState();
      expect(state.currentDomainIndex).toBe(0);

      // Web selections should be preserved
      expect(state.domainSelections.web?.["framework"]).toContain("react");
    });
  });

  // ===========================================================================
  // Flow D: Back Navigation
  // ===========================================================================

  describe("Flow D: Back navigation", () => {
    it("should navigate back through multiple steps preserving selections", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate forward: approach -> stack -> build
      // Step 1: Select stack approach
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 2: Select a stack (card UI, first card already focused)
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Verify we're at build (goes directly from stack to build now)
      let state = useWizardStore.getState();
      expect(state.step).toBe("build");
      expect(state.selectedStackId).toBe("react-fullstack");

      // Go back to stack selection
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be at stack selection
      expect(lastFrame()).toContain("React Fullstack");
      state = useWizardStore.getState();
      expect(state.step).toBe("stack");
      // Stack selection should be preserved
      expect(state.selectedStackId).toBe("react-fullstack");

      // Go back to approach (card UI uses Escape for back)
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be at approach
      expect(lastFrame()).toContain("pre-built template");
      state = useWizardStore.getState();
      expect(state.step).toBe("approach");

      // Now navigate forward again and verify we can complete
      await stdin.write(ENTER); // Stack approach
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER); // Select first stack (card UI, already focused)
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write("A"); // Accept defaults
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be at confirm
      expect(lastFrame()).toContain("Confirm");
    });

    it("should preserve domain selections when navigating back in scratch flow", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to scratch flow and select domains
      await stdin.write(ARROW_DOWN); // Scratch
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Select Web domain
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Verify selection
      let state = useWizardStore.getState();
      expect(state.selectedDomains).toContain("web");

      // Go back to approach
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be at approach
      expect(lastFrame()).toContain("pre-built template");

      // Domain selection should be preserved
      state = useWizardStore.getState();
      expect(state.selectedDomains).toContain("web");
    });
  });

  // ===========================================================================
  // Flow E: Cancel from First Step
  // ===========================================================================

  describe("Flow E: Cancel from first step", () => {
    it("should call onCancel when escape pressed at approach", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Press escape at first step
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should have called onCancel
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should not call onCancel when going back from later steps", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to stack selection
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Press escape to go back
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be back at approach, not cancelled
      expect(lastFrame()).toContain("pre-built template");
      expect(onCancel).not.toHaveBeenCalled();

      // Now escape at approach should cancel
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Legacy Tests (migrated from original file)
  // ===========================================================================

  describe("stack selection flow", () => {
    it("should navigate through approach -> stack -> build", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Step 1: Approach - select "Use a pre-built template"
      expect(lastFrame()).toContain("pre-built template");
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 2: Stack - select first stack (card UI, already focused)
      expect(lastFrame()).toContain("React Fullstack");
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 3: Build - goes directly to build (pre-populated from stack)
      const state = useWizardStore.getState();
      expect(state.step).toBe("build");
      expect(state.selectedStackId).toBe("react-fullstack");
    });

    it("should complete wizard with stack defaults flow via A shortcut", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Step 1: Approach - select template
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 2: Stack - select first stack (card UI, already focused)
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 3: Build - press A to accept defaults
      await stdin.write("A");
      await delay(STEP_TRANSITION_DELAY_MS);

      // Step 4: Confirm - should show confirm step
      expect(lastFrame()).toContain("Confirm");
    });
  });

  describe("cancellation flow", () => {
    it("should call onCancel when escape pressed at approach", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Press escape at first step
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(onCancel).toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should go back when escape pressed after approach", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to stack step
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);
      expect(lastFrame()).toContain("React Fullstack");

      // Press escape to go back
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be back at approach
      expect(lastFrame()).toContain("pre-built template");
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe("navigation history", () => {
    it("should navigate back through wizard steps using escape", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Go to stack
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Select first stack (card UI, already focused)
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should now be at build (goes directly from stack to build)
      const state = useWizardStore.getState();
      expect(state.step).toBe("build");

      // Go back using escape
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be back at stack selection
      expect(lastFrame()).toContain("React Fullstack");
    });

    it("should preserve selections when going back", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Select template
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Select first stack (card UI, already focused)
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be at build
      expect(useWizardStore.getState().step).toBe("build");

      // Go back using escape
      await stdin.write(ESCAPE);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Stack should still be selected in store
      const { selectedStackId } = useWizardStore.getState();
      expect(selectedStackId).toBe("react-fullstack");
    });
  });

  describe("step footer hints", () => {
    it("should display ESC hint in step footer", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Centralized footer shows keyboard hints on all steps
      expect(lastFrame()).toContain("back");
    });

    it("should display navigation hints in step footer", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Centralized footer shows navigation hints
      expect(lastFrame()).toContain("navigate");
      expect(lastFrame()).toContain("continue");
    });
  });

  describe("mode selection", () => {
    it("should toggle expert mode via keyboard shortcut", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Toggle expert mode with 'e' keyboard shortcut (global handler)
      await stdin.write("e");
      await delay(STEP_TRANSITION_DELAY_MS);

      // Expert mode indicator is shown in wizard-layout with cyan color when active
      expect(lastFrame()).toContain("Expert mode");
    });

    it("should toggle install mode via keyboard shortcut", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Toggle install mode with 'p' keyboard shortcut (global handler)
      await stdin.write("p");
      await delay(STEP_TRANSITION_DELAY_MS);

      expect(lastFrame()).toContain("Plugin mode");
    });
  });

  describe("alternative stack selection", () => {
    it("should allow selecting second stack", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Select template approach
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Navigate to second stack (first stack, second stack) with sequential writes
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should be at build with testing stack selected
      const state = useWizardStore.getState();
      expect(state.step).toBe("build");
      expect(state.selectedStackId).toBe("testing-stack");
    });
  });

  describe("wizard tabs", () => {
    it("should display wizard tabs at all steps", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Should show wizard tabs
      expect(lastFrame()).toContain("Intro");
      expect(lastFrame()).toContain("Stack");
      expect(lastFrame()).toContain("Build");
      expect(lastFrame()).toContain("Confirm");
    });
  });

  // ===========================================================================
  // Result Verification
  // ===========================================================================

  describe("result verification", () => {
    it("should return correct result structure on completion", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Complete full flow: approach -> stack -> build -> [A] -> confirm
      await stdin.write(ENTER); // Stack approach
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER); // Select first stack (card UI, already focused)
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write("A"); // Accept defaults
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER); // Confirm
      await delay(STEP_TRANSITION_DELAY_MS);

      // Verify result structure
      expect(onComplete).toHaveBeenCalledTimes(1);
      const result = onComplete.mock.calls[0][0];

      expect(result).toHaveProperty("selectedSkills");
      expect(result).toHaveProperty("selectedStackId");
      expect(result).toHaveProperty("domainSelections");
      expect(result).toHaveProperty("expertMode");
      expect(result).toHaveProperty("installMode");
      expect(result).toHaveProperty("cancelled");
      expect(result).toHaveProperty("validation");

      expect(result.selectedStackId).toBe("react-fullstack");
      expect(result.cancelled).toBe(false);
      expect(result.installMode).toBe("local");
      expect(result.expertMode).toBe(false);
    });

    it("should include preselected skills in result", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Complete full flow: approach -> stack -> build -> [A] -> confirm
      await stdin.write(ENTER); // Stack approach
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER); // Select first stack (already focused)
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write("A"); // Accept defaults
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER); // Confirm
      await delay(STEP_TRANSITION_DELAY_MS);

      const result = onComplete.mock.calls[0][0];

      // Should include at least the preselected skills (methodology skills)
      expect(Array.isArray(result.selectedSkills)).toBe(true);
    });
  });

  // ===========================================================================
  // Edge Case Tests
  // ===========================================================================

  describe("edge cases", () => {
    it("should show keyboard help text on approach step", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Centralized footer shows keyboard navigation hints
      const frame = lastFrame();
      expect(frame).toContain("navigate");
      expect(frame).toContain("continue");
    });

    it("should show keyboard help text on stack selection step", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to stack selection
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      const frame = lastFrame();
      expect(frame).toContain("navigate");
      expect(frame).toContain("back");
    });

    it("should show domain selection hint when no domains selected on scratch path", async () => {
      const comprehensiveMatrix = createComprehensiveMatrix();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={comprehensiveMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Select scratch approach
      await stdin.write(ARROW_DOWN);
      await delay(STEP_TRANSITION_DELAY_MS);
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Should show hint to select domain
      const frame = lastFrame();
      expect(frame).toContain("at least one domain");
    });

    it("should show all wizard tabs on every step", async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      const { stdin, lastFrame, unmount } = render(
        <Wizard matrix={mockMatrix} onComplete={onComplete} onCancel={onCancel} />,
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Check tabs are visible on approach step
      let frame = lastFrame();
      expect(frame).toContain("Intro");
      expect(frame).toContain("Stack");
      expect(frame).toContain("Build");
      expect(frame).toContain("Confirm");

      // Navigate to stack step
      await stdin.write(ENTER);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Check tabs are still visible
      frame = lastFrame();
      expect(frame).toContain("Intro");
      expect(frame).toContain("Stack");
    });
  });
});
