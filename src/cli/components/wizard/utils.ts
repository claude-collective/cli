import type { Domain, MergedSkillsMatrix } from "../../types/index.js";

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

export function getStackName(
  stackId: string | null,
  matrix: MergedSkillsMatrix,
): string | undefined {
  if (!stackId) return undefined;
  const stack = matrix.suggestedStacks.find((s) => s.id === stackId);
  return stack?.name;
}
