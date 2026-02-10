import type { MergedSkillsMatrix, Domain } from "../../types-matrix.js";

/**
 * Get display name for a domain.
 */
export function getDomainDisplayName(domain: Domain): string {
  const displayNames: Record<Domain, string> = {
    web: "Web",
    "web-extras": "Web Extras",
    api: "API",
    cli: "CLI",
    mobile: "Mobile",
    shared: "Shared",
  };
  return displayNames[domain] || domain.charAt(0).toUpperCase() + domain.slice(1);
}

/**
 * Get stack name from matrix by stack ID.
 */
export function getStackName(
  stackId: string | null,
  matrix: MergedSkillsMatrix,
): string | undefined {
  if (!stackId) return undefined;
  const stack = matrix.suggestedStacks.find((s) => s.id === stackId);
  return stack?.name;
}
