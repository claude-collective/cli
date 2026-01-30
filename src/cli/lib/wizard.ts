import * as p from "@clack/prompts";
import pc from "picocolors";
import type {
  MergedSkillsMatrix,
  ResolvedStack,
  SkillOption,
  SelectionValidation,
} from "../types-matrix";
import {
  getTopLevelCategories,
  getSubcategories,
  getAvailableSkills,
  validateSelection,
  isCategoryAllDisabled,
  getDependentSkills,
  resolveAlias,
  type SkillCheckOptions,
} from "./matrix-resolver";

export const BACK_VALUE = "__back__";
export const CONTINUE_VALUE = "__continue__";
export const EXPERT_MODE_VALUE = "__expert_mode__";
export const INSTALL_MODE_VALUE = "__install_mode__";

export type WizardStep =
  | "approach"
  | "stack"
  | "category"
  | "subcategory"
  | "confirm";

export interface WizardState {
  currentStep: WizardStep;
  selectedSkills: string[];
  history: WizardStep[];
  currentTopCategory: string | null;
  currentSubcategory: string | null;
  visitedCategories: Set<string>;
  selectedStack: ResolvedStack | null;
  lastSelectedCategory: string | null;
  lastSelectedSubcategory: string | null;
  lastSelectedSkill: string | null;
  lastSelectedApproach: string | null;
  expertMode: boolean;
  installMode: "plugin" | "local";
}

export interface WizardResult {
  selectedSkills: string[];
  selectedStack: ResolvedStack | null;
  validation: SelectionValidation;
  installMode: "plugin" | "local";
}

export interface WizardOptions {
  initialSkills?: string[];
  hasLocalSkills?: boolean;
}

export function createInitialState(options: WizardOptions = {}): WizardState {
  const hasInitialSkills =
    options.initialSkills && options.initialSkills.length > 0;

  return {
    currentStep: hasInitialSkills ? "category" : "approach",
    selectedSkills: options.initialSkills ? [...options.initialSkills] : [],
    history: [],
    currentTopCategory: null,
    currentSubcategory: null,
    visitedCategories: new Set(),
    selectedStack: null,
    lastSelectedCategory: null,
    lastSelectedSubcategory: null,
    lastSelectedSkill: null,
    lastSelectedApproach: null,
    expertMode: options.hasLocalSkills ?? false,
    installMode: "local",
  };
}

export function pushHistory(state: WizardState): void {
  state.history.push(state.currentStep);
}

export function popHistory(state: WizardState): WizardStep | null {
  return state.history.pop() || null;
}

function collectAllDependents(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): string[] {
  const allDependents: string[] = [];
  const visited = new Set<string>();
  const queue = [skillId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const directDependents = getDependentSkills(
      current,
      currentSelections,
      matrix,
    );

    for (const dependent of directDependents) {
      if (!visited.has(dependent) && !allDependents.includes(dependent)) {
        allDependents.push(dependent);
        queue.push(dependent);
      }
    }
  }

  return allDependents;
}

export function clearTerminal(): void {
  process.stdout.write("\x1B[2J\x1B[0f");
}

export function renderSelectionsHeader(
  selectedSkills: string[],
  matrix: MergedSkillsMatrix,
): void {
  if (selectedSkills.length === 0) {
    return;
  }

  const byCategory: Record<string, string[]> = {};

  for (const skillId of selectedSkills) {
    const skill = matrix.skills[skillId];
    if (!skill) continue;

    const category = matrix.categories[skill.category];
    const topCategory = category?.parent || skill.category;
    const topCategoryDef = matrix.categories[topCategory];
    const categoryName = topCategoryDef?.name || topCategory;

    if (!byCategory[categoryName]) {
      byCategory[categoryName] = [];
    }
    byCategory[categoryName].push(skill.alias || skill.name);
  }

  console.log("\n" + pc.dim("─".repeat(50)));
  console.log(pc.bold("  Selected:"));
  for (const [category, skills] of Object.entries(byCategory)) {
    console.log(`  ${pc.cyan(category)}: ${skills.join(", ")}`);
  }
  console.log(pc.dim("─".repeat(50)) + "\n");
}

function showSelectionsHeader(
  state: WizardState,
  matrix: MergedSkillsMatrix,
): void {
  renderSelectionsHeader(state.selectedSkills, matrix);
}

export function formatSkillOption(option: SkillOption): {
  value: string;
  label: string;
  hint?: string;
} {
  let label = option.name;
  const hint: string | undefined = option.description;

  if (option.selected) {
    label = pc.green(`✓ ${option.name}`);
  } else if (option.disabled) {
    const shortReason =
      option.disabledReason?.split(" (")[0]?.toLowerCase() ||
      "requirements not met";
    label = pc.dim(`${option.name} (disabled, ${shortReason})`);
  } else if (option.discouraged) {
    label = `${option.name} (not recommended)`;
  } else if (option.recommended) {
    label = `${option.name} ${pc.green("(recommended)")}`;
  }

  return {
    value: option.id,
    label,
    hint,
  };
}

export function formatStackOption(stack: ResolvedStack): {
  value: string;
  label: string;
  hint: string;
} {
  return {
    value: stack.id,
    label: stack.name,
    hint: stack.description,
  };
}

export function formatExpertModeOption(expertMode: boolean): {
  value: string;
  label: string;
  hint: string;
} {
  if (expertMode) {
    return {
      value: EXPERT_MODE_VALUE,
      label: pc.yellow("Expert Mode: ON"),
      hint: "click to disable - currently allowing any skill combination",
    };
  }
  return {
    value: EXPERT_MODE_VALUE,
    label: pc.dim("Expert Mode: OFF"),
    hint: "click to enable - allows combining conflicting skills",
  };
}

export function formatInstallModeOption(installMode: "plugin" | "local"): {
  value: string;
  label: string;
  hint: string;
} {
  if (installMode === "local") {
    return {
      value: INSTALL_MODE_VALUE,
      label: pc.cyan("Install Mode: Local"),
      hint: "click to switch - copies skills to .claude/skills/ for customization (recommended)",
    };
  }
  return {
    value: INSTALL_MODE_VALUE,
    label: pc.dim("Install Mode: Plugin"),
    hint: "click to switch - installs as native Claude plugins",
  };
}

async function stepApproach(state: WizardState): Promise<string | symbol> {
  clearTerminal();

  const statusLines: string[] = [];
  if (state.expertMode) {
    statusLines.push(
      pc.yellow("Expert Mode is ON") + pc.dim(" - conflict checking disabled"),
    );
  }
  statusLines.push(
    pc.cyan(
      `Install Mode: ${state.installMode === "plugin" ? "Plugin" : "Local"}`,
    ) +
      pc.dim(
        state.installMode === "plugin"
          ? " - native Claude plugins"
          : " - copy to .claude/skills/",
      ),
  );

  if (statusLines.length > 0) {
    console.log("\n  " + statusLines.join("\n  ") + "\n");
  }

  const result = await p.select({
    message: "How would you like to set up your stack?",
    options: [
      {
        value: "stack",
        label: "Use a pre-built template",
        hint: "recommended - quickly get started with a curated selection",
      },
      {
        value: "scratch",
        label: "Start from scratch",
        hint: "choose each skill yourself",
      },
      formatExpertModeOption(state.expertMode),
      formatInstallModeOption(state.installMode),
    ],
    initialValue: state.lastSelectedApproach || undefined,
  });

  return result as string | symbol;
}

async function stepSelectStack(
  state: WizardState,
  matrix: MergedSkillsMatrix,
): Promise<string | symbol> {
  clearTerminal();
  showSelectionsHeader(state, matrix);
  const options = matrix.suggestedStacks.map(formatStackOption);

  const result = await p.select({
    message: "Select a stack:",
    options: [{ value: BACK_VALUE, label: pc.dim("Back") }, ...options],
  });

  return result as string | symbol;
}

async function stepSelectTopCategory(
  state: WizardState,
  matrix: MergedSkillsMatrix,
): Promise<string | symbol> {
  clearTerminal();
  showSelectionsHeader(state, matrix);
  const topCategories = getTopLevelCategories(matrix);
  const unvisitedCategories = topCategories.filter(
    (catId) => !state.visitedCategories.has(catId),
  );

  const categoryOptions = topCategories.map((catId) => {
    const cat = matrix.categories[catId];
    return {
      value: catId,
      label: cat.name,
    };
  });

  const topNavOptions: Array<{
    value: string;
    label: string;
    hint?: string;
  }> = [{ value: BACK_VALUE, label: pc.dim("Back") }];

  const bottomNavOptions: Array<{
    value: string;
    label: string;
    hint?: string;
  }> = [];

  if (state.selectedSkills.length > 0) {
    bottomNavOptions.push({
      value: CONTINUE_VALUE,
      label: pc.green("Continue"),
    });
  }

  const result = await p.select({
    message: `Select a category to configure (${unvisitedCategories.length} remaining):`,
    options: [...topNavOptions, ...categoryOptions, ...bottomNavOptions],
    initialValue: state.lastSelectedCategory || undefined,
  });

  return result as string | symbol;
}

async function stepSelectSubcategory(
  state: WizardState,
  matrix: MergedSkillsMatrix,
): Promise<string | symbol> {
  clearTerminal();
  showSelectionsHeader(state, matrix);
  const topCategory = state.currentTopCategory;
  if (!topCategory) {
    return BACK_VALUE;
  }

  const subcategories = getSubcategories(topCategory, matrix);
  const topCat = matrix.categories[topCategory];
  const checkOptions: SkillCheckOptions = { expertMode: state.expertMode };

  const subcategoryOptions = subcategories.map((subId) => {
    const sub = matrix.categories[subId];
    const skills = getAvailableSkills(
      subId,
      state.selectedSkills,
      matrix,
      checkOptions,
    );
    const selectedInCategory = skills.filter((s) => s.selected);
    const hasSelection = selectedInCategory.length > 0;

    const categoryDisabled = isCategoryAllDisabled(
      subId,
      state.selectedSkills,
      matrix,
      checkOptions,
    );

    let label: string;
    if (hasSelection) {
      label = `${sub.name} ${pc.green(`(${selectedInCategory[0].name} selected)`)}`;
    } else if (categoryDisabled.disabled) {
      const shortReason =
        categoryDisabled.reason?.toLowerCase() || "requirements not met";
      label = pc.dim(`${sub.name} (disabled, ${shortReason})`);
    } else if (sub.required) {
      label = `${sub.name} ${pc.yellow("(required)")}`;
    } else {
      label = sub.name;
    }

    return {
      value: subId,
      label,
    };
  });

  const navigationOptions: Array<{
    value: string;
    label: string;
    hint?: string;
  }> = [{ value: BACK_VALUE, label: pc.dim("Back") }];

  const result = await p.select({
    message: `${topCat.name} - Select a subcategory:`,
    options: [...navigationOptions, ...subcategoryOptions],
    initialValue: state.lastSelectedSubcategory || undefined,
  });

  return result as string | symbol;
}

async function stepSelectSkill(
  state: WizardState,
  matrix: MergedSkillsMatrix,
): Promise<string | symbol> {
  clearTerminal();
  showSelectionsHeader(state, matrix);
  const subcategoryId = state.currentSubcategory;
  if (!subcategoryId) {
    return BACK_VALUE;
  }

  const subcategory = matrix.categories[subcategoryId];
  const checkOptions: SkillCheckOptions = { expertMode: state.expertMode };
  const skills = getAvailableSkills(
    subcategoryId,
    state.selectedSkills,
    matrix,
    checkOptions,
  );

  const skillOptions = skills.map(formatSkillOption);

  const navigationOptions: Array<{
    value: string;
    label: string;
    hint?: string;
  }> = [{ value: BACK_VALUE, label: pc.dim("Back") }];

  const allOptions = [...navigationOptions, ...skillOptions];

  const result = await p.select({
    message: `${subcategory.name}:`,
    options: allOptions,
    initialValue: state.lastSelectedSkill || undefined,
  });

  return result as string | symbol;
}

async function stepConfirm(
  state: WizardState,
  matrix: MergedSkillsMatrix,
): Promise<string | symbol> {
  clearTerminal();

  console.log("\n" + pc.bold("Selected Skills:"));

  if (state.selectedSkills.length === 0) {
    console.log(pc.dim("  No skills selected"));
  } else {
    for (const skillId of state.selectedSkills) {
      const skill = matrix.skills[skillId];
      if (skill) {
        const category = matrix.categories[skill.category];
        console.log(
          `  ${pc.green("+")} ${skill.name} ${pc.dim(`(${category?.name || skill.category})`)}`,
        );
      }
    }
  }

  const validation = validateSelection(state.selectedSkills, matrix);

  if (validation.errors.length > 0) {
    console.log("\n" + pc.red(pc.bold("Errors:")));
    for (const error of validation.errors) {
      console.log(`  ${pc.red("x")} ${error.message}`);
    }
  }

  if (validation.warnings.length > 0) {
    console.log("\n" + pc.yellow(pc.bold("Warnings:")));
    for (const warning of validation.warnings) {
      console.log(`  ${pc.yellow("!")} ${warning.message}`);
    }
  }

  console.log("");

  const result = await p.select({
    message: validation.valid
      ? "Confirm your selection?"
      : "Selection has errors. What would you like to do?",
    options: [
      { value: BACK_VALUE, label: pc.dim("Back") },
      ...(validation.valid
        ? [{ value: "confirm", label: pc.green("Confirm and continue") }]
        : []),
    ],
  });

  return result as string | symbol;
}

export async function runWizard(
  matrix: MergedSkillsMatrix,
  options: WizardOptions = {},
): Promise<WizardResult | null> {
  const hasLocalSkills = Object.values(matrix.skills).some(
    (skill) => skill.local === true,
  );

  const state = createInitialState({
    ...options,
    hasLocalSkills,
  });

  if (hasLocalSkills && state.expertMode) {
    console.log(
      pc.yellow("\n  Local skills detected") +
        pc.dim(" - Expert Mode enabled (dependency checking disabled)\n"),
    );
  }

  while (true) {
    switch (state.currentStep) {
      case "approach": {
        const result = await stepApproach(state);

        if (p.isCancel(result)) {
          return null;
        }

        if (result === EXPERT_MODE_VALUE) {
          state.lastSelectedApproach = EXPERT_MODE_VALUE;
          state.expertMode = !state.expertMode;
          break;
        }

        if (result === INSTALL_MODE_VALUE) {
          state.lastSelectedApproach = INSTALL_MODE_VALUE;
          state.installMode =
            state.installMode === "plugin" ? "local" : "plugin";
          break;
        }

        // Clear lastSelectedApproach when moving to a new step
        state.lastSelectedApproach = null;

        if (result === "stack") {
          pushHistory(state);
          state.currentStep = "stack";
        } else {
          pushHistory(state);
          state.currentStep = "category";
        }
        break;
      }

      case "stack": {
        const result = await stepSelectStack(state, matrix);

        if (p.isCancel(result)) {
          return null;
        }

        if (result === BACK_VALUE) {
          state.currentStep = popHistory(state) || "approach";
          break;
        }

        const stack = matrix.suggestedStacks.find((s) => s.id === result);
        if (stack) {
          state.selectedStack = stack;
          state.selectedSkills = [...stack.allSkillIds];

          pushHistory(state);
          // Go directly to category view - skills are pre-selected and visible
          state.currentStep = "category";
        }
        break;
      }

      case "category": {
        const result = await stepSelectTopCategory(state, matrix);

        if (p.isCancel(result)) {
          return null;
        }

        if (result === BACK_VALUE) {
          state.currentStep = popHistory(state) || "approach";
          break;
        }

        if (result === CONTINUE_VALUE) {
          state.lastSelectedCategory = CONTINUE_VALUE;
          pushHistory(state);
          state.currentStep = "confirm";
          break;
        }

        state.lastSelectedCategory = result as string;

        const subcategories = getSubcategories(result as string, matrix);
        if (subcategories.length > 0) {
          pushHistory(state);
          state.currentTopCategory = result as string;
          state.currentStep = "subcategory";
        } else {
          p.log.info(
            `${matrix.categories[result as string]?.name || result} has no subcategories`,
          );
        }
        break;
      }

      case "subcategory": {
        const result = await stepSelectSubcategory(state, matrix);

        if (p.isCancel(result)) {
          return null;
        }

        if (result === BACK_VALUE) {
          if (state.currentTopCategory) {
            state.visitedCategories.add(state.currentTopCategory);
          }
          state.currentTopCategory = null;
          state.lastSelectedSubcategory = null;
          state.currentStep = popHistory(state) || "category";
          break;
        }

        state.lastSelectedSubcategory = result as string;
        state.currentSubcategory = result as string;

        while (true) {
          const skillResult = await stepSelectSkill(state, matrix);

          if (p.isCancel(skillResult)) {
            return null;
          }

          if (skillResult === BACK_VALUE) {
            state.currentSubcategory = null;
            state.lastSelectedSkill = null;
            break;
          }

          const selectedSkillId = skillResult as string;
          state.lastSelectedSkill = selectedSkillId;

          const skillOptions = getAvailableSkills(
            state.currentSubcategory!,
            state.selectedSkills,
            matrix,
          );
          const selectedOption = skillOptions.find(
            (s) => s.id === selectedSkillId,
          );

          if (selectedOption?.disabled) {
            continue;
          }

          const subcategory = matrix.categories[state.currentSubcategory!];
          const alreadySelected =
            state.selectedSkills.includes(selectedSkillId);

          if (alreadySelected) {
            const allDependents = collectAllDependents(
              selectedSkillId,
              state.selectedSkills,
              matrix,
            );

            if (allDependents.length > 0) {
              const dependentNames = allDependents
                .map((id) => matrix.skills[id]?.name || id)
                .join(", ");
              const skillName =
                matrix.skills[resolveAlias(selectedSkillId, matrix)]?.name ||
                selectedSkillId;

              const shouldDeselect = await p.confirm({
                message: `Deselecting ${skillName} will also remove: ${dependentNames}. Continue?`,
                initialValue: false,
              });

              if (p.isCancel(shouldDeselect) || !shouldDeselect) {
                continue;
              }

              const toRemove = new Set([selectedSkillId, ...allDependents]);
              state.selectedSkills = state.selectedSkills.filter(
                (id) => !toRemove.has(id),
              );
            } else {
              const index = state.selectedSkills.indexOf(selectedSkillId);
              if (index > -1) {
                state.selectedSkills.splice(index, 1);
              }
            }
          } else {
            if (subcategory?.exclusive) {
              state.selectedSkills = state.selectedSkills.filter((id) => {
                const skill = matrix.skills[id];
                return skill?.category !== state.currentSubcategory;
              });
            }
            state.selectedSkills.push(selectedSkillId);
          }
        }
        break;
      }

      case "confirm": {
        const result = await stepConfirm(state, matrix);

        if (p.isCancel(result)) {
          return null;
        }

        if (result === BACK_VALUE) {
          state.currentStep = popHistory(state) || "category";
          break;
        }

        if (result === "confirm") {
          const validation = validateSelection(state.selectedSkills, matrix);
          return {
            selectedSkills: state.selectedSkills,
            selectedStack: state.selectedStack,
            validation,
            installMode: state.installMode,
          };
        }
        break;
      }
    }
  }
}
