import { describe, it, expect, beforeEach } from "vitest";
import { useWizardStore } from "./wizard-store";
import { DEFAULT_PRESELECTED_SKILLS } from "../consts";
import type { Domain, Subcategory } from "../types";

describe("WizardStore", () => {
  beforeEach(() => {
    useWizardStore.getState().reset();
  });

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
      store.goBack();

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

  describe("technology selection", () => {
    it("should toggle technology in exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "framework", "web-framework-react", true);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web!.framework).toEqual(["web-framework-react"]);
    });

    it("should replace technology in exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "framework", "web-framework-react", true);
      store.toggleTechnology("web", "framework", "web-framework-vue", true);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web!.framework).toEqual(["web-framework-vue"]);
    });

    it("should toggle off technology in exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "framework", "web-framework-react", true);
      store.toggleTechnology("web", "framework", "web-framework-react", true);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web!.framework).toEqual([]);
    });

    it("should allow multiple selections in non-exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "testing", "web-testing-vitest", false);
      store.toggleTechnology("web", "testing", "web-testing-playwright-e2e", false);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web!.testing).toEqual([
        "web-testing-vitest",
        "web-testing-playwright-e2e",
      ]);
    });

    it("should toggle off technology in non-exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "testing", "web-testing-vitest", false);
      store.toggleTechnology("web", "testing", "web-testing-playwright-e2e", false);
      store.toggleTechnology("web", "testing", "web-testing-vitest", false);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web!.testing).toEqual(["web-testing-playwright-e2e"]);
    });
  });

  describe("domain navigation", () => {
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
      store.nextDomain();

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
      store.nextDomain();

      const domain = store.getCurrentDomain();
      expect(domain).toBe("api");
    });

    it("should return null when no domains selected", () => {
      const store = useWizardStore.getState();
      const domain = store.getCurrentDomain();
      expect(domain).toBeNull();
    });
  });

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

  describe("computed getters", () => {
    it("should get all selected technologies", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "framework", "web-framework-react", true);
      store.toggleTechnology("web", "styling", "web-styling-scss-modules", true);
      store.toggleTechnology("api", "api", "api-framework-hono", true);

      const technologies = store.getAllSelectedTechnologies();
      expect(technologies).toContain("web-framework-react");
      expect(technologies).toContain("web-styling-scss-modules");
      expect(technologies).toContain("api-framework-hono");
    });

    it("should get selected skills including preselected", () => {
      const store = useWizardStore.getState();

      const skills = store.getSelectedSkills();

      for (const skill of DEFAULT_PRESELECTED_SKILLS) {
        expect(skills).toContain(skill);
      }
    });
  });

  describe("reset", () => {
    it("should reset to initial state", () => {
      const store = useWizardStore.getState();

      store.setStep("stack");
      store.setApproach("scratch");
      store.selectStack("nextjs-fullstack");
      store.toggleDomain("web");
      store.toggleExpertMode();

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

  describe("populateFromStack", () => {
    it("should set selectedDomains to all domains regardless of stack contents", () => {
      const store = useWizardStore.getState();

      const stack = {
        agents: {
          web: { framework: "web-framework-react" },
        },
      } as const;
      const categories: Partial<Record<Subcategory, { domain?: Domain }>> = {
        framework: { domain: "web" },
      };

      store.populateFromStack(stack, categories);

      const { selectedDomains, domainSelections } = useWizardStore.getState();

      expect(selectedDomains).toEqual(["web", "web-extras", "api", "cli", "mobile", "shared"]);

      expect(domainSelections.web).toBeDefined();
      expect(domainSelections.web!.framework).toEqual(["web-framework-react"]);
      expect(domainSelections.api).toBeUndefined();
    });

    it("should populate domainSelections from stack agents", () => {
      const store = useWizardStore.getState();

      const stack = {
        agents: {
          web: { framework: "web-framework-react", "client-state": "web-state-zustand" },
          api: { api: "api-framework-hono" },
        },
      } as const;
      const categories: Partial<Record<Subcategory, { domain?: Domain }>> = {
        framework: { domain: "web" },
        "client-state": { domain: "web" },
        api: { domain: "api" },
      };

      store.populateFromStack(stack, categories);

      const { domainSelections } = useWizardStore.getState();

      expect(domainSelections.web!.framework).toEqual(["web-framework-react"]);
      expect(domainSelections.web!["client-state"]).toEqual(["web-state-zustand"]);
      expect(domainSelections.api!.api).toEqual(["api-framework-hono"]);
    });

    it("should skip entries without a domain", () => {
      const store = useWizardStore.getState();

      const stack = {
        agents: {
          misc: { methodology: "meta-methodology-vitest" },
        },
      } as const;
      const categories: Partial<Record<Subcategory, { domain?: Domain }>> = {
        methodology: {},
      };

      store.populateFromStack(stack, categories);

      const { domainSelections } = useWizardStore.getState();

      expect(Object.keys(domainSelections)).toHaveLength(0);
    });
  });

  describe("complex flows", () => {
    it("should handle complete stack selection flow", () => {
      const store = useWizardStore.getState();

      store.setApproach("stack");
      store.setStep("stack");

      store.selectStack("nextjs-fullstack");
      store.setStackAction("customize");
      store.setStep("build");

      store.setStep("confirm");

      const state = useWizardStore.getState();
      expect(state.step).toBe("confirm");
      expect(state.approach).toBe("stack");
      expect(state.selectedStackId).toBe("nextjs-fullstack");
      expect(state.stackAction).toBe("customize");
      expect(state.history).toEqual(["approach", "stack", "build"]);
    });

    it("should handle complete scratch flow", () => {
      const store = useWizardStore.getState();

      store.setApproach("scratch");
      store.setStep("stack");

      store.toggleDomain("web");
      store.toggleDomain("api");
      store.setStep("build");

      store.toggleTechnology("web", "framework", "web-framework-react", true);
      store.toggleTechnology("web", "styling", "web-styling-scss-modules", true);
      store.toggleTechnology("api", "api", "api-framework-hono", true);
      store.setStep("confirm");

      const state = useWizardStore.getState();
      expect(state.step).toBe("confirm");
      expect(state.approach).toBe("scratch");
      expect(state.selectedDomains).toEqual(["web", "api"]);
      expect(state.domainSelections.web!.framework).toEqual(["web-framework-react"]);
      expect(state.domainSelections.web!.styling).toEqual(["web-styling-scss-modules"]);
      expect(state.domainSelections.api!.api).toEqual(["api-framework-hono"]);
    });

    it("should preserve selections when going back", () => {
      const store = useWizardStore.getState();

      store.setApproach("scratch");
      store.setStep("stack");
      store.toggleDomain("web");
      store.setStep("build");
      store.toggleTechnology("web", "framework", "web-framework-react", true);

      store.goBack();
      store.goBack();

      const state = useWizardStore.getState();
      expect(state.selectedDomains).toContain("web");
      expect(state.domainSelections.web!.framework).toEqual(["web-framework-react"]);
    });
  });
});
