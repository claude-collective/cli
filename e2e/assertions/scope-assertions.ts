import { expect } from "vitest";
import "../matchers/setup.js";

interface DualScopeExpectation {
  global: {
    skillIds: string[];
    agents: string[];
    copiedSkills?: string[];
  };
  project: {
    skillIds: string[];
    agents: string[];
    copiedSkills?: string[];
  };
}

export async function expectDualScopeInstallation(
  globalHome: string,
  projectDir: string,
  expected: DualScopeExpectation,
): Promise<void> {
  // Global
  await expect({ dir: globalHome }).toHaveConfig({
    skillIds: expected.global.skillIds,
    agents: expected.global.agents,
  });
  for (const agent of expected.global.agents) {
    await expect({ dir: globalHome }).toHaveCompiledAgent(agent);
  }
  for (const skill of expected.global.copiedSkills ?? []) {
    await expect({ dir: globalHome }).toHaveSkillCopied(skill);
  }

  // Project
  await expect({ dir: projectDir }).toHaveConfig({
    skillIds: expected.project.skillIds,
    agents: expected.project.agents,
  });
  for (const agent of expected.project.agents) {
    await expect({ dir: projectDir }).toHaveCompiledAgent(agent);
  }
  for (const skill of expected.project.copiedSkills ?? []) {
    await expect({ dir: projectDir }).toHaveSkillCopied(skill);
  }
}
