export {
  loadSkillCategories,
  loadSkillRules,
  extractAllSkills,
  mergeMatrixWithSkills,
  loadAndMergeSkillsMatrix,
  synthesizeCategory,
} from "./matrix-loader";

export {
  resolveAlias,
  getDependentSkills,
  isDiscouraged,
  getDiscourageReason,
  isRecommended,
  getRecommendReason,
  validateSelection,
  getAvailableSkills,
  getSkillsByCategory,
} from "./matrix-resolver";

export { type MatrixHealthIssue, checkMatrixHealth } from "./matrix-health-check";
