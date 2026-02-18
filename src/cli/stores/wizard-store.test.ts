import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useWizardStore } from "./wizard-store";
import { DEFAULT_PRESELECTED_SKILLS } from "../consts";
import { createMockSkill, createMockMatrix } from "../lib/__tests__/helpers";
import { typedKeys } from "../utils/typed-object";
import type {
  AgentName,
  Domain,
  SkillAssignment,
  SkillDisplayName,
  SkillId,
  SkillSource,
  Subcategory,
} from "../types";

function sa(id: SkillId, preloaded = false): SkillAssignment {
  return { id, preloaded };
}

describe("WizardStore", () => {
  beforeEach(() => {
    useWizardStore.getState().reset();
  });

  describe("initial state", () => {
    it("should start at stack step", () => {
      const { step } = useWizardStore.getState();
      expect(step).toBe("stack");
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

      store.setStep("build");
      store.setStep("confirm");

      const { history } = useWizardStore.getState();
      expect(history).toEqual(["stack", "build"]);
    });

    it("should go back through history", () => {
      const store = useWizardStore.getState();

      store.setStep("build");
      store.setStep("confirm");
      store.goBack();

      const { step, history } = useWizardStore.getState();
      expect(step).toBe("build");
      expect(history).toEqual(["stack"]);
    });

    it("when goBack is called with empty history, should return to stack step", () => {
      const store = useWizardStore.getState();

      store.setStep("build");
      store.goBack();
      store.goBack();

      const { step } = useWizardStore.getState();
      expect(step).toBe("stack");
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

    it("when selectStack is called with null, should clear previously selected stack", () => {
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

    it("when already at the last domain, should return false from nextDomain", () => {
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

    it("when already at the first domain, should return false from prevDomain", () => {
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

    it("should toggle show labels", () => {
      const store = useWizardStore.getState();

      store.toggleShowLabels();

      const { showLabels } = useWizardStore.getState();
      expect(showLabels).toBe(true);
    });

    it("should toggle help on", () => {
      const store = useWizardStore.getState();

      store.toggleHelp();

      const { showHelp } = useWizardStore.getState();
      expect(showHelp).toBe(true);
    });

    it("should toggle help off (show then hide)", () => {
      const store = useWizardStore.getState();

      store.toggleHelp();
      store.toggleHelp();

      const { showHelp } = useWizardStore.getState();
      expect(showHelp).toBe(false);
    });

    it("should toggle settings on", () => {
      const store = useWizardStore.getState();

      store.toggleSettings();

      const { showSettings } = useWizardStore.getState();
      expect(showSettings).toBe(true);
    });

    it("should toggle settings off (show then hide)", () => {
      const store = useWizardStore.getState();

      store.toggleSettings();
      store.toggleSettings();

      const { showSettings } = useWizardStore.getState();
      expect(showSettings).toBe(false);
    });

    it("should start with showHelp false", () => {
      const { showHelp } = useWizardStore.getState();
      expect(showHelp).toBe(false);
    });

    it("should start with showSettings false", () => {
      const { showSettings } = useWizardStore.getState();
      expect(showSettings).toBe(false);
    });

    it("should reset showHelp to false after reset", () => {
      const store = useWizardStore.getState();
      store.toggleHelp();
      store.reset();

      const { showHelp } = useWizardStore.getState();
      expect(showHelp).toBe(false);
    });

    it("should reset showSettings to false after reset", () => {
      const store = useWizardStore.getState();
      store.toggleSettings();
      store.reset();

      const { showSettings } = useWizardStore.getState();
      expect(showSettings).toBe(false);
    });
  });

  describe("install mode auto-defaulting", () => {
    it("should default installMode to plugin when set via setState (marketplace available)", () => {
      // Simulates what Wizard component does when initialInstallMode="plugin"
      useWizardStore.setState({ installMode: "plugin" });

      const { installMode } = useWizardStore.getState();
      expect(installMode).toBe("plugin");
    });

    it("should keep installMode as local when set via setState (no marketplace)", () => {
      // Simulates what Wizard component does when initialInstallMode="local"
      useWizardStore.setState({ installMode: "local" });

      const { installMode } = useWizardStore.getState();
      expect(installMode).toBe("local");
    });

    it("should allow toggling installMode after auto-defaulting to plugin", () => {
      // Simulates: marketplace sets plugin, then user presses P to switch back
      useWizardStore.setState({ installMode: "plugin" });
      useWizardStore.getState().toggleInstallMode();

      const { installMode } = useWizardStore.getState();
      expect(installMode).toBe("local");
    });

    it("should reset installMode to local after reset even if previously set to plugin", () => {
      useWizardStore.setState({ installMode: "plugin" });
      useWizardStore.getState().reset();

      const { installMode } = useWizardStore.getState();
      expect(installMode).toBe("local");
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

    it("should get default methodology skills", () => {
      const store = useWizardStore.getState();

      const skills = store.getDefaultMethodologySkills();

      for (const skill of DEFAULT_PRESELECTED_SKILLS) {
        expect(skills).toContain(skill);
      }
    });

    it("should get selected technologies per domain", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "framework", "web-framework-react", true);
      store.toggleTechnology("web", "styling", "web-styling-scss-modules", true);
      store.toggleTechnology("api", "api", "api-framework-hono", true);

      const perDomain = store.getSelectedTechnologiesPerDomain();
      expect(perDomain.web).toEqual(["web-framework-react", "web-styling-scss-modules"]);
      expect(perDomain.api).toEqual(["api-framework-hono"]);
      expect(perDomain.cli).toBeUndefined();
    });

    it("should return empty object for getSelectedTechnologiesPerDomain with no selections", () => {
      const store = useWizardStore.getState();
      const perDomain = store.getSelectedTechnologiesPerDomain();
      expect(perDomain).toEqual({});
    });

    it("should omit domains with empty subcategory arrays from getSelectedTechnologiesPerDomain", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "framework", "web-framework-react", true);
      store.toggleTechnology("web", "framework", "web-framework-react", true); // toggle off

      const perDomain = store.getSelectedTechnologiesPerDomain();
      expect(perDomain.web).toBeUndefined();
    });

    it("should get technology count", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "framework", "web-framework-react", true);
      store.toggleTechnology("web", "styling", "web-styling-scss-modules", true);
      store.toggleTechnology("api", "api", "api-framework-hono", true);

      expect(store.getTechnologyCount()).toBe(3);
    });

    it("should return 0 for getTechnologyCount with no selections", () => {
      const store = useWizardStore.getState();
      expect(store.getTechnologyCount()).toBe(0);
    });
  });

  describe("navigation guards", () => {
    it("canGoToNextDomain should return true when not at last domain", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleDomain("api");

      expect(store.canGoToNextDomain()).toBe(true);
    });

    it("canGoToNextDomain should return false when at last domain", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");

      expect(store.canGoToNextDomain()).toBe(false);
    });

    it("canGoToNextDomain should return false with no domains", () => {
      const store = useWizardStore.getState();
      expect(store.canGoToNextDomain()).toBe(false);
    });

    it("canGoToPreviousDomain should return false when at first domain", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleDomain("api");

      expect(store.canGoToPreviousDomain()).toBe(false);
    });

    it("canGoToPreviousDomain should return true when past first domain", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleDomain("api");
      store.nextDomain();

      expect(store.canGoToPreviousDomain()).toBe(true);
    });

    it("canGoToPreviousDomain should return false with no domains", () => {
      const store = useWizardStore.getState();
      expect(store.canGoToPreviousDomain()).toBe(false);
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
      expect(state.step).toBe("stack");
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

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          web: { framework: [sa("web-framework-react", true)] },
        },
      };
      const categories: Partial<Record<Subcategory, { domain?: Domain }>> = {
        framework: { domain: "web" },
      };

      store.populateFromStack(stack, categories);

      const { selectedDomains, domainSelections } = useWizardStore.getState();

      expect(selectedDomains).toEqual(["web", "api", "cli", "mobile", "shared"]);

      expect(domainSelections.web).toBeDefined();
      expect(domainSelections.web!.framework).toEqual(["web-framework-react"]);
      expect(domainSelections.api).toBeUndefined();
    });

    it("should populate domainSelections from stack agents", () => {
      const store = useWizardStore.getState();

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          web: {
            framework: [sa("web-framework-react", true)],
            "client-state": [sa("web-state-zustand")],
          },
          api: { api: [sa("api-framework-hono", true)] },
        },
      };
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

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          misc: { methodology: [sa("meta-methodology-vitest" as SkillId)] },
        },
      };
      const categories: Partial<Record<Subcategory, { domain?: Domain }>> = {
        methodology: {},
      };

      store.populateFromStack(stack, categories);

      const { domainSelections } = useWizardStore.getState();

      expect(typedKeys(domainSelections)).toHaveLength(0);
    });

    it("should populate multiple skills from array-valued subcategories", () => {
      const store = useWizardStore.getState();

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          "pattern-scout": {
            methodology: [
              sa("meta-methodology-investigation-requirements", true),
              sa("meta-methodology-anti-over-engineering", true),
              sa("meta-methodology-success-criteria", true),
            ],
          },
        },
      };
      const categories: Partial<Record<Subcategory, { domain?: Domain }>> = {
        methodology: { domain: "shared" },
      };

      store.populateFromStack(stack, categories);

      const { domainSelections } = useWizardStore.getState();

      expect(domainSelections.shared!.methodology).toEqual([
        "meta-methodology-investigation-requirements",
        "meta-methodology-anti-over-engineering",
        "meta-methodology-success-criteria",
      ]);
    });

    it("should handle single-element and multi-element arrays across agents", () => {
      const store = useWizardStore.getState();

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          web: {
            framework: [sa("web-framework-react", true)],
            methodology: [
              sa("meta-methodology-investigation-requirements", true),
              sa("meta-methodology-anti-over-engineering", true),
            ],
          },
          api: { api: [sa("api-framework-hono", true)] },
        },
      };
      const categories: Partial<Record<Subcategory, { domain?: Domain }>> = {
        framework: { domain: "web" },
        methodology: { domain: "shared" },
        api: { domain: "api" },
      };

      store.populateFromStack(stack, categories);

      const { domainSelections } = useWizardStore.getState();

      expect(domainSelections.web!.framework).toEqual(["web-framework-react"]);
      expect(domainSelections.shared!.methodology).toEqual([
        "meta-methodology-investigation-requirements",
        "meta-methodology-anti-over-engineering",
      ]);
      expect(domainSelections.api!.api).toEqual(["api-framework-hono"]);
    });

    it("should deduplicate skills from arrays across multiple agents", () => {
      const store = useWizardStore.getState();

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          agent1: {
            methodology: [
              sa("meta-methodology-investigation-requirements", true),
              sa("meta-methodology-anti-over-engineering", true),
            ],
          },
          agent2: {
            methodology: [
              sa("meta-methodology-anti-over-engineering", true),
              sa("meta-methodology-success-criteria", true),
            ],
          },
        },
      };
      const categories: Partial<Record<Subcategory, { domain?: Domain }>> = {
        methodology: { domain: "shared" },
      };

      store.populateFromStack(stack, categories);

      const { domainSelections } = useWizardStore.getState();

      // Should deduplicate: anti-over-engineering appears in both agents
      expect(domainSelections.shared!.methodology).toEqual([
        "meta-methodology-investigation-requirements",
        "meta-methodology-anti-over-engineering",
        "meta-methodology-success-criteria",
      ]);
    });
  });

  describe("complex flows", () => {
    it("should handle complete stack selection flow", () => {
      const store = useWizardStore.getState();

      store.setApproach("stack");
      store.selectStack("nextjs-fullstack");
      store.setStackAction("customize");
      store.setStep("build");

      store.setStep("confirm");

      const state = useWizardStore.getState();
      expect(state.step).toBe("confirm");
      expect(state.approach).toBe("stack");
      expect(state.selectedStackId).toBe("nextjs-fullstack");
      expect(state.stackAction).toBe("customize");
      expect(state.history).toEqual(["stack", "build"]);
    });

    it("should handle complete scratch flow", () => {
      const store = useWizardStore.getState();

      store.setApproach("scratch");
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
      store.toggleDomain("web");
      store.setStep("build");
      store.toggleTechnology("web", "framework", "web-framework-react", true);

      store.goBack();

      const state = useWizardStore.getState();
      expect(state.selectedDomains).toContain("web");
      expect(state.domainSelections.web!.framework).toEqual(["web-framework-react"]);
    });
  });

  describe("buildSourceRows sort order", () => {
    function makeSource(overrides: Partial<SkillSource> & { name: string }): SkillSource {
      return {
        type: "private",
        installed: false,
        ...overrides,
      };
    }

    it("should sort local sources before scoped marketplace sources", () => {
      const store = useWizardStore.getState();

      const skill = createMockSkill("web-framework-react" as SkillId, "framework", {
        displayName: "react" as SkillDisplayName,
        availableSources: [
          makeSource({ name: "Photoroom", type: "private", primary: true }),
          makeSource({ name: "local", type: "local", installed: true, installMode: "local" }),
        ],
      });

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          displayNames: { "web-framework-react": "react" } as Partial<
            Record<SkillId, SkillDisplayName>
          >,
        },
      );

      store.toggleTechnology("web", "framework", "web-framework-react" as SkillId, true);

      const rows = store.buildSourceRows(matrix);
      expect(rows).toHaveLength(1);
      expect(rows[0].options[0].id).toBe("local");
      expect(rows[0].options[1].id).toBe("Photoroom");
    });

    it("should sort scoped marketplace before default public marketplace", () => {
      const store = useWizardStore.getState();

      const skill = createMockSkill("web-framework-react" as SkillId, "framework", {
        displayName: "react" as SkillDisplayName,
        availableSources: [
          makeSource({ name: "Agents Inc", type: "public" }),
          makeSource({ name: "Photoroom", type: "private", primary: true }),
        ],
      });

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          displayNames: { "web-framework-react": "react" } as Partial<
            Record<SkillId, SkillDisplayName>
          >,
        },
      );

      store.toggleTechnology("web", "framework", "web-framework-react" as SkillId, true);

      const rows = store.buildSourceRows(matrix);
      expect(rows).toHaveLength(1);
      expect(rows[0].options[0].id).toBe("Photoroom");
      expect(rows[0].options[1].id).toBe("Agents Inc");
    });

    it("should sort default public marketplace before third-party sources", () => {
      const store = useWizardStore.getState();

      const skill = createMockSkill("web-framework-react" as SkillId, "framework", {
        displayName: "react" as SkillDisplayName,
        availableSources: [
          makeSource({ name: "Extra Corp", type: "private" }),
          makeSource({ name: "Agents Inc", type: "public" }),
        ],
      });

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          displayNames: { "web-framework-react": "react" } as Partial<
            Record<SkillId, SkillDisplayName>
          >,
        },
      );

      store.toggleTechnology("web", "framework", "web-framework-react" as SkillId, true);

      const rows = store.buildSourceRows(matrix);
      expect(rows).toHaveLength(1);
      expect(rows[0].options[0].id).toBe("Agents Inc");
      expect(rows[0].options[1].id).toBe("Extra Corp");
    });

    it("should sort all four tiers in correct order", () => {
      const store = useWizardStore.getState();

      const skill = createMockSkill("web-framework-react" as SkillId, "framework", {
        displayName: "react" as SkillDisplayName,
        availableSources: [
          makeSource({ name: "Extra Corp", type: "private" }),
          makeSource({ name: "Agents Inc", type: "public" }),
          makeSource({ name: "Photoroom", type: "private", primary: true }),
          makeSource({ name: "local", type: "local", installed: true, installMode: "local" }),
        ],
      });

      const matrix = createMockMatrix(
        { "web-framework-react": skill },
        {
          displayNames: { "web-framework-react": "react" } as Partial<
            Record<SkillId, SkillDisplayName>
          >,
        },
      );

      store.toggleTechnology("web", "framework", "web-framework-react" as SkillId, true);

      const rows = store.buildSourceRows(matrix);
      expect(rows).toHaveLength(1);

      const sourceNames = rows[0].options.map((opt) => opt.id);
      expect(sourceNames).toEqual(["local", "Photoroom", "Agents Inc", "Extra Corp"]);
    });
  });

  describe("agent selection", () => {
    it("should start with empty selectedAgents", () => {
      const { selectedAgents } = useWizardStore.getState();
      expect(selectedAgents).toEqual([]);
    });

    it("should toggle agent on", () => {
      const store = useWizardStore.getState();
      store.toggleAgent("web-developer");

      const { selectedAgents } = useWizardStore.getState();
      expect(selectedAgents).toContain("web-developer");
    });

    it("should toggle agent off", () => {
      const store = useWizardStore.getState();
      store.toggleAgent("web-developer");
      store.toggleAgent("web-developer");

      const { selectedAgents } = useWizardStore.getState();
      expect(selectedAgents).not.toContain("web-developer");
    });

    it("should allow multiple agents to be selected", () => {
      const store = useWizardStore.getState();
      store.toggleAgent("web-developer");
      store.toggleAgent("api-developer");
      store.toggleAgent("web-reviewer");

      const { selectedAgents } = useWizardStore.getState();
      expect(selectedAgents).toEqual(["web-developer", "api-developer", "web-reviewer"]);
    });

    it("should reset selectedAgents on reset", () => {
      const store = useWizardStore.getState();
      store.toggleAgent("web-developer");
      store.reset();

      const { selectedAgents } = useWizardStore.getState();
      expect(selectedAgents).toEqual([]);
    });
  });

  describe("preselectAgentsFromDomains", () => {
    it("should preselect web-related agents when web domain is selected", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.preselectAgentsFromDomains();

      const { selectedAgents } = useWizardStore.getState();
      expect(selectedAgents).toContain("web-developer");
      expect(selectedAgents).toContain("web-reviewer");
      expect(selectedAgents).toContain("web-researcher");
      expect(selectedAgents).toContain("web-tester");
      expect(selectedAgents).toContain("web-pm");
      expect(selectedAgents).toContain("web-architecture");
    });

    it("should preselect api-related agents when api domain is selected", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("api");
      store.preselectAgentsFromDomains();

      const { selectedAgents } = useWizardStore.getState();
      expect(selectedAgents).toContain("api-developer");
      expect(selectedAgents).toContain("api-reviewer");
      expect(selectedAgents).toContain("api-researcher");
      expect(selectedAgents).not.toContain("web-developer");
    });

    it("should preselect cli agents when cli domain is selected", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("cli");
      store.preselectAgentsFromDomains();

      const { selectedAgents } = useWizardStore.getState();
      expect(selectedAgents).toContain("cli-developer");
      expect(selectedAgents).toContain("cli-tester");
      expect(selectedAgents).toContain("cli-reviewer");
      expect(selectedAgents).toContain("cli-migrator");
    });

    it("should never include optional agents regardless of domains", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleDomain("api");
      store.toggleDomain("cli");
      store.preselectAgentsFromDomains();

      const { selectedAgents } = useWizardStore.getState();
      expect(selectedAgents).not.toContain("agent-summoner");
      expect(selectedAgents).not.toContain("skill-summoner");
      expect(selectedAgents).not.toContain("documentor");
      expect(selectedAgents).not.toContain("pattern-scout");
      expect(selectedAgents).not.toContain("web-pattern-critique");
    });

    it("should return empty agents when no domains are selected", () => {
      const store = useWizardStore.getState();
      store.preselectAgentsFromDomains();

      const { selectedAgents } = useWizardStore.getState();
      expect(selectedAgents).toEqual([]);
    });

    it("should produce union of agents for multiple domains", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleDomain("api");
      store.preselectAgentsFromDomains();

      const { selectedAgents } = useWizardStore.getState();
      expect(selectedAgents).toContain("web-developer");
      expect(selectedAgents).toContain("api-developer");
      expect(selectedAgents).toContain("web-reviewer");
      expect(selectedAgents).toContain("api-reviewer");
    });

    it("should not preselect api agents when only web domain is selected", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.preselectAgentsFromDomains();

      const { selectedAgents } = useWizardStore.getState();
      expect(selectedAgents).toContain("web-developer");
      expect(selectedAgents).not.toContain("api-developer");
      expect(selectedAgents).not.toContain("api-reviewer");
    });

    it("should return sorted agents", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleDomain("api");
      store.preselectAgentsFromDomains();

      const { selectedAgents } = useWizardStore.getState();
      const sorted = [...selectedAgents].sort();
      expect(selectedAgents).toEqual(sorted);
    });

    it("should replace previous agent selection", () => {
      const store = useWizardStore.getState();
      store.toggleAgent("documentor");
      store.toggleDomain("web");
      store.preselectAgentsFromDomains();

      const { selectedAgents } = useWizardStore.getState();
      // preselectAgentsFromDomains replaces the array entirely
      expect(selectedAgents).not.toContain("documentor");
    });
  });

  describe("step progress with agents step", () => {
    it("should include agents in completed steps when on confirm", () => {
      const store = useWizardStore.getState();
      store.setApproach("scratch");
      store.setStep("build");
      store.setStep("sources");
      store.setStep("agents");
      store.setStep("confirm");

      const { completedSteps } = store.getStepProgress();
      expect(completedSteps).toContain("agents");
      expect(completedSteps).toContain("sources");
      expect(completedSteps).toContain("build");
    });

    it("should include sources in completed steps when on agents step", () => {
      const store = useWizardStore.getState();
      store.setApproach("scratch");
      store.setStep("build");
      store.setStep("sources");
      store.setStep("agents");

      const { completedSteps } = store.getStepProgress();
      expect(completedSteps).toContain("build");
      expect(completedSteps).toContain("sources");
      expect(completedSteps).not.toContain("agents");
    });

    it("should skip agents step when using stack defaults", () => {
      const store = useWizardStore.getState();
      store.setApproach("stack");
      store.selectStack("nextjs-fullstack");
      store.setStackAction("defaults");
      store.setStep("confirm");

      const { skippedSteps } = store.getStepProgress();
      expect(skippedSteps).toContain("agents");
      expect(skippedSteps).toContain("build");
      expect(skippedSteps).toContain("sources");
    });
  });
});
