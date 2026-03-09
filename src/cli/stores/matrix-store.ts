import { create } from "zustand";
import type { MergedSkillsMatrix, ResolvedSkill, SkillId, SkillSlug } from "../types/index.js";

type MatrixState = {
  matrix: MergedSkillsMatrix | null;

  setMatrix: (matrix: MergedSkillsMatrix) => void;
  reset: () => void;

  getMatrix: () => MergedSkillsMatrix;
  getSkill: (idOrSlug: SkillId | SkillSlug) => ResolvedSkill | undefined;
};

export const useMatrixStore = create<MatrixState>((set, get) => ({
  matrix: null,

  setMatrix: (matrix) => set({ matrix }),
  reset: () => set({ matrix: null }),

  getMatrix: () => {
    const { matrix } = get();
    if (!matrix) {
      throw new Error("Matrix store not initialized — call setMatrix() after loading the matrix");
    }
    return matrix;
  },

  getSkill: (idOrSlug) => {
    const { matrix } = get();
    if (!matrix) return undefined;
    const direct = matrix.skills[idOrSlug as SkillId];
    if (direct) return direct;
    const id = matrix.slugMap.slugToId[idOrSlug as SkillSlug];
    return id ? matrix.skills[id] : undefined;
  },
}));

/** Look up a skill — returns undefined if not found. Use for user input or optional lookups. */
export const findSkill = (idOrSlug: SkillId | SkillSlug): ResolvedSkill | undefined =>
  useMatrixStore.getState().getSkill(idOrSlug);

/** Look up a skill — throws if not found. Use when the skill must exist. */
export const getSkill = (idOrSlug: SkillId | SkillSlug): ResolvedSkill => {
  const skill = useMatrixStore.getState().getSkill(idOrSlug);
  if (!skill) {
    throw new Error(`Skill '${idOrSlug}' not found in matrix store`);
  }
  return skill;
};

export const getMatrix = () => useMatrixStore.getState().getMatrix();
