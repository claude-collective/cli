/**
 * Unit tests for the wizard store (Zustand state management).
 *
 * Tests state transitions without UI rendering for fast feedback.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useWizardStore } from "./wizard-store";
import { DEFAULT_PRESELECTED_SKILLS } from "../consts";

// =============================================================================
// Tests
// =============================================================================

describe("WizardStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useWizardStore.getState().reset();
  });

  // ===========================================================================
  // Initial State
  // ===========================================================================

  describe("initial state", () => {
    it("should start at approach step", () => {
      const { step } = useWizardStore.getState();
      expect(step).toBe("approach");
    });

    it("should have no approach selected", () => {
      const { approach } = useWizardStore.getState();
      expect(approach).toBeNull();
    });

    it("should have no selected stack", () => {
      const { selectedStackId } = useWizardStore.getState();
      expect(selectedStackId).toBeNull();
    });

    it("should have expert mode off", () => {
      const { expertMode } = useWizardStore.getState();
      expect(expertMode).toBe(false);
    });

    it("should default to local install mode", () => {
      const { installMode } = useWizardStore.getState();
      expect(installMode).toBe("local");
    });

    it("should have empty navigation history", () => {
      const { history } = useWizardStore.getState();
      expect(history).toEqual([]);
    });

    it("should have empty selected domains", () => {
      const { selectedDomains } = useWizardStore.getState();
      expect(selectedDomains).toEqual([]);
    });

    it("should have empty domain selections", () => {
      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections).toEqual({});
    });
  });

  // ===========================================================================
  // Step Navigation
  // ===========================================================================

  describe("step navigation", () => {
    it("should update step with setStep", () => {
      const store = useWizardStore.getState();
      store.setStep("stack");

      const { step } = useWizardStore.getState();
      expect(step).toBe("stack");
    });

    it("should track navigation history when setting step", () => {
      const store = useWizardStore.getState();

      store.setStep("stack");
      store.setStep("confirm");

      const { history } = useWizardStore.getState();
      expect(history).toEqual(["approach", "stack"]);
    });

    it("should go back through history", () => {
      const store = useWizardStore.getState();

      store.setStep("stack");
      store.setStep("confirm");
      store.goBack();

      const { step, history } = useWizardStore.getState();
      expect(step).toBe("stack");
      expect(history).toEqual(["approach"]);
    });

    it("should return to approach when history is empty", () => {
      const store = useWizardStore.getState();

      store.setStep("stack");
      store.goBack();
      store.goBack(); // Extra goBack when already at approach

      const { step } = useWizardStore.getState();
      expect(step).toBe("approach");
    });

    it("should reset focus when changing steps", () => {
      const store = useWizardStore.getState();
      store.setFocus(2, 3);
      store.setStep("stack");

      const { focusedRow, focusedCol } = useWizardStore.getState();
      expect(focusedRow).toBe(0);
      expect(focusedCol).toBe(0);
    });
  });

  // ===========================================================================
  // Approach Selection
  // ===========================================================================

  describe("approach selection", () => {
    it("should set approach to stack", () => {
      const store = useWizardStore.getState();
      store.setApproach("stack");

      const { approach } = useWizardStore.getState();
      expect(approach).toBe("stack");
    });

    it("should set approach to scratch", () => {
      const store = useWizardStore.getState();
      store.setApproach("scratch");

      const { approach } = useWizardStore.getState();
      expect(approach).toBe("scratch");
    });
  });

  // ===========================================================================
  // Stack Selection
  // ===========================================================================

  describe("stack selection", () => {
    it("should select stack by id", () => {
      const store = useWizardStore.getState();
      store.selectStack("nextjs-fullstack");

      const { selectedStackId } = useWizardStore.getState();
      expect(selectedStackId).toBe("nextjs-fullstack");
    });

    it("should clear stack when null is passed", () => {
      const store = useWizardStore.getState();
      store.selectStack("nextjs-fullstack");
      store.selectStack(null);

      const { selectedStackId } = useWizardStore.getState();
      expect(selectedStackId).toBeNull();
    });
  });

  // ===========================================================================
  // Domain Selection
  // ===========================================================================

  describe("domain selection", () => {
    it("should toggle domain on", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");

      const { selectedDomains } = useWizardStore.getState();
      expect(selectedDomains).toContain("web");
    });

    it("should toggle domain off", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleDomain("web");

      const { selectedDomains } = useWizardStore.getState();
      expect(selectedDomains).not.toContain("web");
    });

    it("should allow multiple domain selection", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleDomain("api");
      store.toggleDomain("cli");

      const { selectedDomains } = useWizardStore.getState();
      expect(selectedDomains).toEqual(["web", "api", "cli"]);
    });
  });

  // ===========================================================================
  // Technology Selection
  // ===========================================================================

  describe("technology selection", () => {
    it("should toggle technology in exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "framework", "react", true);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web.framework).toEqual(["react"]);
    });

    it("should replace technology in exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "framework", "react", true);
      store.toggleTechnology("web", "framework", "vue", true);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web.framework).toEqual(["vue"]);
    });

    it("should toggle off technology in exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "framework", "react", true);
      store.toggleTechnology("web", "framework", "react", true);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web.framework).toEqual([]);
    });

    it("should allow multiple selections in non-exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "testing", "vitest", false);
      store.toggleTechnology("web", "testing", "jest", false);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web.testing).toEqual(["vitest", "jest"]);
    });

    it("should toggle off technology in non-exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "testing", "vitest", false);
      store.toggleTechnology("web", "testing", "jest", false);
      store.toggleTechnology("web", "testing", "vitest", false);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web.testing).toEqual(["jest"]);
    });
  });

  // ===========================================================================
  // Domain Navigation
  // ===========================================================================

  describe("domain navigation", () => {
    it("should set current domain index", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleDomain("api");
      store.setCurrentDomainIndex(1);

      const { currentDomainIndex } = useWizardStore.getState();
      expect(currentDomainIndex).toBe(1);
    });

    it("should reset focus when changing domain index", () => {
      const store = useWizardStore.getState();
      store.setFocus(2, 3);
      store.setCurrentDomainIndex(1);

      const { focusedRow, focusedCol } = useWizardStore.getState();
      expect(focusedRow).toBe(0);
      expect(focusedCol).toBe(0);
    });

    it("should move to next domain", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleDomain("api");

      const result = store.nextDomain();

      const { currentDomainIndex } = useWizardStore.getState();
      expect(result).toBe(true);
      expect(currentDomainIndex).toBe(1);
    });

    it("should return false when at last domain", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");

      const result = store.nextDomain();

      expect(result).toBe(false);
    });

    it("should move to previous domain", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleDomain("api");
      store.setCurrentDomainIndex(1);

      const result = store.prevDomain();

      const { currentDomainIndex } = useWizardStore.getState();
      expect(result).toBe(true);
      expect(currentDomainIndex).toBe(0);
    });

    it("should return false when at first domain", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");

      const result = store.prevDomain();

      expect(result).toBe(false);
    });

    it("should get current domain", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleDomain("api");
      store.setCurrentDomainIndex(1);

      const domain = store.getCurrentDomain();
      expect(domain).toBe("api");
    });

    it("should return null when no domains selected", () => {
      const store = useWizardStore.getState();
      const domain = store.getCurrentDomain();
      expect(domain).toBeNull();
    });
  });

  // ===========================================================================
  // Mode Toggles
  // ===========================================================================

  describe("mode toggles", () => {
    it("should toggle expert mode on", () => {
      const store = useWizardStore.getState();

      store.toggleExpertMode();

      const { expertMode } = useWizardStore.getState();
      expect(expertMode).toBe(true);
    });

    it("should toggle expert mode off", () => {
      const store = useWizardStore.getState();

      store.toggleExpertMode();
      store.toggleExpertMode();

      const { expertMode } = useWizardStore.getState();
      expect(expertMode).toBe(false);
    });

    it("should toggle install mode to plugin", () => {
      const store = useWizardStore.getState();

      store.toggleInstallMode();

      const { installMode } = useWizardStore.getState();
      expect(installMode).toBe("plugin");
    });

    it("should toggle install mode back to local", () => {
      const store = useWizardStore.getState();

      store.toggleInstallMode();
      store.toggleInstallMode();

      const { installMode } = useWizardStore.getState();
      expect(installMode).toBe("local");
    });

    it("should toggle show descriptions", () => {
      const store = useWizardStore.getState();

      store.toggleShowDescriptions();

      const { showDescriptions } = useWizardStore.getState();
      expect(showDescriptions).toBe(true);
    });
  });

  // ===========================================================================
  // Refine Step
  // ===========================================================================

  describe("refine step", () => {
    it("should set refine action", () => {
      const store = useWizardStore.getState();
      store.setRefineAction("all-recommended");

      const { refineAction } = useWizardStore.getState();
      expect(refineAction).toBe("all-recommended");
    });

    it("should set skill source", () => {
      const store = useWizardStore.getState();
      store.setSkillSource("react", "react (@vince)");

      const { skillSources } = useWizardStore.getState();
      expect(skillSources.react).toBe("react (@vince)");
    });

    it("should set current refine index", () => {
      const store = useWizardStore.getState();
      store.setCurrentRefineIndex(3);

      const { currentRefineIndex } = useWizardStore.getState();
      expect(currentRefineIndex).toBe(3);
    });
  });

  // ===========================================================================
  // Computed Getters
  // ===========================================================================

  describe("computed getters", () => {
    it("should get all selected technologies", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "framework", "react", true);
      store.toggleTechnology("web", "styling", "scss", true);
      store.toggleTechnology("api", "api-framework", "hono", true);

      const technologies = store.getAllSelectedTechnologies();
      expect(technologies).toContain("react");
      expect(technologies).toContain("scss");
      expect(technologies).toContain("hono");
    });

    it("should get selected skills including preselected", () => {
      const store = useWizardStore.getState();
      store.setSkillSource("react", "react (@vince)");
      store.setSkillSource("scss", "scss-modules (@vince)");

      const skills = store.getSelectedSkills();

      // Should include preselected skills
      for (const skill of DEFAULT_PRESELECTED_SKILLS) {
        expect(skills).toContain(skill);
      }
      // Should include user selected skills
      expect(skills).toContain("react (@vince)");
      expect(skills).toContain("scss-modules (@vince)");
    });
  });

  // ===========================================================================
  // Reset
  // ===========================================================================

  describe("reset", () => {
    it("should reset to initial state", () => {
      const store = useWizardStore.getState();

      // Make some changes
      store.setStep("stack");
      store.setApproach("scratch");
      store.selectStack("nextjs-fullstack");
      store.toggleDomain("web");
      store.toggleExpertMode();

      // Reset
      store.reset();

      const state = useWizardStore.getState();
      expect(state.step).toBe("approach");
      expect(state.approach).toBeNull();
      expect(state.selectedStackId).toBeNull();
      expect(state.selectedDomains).toEqual([]);
      expect(state.expertMode).toBe(false);
      expect(state.installMode).toBe("local");
      expect(state.history).toEqual([]);
    });
  });

  // ===========================================================================
  // populateFromStack
  // ===========================================================================

  describe("populateFromStack", () => {
    it("should set selectedDomains to all domains regardless of stack contents", () => {
      const store = useWizardStore.getState();

      // Stack only has web-domain skills
      const stack = {
        agents: {
          web: { "frontend/framework": "react" },
        },
      };
      const categories: Record<string, { domain?: string }> = {
        "frontend/framework": { domain: "web" },
      };

      store.populateFromStack(stack, categories);

      const { selectedDomains, domainSelections } = useWizardStore.getState();

      // selectedDomains should include ALL domains, not just the stack's
      expect(selectedDomains).toEqual(["web", "api", "cli", "mobile", "shared"]);

      // domainSelections should only contain the stack's actual mappings
      expect(domainSelections.web).toBeDefined();
      expect(domainSelections.web["frontend/framework"]).toEqual(["react"]);
      expect(domainSelections.api).toBeUndefined();
    });

    it("should populate domainSelections from stack agents", () => {
      const store = useWizardStore.getState();

      const stack = {
        agents: {
          web: { "frontend/framework": "react", "frontend/state": "zustand" },
          api: { "backend/framework": "hono" },
        },
      };
      const categories: Record<string, { domain?: string }> = {
        "frontend/framework": { domain: "web" },
        "frontend/state": { domain: "web" },
        "backend/framework": { domain: "api" },
      };

      store.populateFromStack(stack, categories);

      const { domainSelections } = useWizardStore.getState();

      expect(domainSelections.web["frontend/framework"]).toEqual(["react"]);
      expect(domainSelections.web["frontend/state"]).toEqual(["zustand"]);
      expect(domainSelections.api["backend/framework"]).toEqual(["hono"]);
    });

    it("should skip entries without a domain", () => {
      const store = useWizardStore.getState();

      const stack = {
        agents: {
          misc: { "top-level-category": "some-skill" },
        },
      };
      const categories: Record<string, { domain?: string }> = {
        "top-level-category": {}, // No domain
      };

      store.populateFromStack(stack, categories);

      const { domainSelections } = useWizardStore.getState();

      // No domain selections should be created for domain-less categories
      expect(Object.keys(domainSelections)).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Complex Flows
  // ===========================================================================

  describe("complex flows", () => {
    it("should handle complete stack selection flow", () => {
      const store = useWizardStore.getState();

      // Step 1: Choose stack approach
      store.setApproach("stack");
      store.setStep("stack");

      // Step 2: Select stack and go directly to build
      store.selectStack("nextjs-fullstack");
      store.setStackAction("customize");
      store.setStep("build");

      // Step 3: Continue to refine
      store.setStep("refine");

      // Step 4: Refine
      store.setRefineAction("all-recommended");
      store.setStep("confirm");

      // Verify final state
      const state = useWizardStore.getState();
      expect(state.step).toBe("confirm");
      expect(state.approach).toBe("stack");
      expect(state.selectedStackId).toBe("nextjs-fullstack");
      expect(state.stackAction).toBe("customize");
      expect(state.refineAction).toBe("all-recommended");
      expect(state.history).toEqual(["approach", "stack", "build", "refine"]);
    });

    it("should handle complete scratch flow", () => {
      const store = useWizardStore.getState();

      // Step 1: Choose scratch approach
      store.setApproach("scratch");
      store.setStep("stack"); // Domain selection

      // Step 2: Select domains
      store.toggleDomain("web");
      store.toggleDomain("api");
      store.setStep("build");

      // Step 3: Select technologies
      store.toggleTechnology("web", "framework", "react", true);
      store.toggleTechnology("web", "styling", "scss", true);
      store.toggleTechnology("api", "api-framework", "hono", true);
      store.setStep("refine");

      // Step 4: Refine
      store.setRefineAction("all-recommended");
      store.setStep("confirm");

      // Verify final state
      const state = useWizardStore.getState();
      expect(state.step).toBe("confirm");
      expect(state.approach).toBe("scratch");
      expect(state.selectedDomains).toEqual(["web", "api"]);
      expect(state.domainSelections.web.framework).toEqual(["react"]);
      expect(state.domainSelections.web.styling).toEqual(["scss"]);
      expect(state.domainSelections.api["api-framework"]).toEqual(["hono"]);
    });

    it("should preserve selections when going back", () => {
      const store = useWizardStore.getState();

      // Make selections
      store.setApproach("scratch");
      store.setStep("stack");
      store.toggleDomain("web");
      store.setStep("build");
      store.toggleTechnology("web", "framework", "react", true);

      // Go back
      store.goBack();
      store.goBack();

      // Selections should be preserved
      const state = useWizardStore.getState();
      expect(state.selectedDomains).toContain("web");
      expect(state.domainSelections.web.framework).toEqual(["react"]);
    });
  });
});
