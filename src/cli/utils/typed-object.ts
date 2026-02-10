/**
 * Type-safe wrapper around Object.entries that preserves key types.
 * Use instead of `Object.entries(obj) as [K, V][]` boundary casts.
 */
export function typedEntries<K extends string, V>(obj: Partial<Record<K, V>>): [K, V][] {
  return Object.entries(obj) as [K, V][];
}

/**
 * Type-safe wrapper around Object.keys that preserves key types.
 * Use instead of `Object.keys(obj) as K[]` boundary casts.
 */
export function typedKeys<K extends string>(obj: Partial<Record<K, unknown>>): K[] {
  return Object.keys(obj) as K[];
}
