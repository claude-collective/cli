import { describe, it, expect, beforeEach } from "vitest";
import { useWizardStore } from "./wizard-store";
import { initializeMatrix } from "../lib/matrix/matrix-provider";
import { createMockMatrix, SKILLS } from "../lib/__tests__/helpers";
import { typedKeys } from "../utils/typed-object";
import {
  ALL_SKILLS_TEST_CATEGORIES_MATRIX,
  ALL_SKILLS_FULLSTACK_CATEGORIES_MATRIX,
  ALL_SKILLS_WEB_AND_API_MATRIX,
  ALL_SKILLS_WEB_PAIR_CATEGORIES_MATRIX,
  ALL_SKILLS_WEB_FRAMEWORK_MATRIX,
  ALL_SKILLS_METHODOLOGY_MATRIX,
  ALL_SKILLS_METHODOLOGY_BARE_MATRIX,
  ALL_SKILLS_MULTI_DOMAIN_MATRIX,
  REACT_HONO_FRAMEWORK_API_MATRIX,
} from "../lib/__tests__/mock-data/mock-matrices";
import type { AgentName, SkillAssignment, SkillId, SkillSource } from "../types";

function sa(id: SkillId, preloaded = false): SkillAssignment {
  return { id, preloaded };
}

describe("WizardStore", () => {
  beforeEach(() => {
    initializeMatrix(ALL_SKILLS_TEST_CATEGORIES_MATRIX);
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

    it("should have empty skillConfigs", () => {
      const { skillConfigs } = useWizardStore.getState();
      expect(skillConfigs).toEqual([]);
    });

    it("should have null focusedSkillId", () => {
      const { focusedSkillId } = useWizardStore.getState();
      expect(focusedSkillId).toBeNull();
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

    it("should remove skills from deselected domain", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("web", "web-styling", "web-styling-scss-modules", true);

      store.toggleDomain("web");

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web).toBeUndefined();
      expect(store.getAllSelectedTechnologies()).toEqual([]);
      expect(store.getTechnologyCount()).toBe(0);
    });

    it("should not affect skills in other domains when deselecting a domain", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleDomain("api");
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("api", "api-api", "api-framework-hono", true);

      store.toggleDomain("web");

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web).toBeUndefined();
      expect(domainSelections.api!["api-api"]).toEqual(["api-framework-hono"]);
      expect(store.getAllSelectedTechnologies()).toEqual(["api-framework-hono"]);
    });

    it("should not auto-select skills when toggling domain on", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web).toBeUndefined();
      expect(store.getAllSelectedTechnologies()).toEqual([]);
    });

    it("should reflect correct technology count after domain deselection", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleDomain("api");
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("web", "web-styling", "web-styling-scss-modules", true);
      store.toggleTechnology("api", "api-api", "api-framework-hono", true);

      expect(store.getTechnologyCount()).toBe(3);

      store.toggleDomain("web");

      expect(store.getTechnologyCount()).toBe(1);
      expect(store.getAllSelectedTechnologies()).toEqual(["api-framework-hono"]);
    });

    it("should restore stack skills when re-toggling a domain ON after populateFromStack", () => {
      const store = useWizardStore.getState();

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          web: {
            "web-framework": [sa("web-framework-react", true)],
            "web-client-state": [sa("web-state-zustand")],
          },
          api: { "api-api": [sa("api-framework-hono", true)] },
        },
      };
      initializeMatrix(ALL_SKILLS_FULLSTACK_CATEGORIES_MATRIX);

      store.populateFromStack(stack);

      // Deselect web domain (clears its skills)
      store.toggleDomain("web");
      expect(useWizardStore.getState().domainSelections.web).toBeUndefined();

      // Re-select web domain (should restore stack skills)
      store.toggleDomain("web");
      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web!["web-framework"]).toEqual(["web-framework-react"]);
      expect(domainSelections.web!["web-client-state"]).toEqual(["web-state-zustand"]);
    });

    it("should restore stack skills when re-toggling a domain ON after populateFromSkillIds", () => {
      const store = useWizardStore.getState();

      initializeMatrix(REACT_HONO_FRAMEWORK_API_MATRIX);

      store.populateFromSkillIds(["web-framework-react", "api-framework-hono"]);

      // Deselect web domain (clears its skills)
      store.toggleDomain("web");
      expect(useWizardStore.getState().domainSelections.web).toBeUndefined();

      // Re-select web domain (should restore stack skills)
      store.toggleDomain("web");
      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web!["web-framework"]).toEqual(["web-framework-react"]);
    });

    it("should not restore skills when no stack was populated", () => {
      const store = useWizardStore.getState();

      // Manually toggle domain and add skills (no stack)
      store.toggleDomain("web");
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      // Deselect web domain
      store.toggleDomain("web");

      // Re-select web domain — no stack snapshot, so no restoration
      store.toggleDomain("web");
      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web).toBeUndefined();
      expect(store.getAllSelectedTechnologies()).toEqual([]);
    });

    it("should not affect other domains when restoring stack skills for one domain", () => {
      const store = useWizardStore.getState();

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          web: { "web-framework": [sa("web-framework-react", true)] },
          api: { "api-api": [sa("api-framework-hono", true)] },
        },
      };
      initializeMatrix(ALL_SKILLS_WEB_AND_API_MATRIX);

      store.populateFromStack(stack);

      // Manually change api skills
      store.toggleTechnology("api", "api-api", "api-framework-hono", true); // deselect
      store.toggleTechnology("api", "api-api", "api-framework-express", true); // select new

      // Toggle web off then on
      store.toggleDomain("web");
      store.toggleDomain("web");

      // Web should be restored from stack, api should keep manual changes
      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web!["web-framework"]).toEqual(["web-framework-react"]);
      expect(domainSelections.api!["api-api"]).toEqual(["api-framework-express"]);
    });
  });

  describe("technology selection", () => {
    it("should toggle technology in exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web!["web-framework"]).toEqual(["web-framework-react"]);
    });

    it("should replace technology in exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("web", "web-framework", "web-framework-vue-composition-api", true);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web!["web-framework"]).toEqual(["web-framework-vue-composition-api"]);
    });

    it("should toggle off technology in exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web!["web-framework"]).toEqual([]);
    });

    it("should allow multiple selections in non-exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-testing", "web-testing-vitest", false);
      store.toggleTechnology("web", "web-testing", "web-testing-playwright-e2e", false);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web!["web-testing"]).toEqual([
        "web-testing-vitest",
        "web-testing-playwright-e2e",
      ]);
    });

    it("should toggle off technology in non-exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-testing", "web-testing-vitest", false);
      store.toggleTechnology("web", "web-testing", "web-testing-playwright-e2e", false);
      store.toggleTechnology("web", "web-testing", "web-testing-vitest", false);

      const { domainSelections } = useWizardStore.getState();
      expect(domainSelections.web!["web-testing"]).toEqual(["web-testing-playwright-e2e"]);
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

  describe("skillConfigs and per-skill scope", () => {
    it("should sync skillConfigs when toggling a technology on", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      const { skillConfigs } = useWizardStore.getState();
      expect(skillConfigs).toHaveLength(1);
      expect(skillConfigs[0]).toEqual({
        id: "web-framework-react",
        scope: "global",
        source: "agents-inc",
      });
    });

    it("should remove from skillConfigs when toggling a technology off", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      const { skillConfigs } = useWizardStore.getState();
      expect(skillConfigs).toHaveLength(0);
    });

    it("should replace skillConfigs entry in exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("web", "web-framework", "web-framework-vue-composition-api", true);

      const { skillConfigs } = useWizardStore.getState();
      expect(skillConfigs).toHaveLength(1);
      expect(skillConfigs[0].id).toBe("web-framework-vue-composition-api");
    });

    it("should accumulate skillConfigs in non-exclusive mode", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-testing", "web-testing-vitest", false);
      store.toggleTechnology("web", "web-testing", "web-testing-playwright-e2e", false);

      const { skillConfigs } = useWizardStore.getState();
      expect(skillConfigs).toHaveLength(2);
      expect(skillConfigs.map((sc) => sc.id)).toEqual([
        "web-testing-vitest",
        "web-testing-playwright-e2e",
      ]);
    });

    it("should toggle skill scope between global and project", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      store.toggleSkillScope("web-framework-react");

      const { skillConfigs } = useWizardStore.getState();
      expect(skillConfigs[0].scope).toBe("project");
    });

    it("should toggle skill scope back to global", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      store.toggleSkillScope("web-framework-react");
      store.toggleSkillScope("web-framework-react");

      const { skillConfigs } = useWizardStore.getState();
      expect(skillConfigs[0].scope).toBe("global");
    });

    it("should update source via setSkillSource", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      store.setSkillSource("web-framework-react", "local");

      const { skillConfigs } = useWizardStore.getState();
      expect(skillConfigs[0].source).toBe("local");
    });

    it("should set and clear focusedSkillId", () => {
      const store = useWizardStore.getState();

      store.setFocusedSkillId("web-framework-react");
      expect(useWizardStore.getState().focusedSkillId).toBe("web-framework-react");

      store.setFocusedSkillId(null);
      expect(useWizardStore.getState().focusedSkillId).toBeNull();
    });

    it("should update source via setSourceSelection on skillConfigs", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      store.setSourceSelection("web-framework-react", "local");

      const { skillConfigs } = useWizardStore.getState();
      expect(skillConfigs[0].source).toBe("local");
    });

    it("should populate skillConfigs from populateFromStack", () => {
      const store = useWizardStore.getState();

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          web: {
            "web-framework": [sa("web-framework-react", true)],
            "web-client-state": [sa("web-state-zustand")],
          },
        },
      };
      initializeMatrix(ALL_SKILLS_WEB_PAIR_CATEGORIES_MATRIX);

      store.populateFromStack(stack);

      const { skillConfigs } = useWizardStore.getState();
      expect(skillConfigs).toHaveLength(2);
      expect(skillConfigs.map((sc) => sc.id)).toEqual(["web-framework-react", "web-state-zustand"]);
      expect(skillConfigs.every((sc) => sc.scope === "global")).toBe(true);
      expect(skillConfigs.every((sc) => sc.source === "agents-inc")).toBe(true);
    });

    it("should populate skillConfigs from populateFromSkillIds", () => {
      const store = useWizardStore.getState();

      initializeMatrix(REACT_HONO_FRAMEWORK_API_MATRIX);

      store.populateFromSkillIds(["web-framework-react", "api-framework-hono"]);

      const { skillConfigs } = useWizardStore.getState();
      expect(skillConfigs).toHaveLength(2);
      expect(skillConfigs.map((sc) => sc.id)).toEqual([
        "web-framework-react",
        "api-framework-hono",
      ]);
    });

    it("should remove skillConfigs when domain is deselected", () => {
      const store = useWizardStore.getState();
      store.toggleDomain("web");
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      expect(useWizardStore.getState().skillConfigs).toHaveLength(1);

      store.toggleDomain("web");

      expect(useWizardStore.getState().skillConfigs).toHaveLength(0);
    });

    it("should restore skillConfigs when domain is re-toggled after populateFromStack", () => {
      const store = useWizardStore.getState();

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          web: { "web-framework": [sa("web-framework-react", true)] },
        },
      };
      initializeMatrix(ALL_SKILLS_WEB_FRAMEWORK_MATRIX);

      store.populateFromStack(stack);
      expect(useWizardStore.getState().skillConfigs).toHaveLength(1);

      store.toggleDomain("web");
      expect(useWizardStore.getState().skillConfigs).toHaveLength(0);

      store.toggleDomain("web");
      expect(useWizardStore.getState().skillConfigs).toHaveLength(1);
      expect(useWizardStore.getState().skillConfigs[0].id).toBe("web-framework-react");
    });

    it("should reset skillConfigs and focusedSkillId on reset", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.setFocusedSkillId("web-framework-react");

      store.reset();

      const state = useWizardStore.getState();
      expect(state.skillConfigs).toEqual([]);
      expect(state.focusedSkillId).toBeNull();
    });

    it("should set all sources to local via setAllSourcesLocal", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("api", "api-api", "api-framework-hono", true);

      store.setAllSourcesLocal();

      const { skillConfigs } = useWizardStore.getState();
      expect(skillConfigs.every((sc) => sc.source === "local")).toBe(true);
    });

    it("should set all sources to plugin via setAllSourcesPlugin", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.setSourceSelection("web-framework-react", "local");

      initializeMatrix(
        createMockMatrix({
          ...SKILLS.react,
          availableSources: [{ name: "Acme Corp", type: "private", installed: false }],
        }),
      );

      store.setAllSourcesPlugin();

      const { skillConfigs } = useWizardStore.getState();
      expect(skillConfigs[0].source).toBe("Acme Corp");
    });
  });

  describe("computed getters", () => {
    it("should get all selected technologies", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("web", "web-styling", "web-styling-scss-modules", true);
      store.toggleTechnology("api", "api-api", "api-framework-hono", true);

      const technologies = store.getAllSelectedTechnologies();
      expect(technologies).toContain("web-framework-react");
      expect(technologies).toContain("web-styling-scss-modules");
      expect(technologies).toContain("api-framework-hono");
    });

    it("should get selected technologies per domain", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("web", "web-styling", "web-styling-scss-modules", true);
      store.toggleTechnology("api", "api-api", "api-framework-hono", true);

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

    it("should omit domains with empty category arrays from getSelectedTechnologiesPerDomain", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("web", "web-framework", "web-framework-react", true); // toggle off

      const perDomain = store.getSelectedTechnologiesPerDomain();
      expect(perDomain.web).toBeUndefined();
    });

    it("should get technology count", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("web", "web-styling", "web-styling-scss-modules", true);
      store.toggleTechnology("api", "api-api", "api-framework-hono", true);

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

      store.reset();

      const state = useWizardStore.getState();
      expect(state.step).toBe("stack");
      expect(state.approach).toBeNull();
      expect(state.selectedStackId).toBeNull();
      expect(state.selectedDomains).toEqual([]);
      expect(state.history).toEqual([]);
    });
  });

  describe("populateFromStack", () => {
    it("should set selectedDomains to all domains regardless of stack contents", () => {
      const store = useWizardStore.getState();

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          web: { "web-framework": [sa("web-framework-react", true)] },
        },
      };
      initializeMatrix(ALL_SKILLS_WEB_FRAMEWORK_MATRIX);

      store.populateFromStack(stack);

      const { selectedDomains, domainSelections } = useWizardStore.getState();

      expect(selectedDomains).toEqual(["web", "api", "mobile", "cli", "shared"]);

      expect(domainSelections.web).toBeDefined();
      expect(domainSelections.web!["web-framework"]).toEqual(["web-framework-react"]);
      expect(domainSelections.api).toBeUndefined();
    });

    it("should populate domainSelections from stack agents", () => {
      const store = useWizardStore.getState();

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          web: {
            "web-framework": [sa("web-framework-react", true)],
            "web-client-state": [sa("web-state-zustand")],
          },
          api: { "api-api": [sa("api-framework-hono", true)] },
        },
      };
      initializeMatrix(ALL_SKILLS_FULLSTACK_CATEGORIES_MATRIX);

      store.populateFromStack(stack);

      const { domainSelections } = useWizardStore.getState();

      expect(domainSelections.web!["web-framework"]).toEqual(["web-framework-react"]);
      expect(domainSelections.web!["web-client-state"]).toEqual(["web-state-zustand"]);
      expect(domainSelections.api!["api-api"]).toEqual(["api-framework-hono"]);
    });

    it("should skip entries without a domain", () => {
      const store = useWizardStore.getState();

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          misc: { "shared-methodology": [sa("meta-methodology-vitest" as SkillId)] },
        },
      };
      initializeMatrix(ALL_SKILLS_METHODOLOGY_BARE_MATRIX);

      store.populateFromStack(stack);

      const { domainSelections } = useWizardStore.getState();

      expect(typedKeys(domainSelections)).toHaveLength(0);
    });

    it("should populate multiple skills from array-valued categories", () => {
      const store = useWizardStore.getState();

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          "pattern-scout": {
            "shared-methodology": [
              sa("meta-methodology-investigation-requirements", true),
              sa("meta-methodology-anti-over-engineering", true),
              sa("meta-methodology-success-criteria", true),
            ],
          },
        },
      };
      initializeMatrix(ALL_SKILLS_METHODOLOGY_MATRIX);

      store.populateFromStack(stack);

      const { domainSelections } = useWizardStore.getState();

      expect(domainSelections.shared!["shared-methodology"]).toEqual([
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
            "web-framework": [sa("web-framework-react", true)],
            "shared-methodology": [
              sa("meta-methodology-investigation-requirements", true),
              sa("meta-methodology-anti-over-engineering", true),
            ],
          },
          api: { "api-api": [sa("api-framework-hono", true)] },
        },
      };
      initializeMatrix(ALL_SKILLS_MULTI_DOMAIN_MATRIX);

      store.populateFromStack(stack);

      const { domainSelections } = useWizardStore.getState();

      expect(domainSelections.web!["web-framework"]).toEqual(["web-framework-react"]);
      expect(domainSelections.shared!["shared-methodology"]).toEqual([
        "meta-methodology-investigation-requirements",
        "meta-methodology-anti-over-engineering",
      ]);
      expect(domainSelections.api!["api-api"]).toEqual(["api-framework-hono"]);
    });

    it("should deduplicate skills from arrays across multiple agents", () => {
      const store = useWizardStore.getState();

      const stack: Parameters<typeof store.populateFromStack>[0] = {
        agents: {
          agent1: {
            "shared-methodology": [
              sa("meta-methodology-investigation-requirements", true),
              sa("meta-methodology-anti-over-engineering", true),
            ],
          },
          agent2: {
            "shared-methodology": [
              sa("meta-methodology-anti-over-engineering", true),
              sa("meta-methodology-success-criteria", true),
            ],
          },
        },
      };
      initializeMatrix(ALL_SKILLS_METHODOLOGY_MATRIX);

      store.populateFromStack(stack);

      const { domainSelections } = useWizardStore.getState();

      // Should deduplicate: anti-over-engineering appears in both agents
      expect(domainSelections.shared!["shared-methodology"]).toEqual([
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

      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("web", "web-styling", "web-styling-scss-modules", true);
      store.toggleTechnology("api", "api-api", "api-framework-hono", true);
      store.setStep("confirm");

      const state = useWizardStore.getState();
      expect(state.step).toBe("confirm");
      expect(state.approach).toBe("scratch");
      expect(state.selectedDomains).toEqual(["web", "api"]);
      expect(state.domainSelections.web!["web-framework"]).toEqual(["web-framework-react"]);
      expect(state.domainSelections.web!["web-styling"]).toEqual(["web-styling-scss-modules"]);
      expect(state.domainSelections.api!["api-api"]).toEqual(["api-framework-hono"]);
    });

    it("should preserve selections when going back", () => {
      const store = useWizardStore.getState();

      store.setApproach("scratch");
      store.toggleDomain("web");
      store.setStep("build");
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      store.goBack();

      const state = useWizardStore.getState();
      expect(state.selectedDomains).toContain("web");
      expect(state.domainSelections.web!["web-framework"]).toEqual(["web-framework-react"]);
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

      const skill = {
        ...SKILLS.react,
        availableSources: [
          makeSource({ name: "Acme Corp", type: "private", primary: true }),
          makeSource({ name: "local", type: "local", installed: true, installMode: "local" }),
        ],
      };

      initializeMatrix(createMockMatrix(skill));

      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      const rows = store.buildSourceRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].options[0].id).toBe("local");
      expect(rows[0].options[1].id).toBe("Acme Corp");
    });

    it("should sort scoped marketplace before default public marketplace", () => {
      const store = useWizardStore.getState();

      const skill = {
        ...SKILLS.react,
        availableSources: [
          makeSource({ name: "agents-inc", type: "public" }),
          makeSource({ name: "Acme Corp", type: "private", primary: true }),
        ],
      };

      initializeMatrix(createMockMatrix(skill));

      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      const rows = store.buildSourceRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].options[0].id).toBe("local");
      expect(rows[0].options[1].id).toBe("Acme Corp");
      expect(rows[0].options[2].id).toBe("agents-inc");
    });

    it("should sort default public marketplace before third-party sources", () => {
      const store = useWizardStore.getState();

      const skill = {
        ...SKILLS.react,
        availableSources: [
          makeSource({ name: "Extra Corp", type: "private" }),
          makeSource({ name: "agents-inc", type: "public" }),
        ],
      };

      initializeMatrix(createMockMatrix(skill));

      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      const rows = store.buildSourceRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].options[0].id).toBe("local");
      expect(rows[0].options[1].id).toBe("agents-inc");
      expect(rows[0].options[2].id).toBe("Extra Corp");
    });

    it("should sort all four tiers in correct order", () => {
      const store = useWizardStore.getState();

      const skill = {
        ...SKILLS.react,
        availableSources: [
          makeSource({ name: "Extra Corp", type: "private" }),
          makeSource({ name: "agents-inc", type: "public" }),
          makeSource({ name: "Acme Corp", type: "private", primary: true }),
          makeSource({ name: "local", type: "local", installed: true, installMode: "local" }),
        ],
      };

      initializeMatrix(createMockMatrix(skill));

      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      const rows = store.buildSourceRows();
      expect(rows).toHaveLength(1);

      const sourceNames = rows[0].options.map((opt) => opt.id);
      expect(sourceNames).toEqual(["local", "Acme Corp", "agents-inc", "Extra Corp"]);
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

  describe("agentConfigs and scope management", () => {
    it("should have empty agentConfigs initially", () => {
      const { agentConfigs } = useWizardStore.getState();
      expect(agentConfigs).toEqual([]);
    });

    it("should sync agentConfigs when toggleAgent is called", () => {
      const store = useWizardStore.getState();
      store.toggleAgent("web-developer");

      const { agentConfigs } = useWizardStore.getState();
      expect(agentConfigs).toEqual([{ name: "web-developer", scope: "global" }]);
    });

    it("should remove from agentConfigs when agent is toggled off", () => {
      const store = useWizardStore.getState();
      store.toggleAgent("web-developer");
      store.toggleAgent("web-developer");

      const { agentConfigs } = useWizardStore.getState();
      expect(agentConfigs).toEqual([]);
    });

    it("should toggle agent scope between global and project", () => {
      const store = useWizardStore.getState();
      store.toggleAgent("web-developer");
      store.toggleAgentScope("web-developer");

      const { agentConfigs } = useWizardStore.getState();
      expect(agentConfigs).toEqual([{ name: "web-developer", scope: "project" }]);

      store.toggleAgentScope("web-developer");
      expect(useWizardStore.getState().agentConfigs).toEqual([
        { name: "web-developer", scope: "global" },
      ]);
    });

    it("should set and clear focusedAgentId", () => {
      const store = useWizardStore.getState();
      store.setFocusedAgentId("web-developer");

      expect(useWizardStore.getState().focusedAgentId).toBe("web-developer");

      store.setFocusedAgentId(null);
      expect(useWizardStore.getState().focusedAgentId).toBeNull();
    });

    it("should not toggle locked agents", () => {
      useWizardStore.setState({ lockedAgentNames: ["web-developer"] as AgentName[] });
      const store = useWizardStore.getState();
      store.toggleAgent("web-developer");

      const { selectedAgents, agentConfigs } = useWizardStore.getState();
      expect(selectedAgents).toEqual([]);
      expect(agentConfigs).toEqual([]);
    });

    it("should not toggle scope of locked agents", () => {
      const store = useWizardStore.getState();
      store.toggleAgent("web-developer");
      useWizardStore.setState({ lockedAgentNames: ["web-developer"] as AgentName[] });

      store.toggleAgentScope("web-developer");
      const { agentConfigs } = useWizardStore.getState();
      expect(agentConfigs).toEqual([{ name: "web-developer", scope: "global" }]);
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

  describe("deriveInstallMode", () => {
    it("should return 'plugin' when all skills have default marketplace source", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("web", "web-styling", "web-styling-scss-modules", true);

      const result = store.deriveInstallMode();
      expect(result).toBe("plugin");
    });

    it("should return 'local' when all skills are set to local", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("api", "api-api", "api-framework-hono", true);
      store.setSourceSelection("web-framework-react", "local");
      store.setSourceSelection("api-framework-hono", "local");

      const result = store.deriveInstallMode();
      expect(result).toBe("local");
    });

    it("should return 'mixed' when some skills are local and some are not", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.toggleTechnology("api", "api-api", "api-framework-hono", true);
      store.setSourceSelection("web-framework-react", "local");
      store.setSourceSelection("api-framework-hono", "agents-inc");

      const result = store.deriveInstallMode();
      expect(result).toBe("mixed");
    });

    it("should return 'local' when no skills are configured", () => {
      const store = useWizardStore.getState();

      const result = store.deriveInstallMode();
      expect(result).toBe("local");
    });

    it("should handle single skill as local", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);
      store.setSourceSelection("web-framework-react", "local");

      const result = store.deriveInstallMode();
      expect(result).toBe("local");
    });

    it("should handle single skill as plugin", () => {
      const store = useWizardStore.getState();
      store.toggleTechnology("web", "web-framework", "web-framework-react", true);

      const result = store.deriveInstallMode();
      expect(result).toBe("plugin");
    });
  });
});
