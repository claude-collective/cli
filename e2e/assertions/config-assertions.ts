import { expect } from "vitest";

/** Asserts that an array has no duplicate entries. */
export function expectNoDuplicates(arr: string[], label: string): void {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.push(item);
    }
    seen.add(item);
  }
  expect(duplicates, `Duplicate ${label} found: ${duplicates.join(", ")}`).toStrictEqual([]);
}
