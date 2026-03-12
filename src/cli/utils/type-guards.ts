import { CATEGORIES, DOMAINS, AGENT_NAMES } from "../types/generated/source-types";
import type { Category, Domain, AgentName } from "../types/generated/source-types";
import type { CategoryPath } from "../types/skills";

/** Runtime check that a string is a valid Category value from the generated union */
export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

/** Runtime check that a string is a valid Domain value from the generated union */
export function isDomain(value: string): value is Domain {
  return (DOMAINS as readonly string[]).includes(value);
}

/** Runtime check that a string is a valid AgentName value from the generated union */
export function isAgentName(value: string): value is AgentName {
  return (AGENT_NAMES as readonly string[]).includes(value);
}

/** Runtime check that a string is a valid CategoryPath (Category | "local") */
export function isCategoryPath(value: string): value is CategoryPath {
  return value === "local" || isCategory(value);
}
