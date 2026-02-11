export {
  loadSkillsMatrix,
  extractAllSkills,
  mergeMatrixWithSkills,
  loadAndMergeSkillsMatrix,
} from "./matrix-loader";

export {
  resolveAlias,
  getDependentSkills,
  type SkillCheckOptions,
  isDisabled,
  getDisableReason,
  isDiscouraged,
  getDiscourageReason,
  isRecommended,
  getRecommendReason,
  validateSelection,
  getAvailableSkills,
  getSkillsByCategory,
  isCategoryAllDisabled,
} from "./matrix-resolver";

export { type MatrixHealthIssue, checkMatrixHealth } from "./matrix-health-check";
