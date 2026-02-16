import { unique } from "remeda";
import type { CategoryMap, Domain, MergedSkillsMatrix, ResolvedStack } from "../../types/index.js";
import { typedKeys } from "../../utils/typed-object.js";

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

/** Extract unique domains from a stack's agent-to-skill mappings. */
export function getDomainsFromStack(stack: ResolvedStack, categories: CategoryMap): Domain[] {
  const subcategories = Object.values(stack.skills).flatMap((config) =>
    config ? typedKeys(config) : [],
  );
  return unique(
    subcategories.flatMap((sub) => {
      const d = categories[sub]?.domain;
      return d ? [d] : [];
    }),
  ).sort();
}
