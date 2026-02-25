import { unique } from "remeda";
import { BUILT_IN_DOMAIN_ORDER } from "../../consts.js";
import type { CategoryMap, Domain, MergedSkillsMatrix, ResolvedStack } from "../../types/index.js";
import { typedKeys } from "../../utils/typed-object.js";

export function getDomainDisplayName(domain: string): string {
  const displayNames: Record<Domain, string> = {
    web: "Web",
    api: "API",
    cli: "CLI",
    mobile: "Mobile",
    shared: "Shared",
  };
  return (
    (domain in displayNames ? displayNames[domain as Domain] : null) ??
    domain.charAt(0).toUpperCase() + domain.slice(1)
  );
}

export function getStackName(
  stackId: string | null,
  matrix: MergedSkillsMatrix,
): string | undefined {
  if (!stackId) return undefined;
  const stack = matrix.suggestedStacks.find((s) => s.id === stackId);
  return stack?.name;
}

/** Sort domains into canonical display order: custom domains first (alphabetically), then built-in domains (per BUILT_IN_DOMAIN_ORDER). */
export function orderDomains(domains: Domain[]): Domain[] {
  const builtIn = BUILT_IN_DOMAIN_ORDER.filter((d) => domains.includes(d));
  const custom = domains.filter((d) => !BUILT_IN_DOMAIN_ORDER.includes(d)).sort();
  return [...custom, ...builtIn];
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
