// Type-safe Object.entries that preserves key types (avoids `as [K, V][]` casts)
export function typedEntries<K extends string, V>(obj: Partial<Record<K, V>>): [K, V][] {
  return Object.entries(obj) as [K, V][];
}

// Type-safe Object.keys that preserves key types (avoids `as K[]` casts)
export function typedKeys<K extends string>(obj: Partial<Record<K, unknown>>): K[] {
  return Object.keys(obj) as K[];
}
