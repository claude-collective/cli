import { describe, it, expect } from "vitest";
import { typedEntries, typedKeys } from "./typed-object";

describe("typedEntries", () => {
  it("should return entries of a Record with correct key-value pairs", () => {
    const obj: Record<"a" | "b", number> = { a: 1, b: 2 };

    const result = typedEntries(obj);

    expect(result).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("should work with Partial<Record<...>> where some keys are undefined", () => {
    const obj: Partial<Record<"x" | "y" | "z", string>> = { x: "hello", z: "world" };

    const result = typedEntries(obj);

    expect(result).toEqual([
      ["x", "hello"],
      ["z", "world"],
    ]);
  });

  it("should return an empty array for empty objects", () => {
    const obj: Record<string, number> = {};

    const result = typedEntries(obj);

    expect(result).toEqual([]);
  });

  it("should preserve union key types in returned tuples", () => {
    type Color = "red" | "green" | "blue";
    const obj: Record<Color, number> = { red: 255, green: 128, blue: 0 };

    const result = typedEntries(obj);

    expect(result).toHaveLength(3);
    const keys = result.map(([k]) => k);
    expect(keys).toContain("red");
    expect(keys).toContain("green");
    expect(keys).toContain("blue");
  });

  it("should return array of [key, value] tuples", () => {
    const obj: Record<"name" | "version", string> = { name: "test", version: "1.0" };

    const result = typedEntries(obj);

    for (const entry of result) {
      expect(entry).toHaveLength(2);
      expect(typeof entry[0]).toBe("string");
      expect(typeof entry[1]).toBe("string");
    }
  });

  it("should handle records with complex value types", () => {
    const obj: Record<"a" | "b", string[]> = { a: ["x", "y"], b: ["z"] };

    const result = typedEntries(obj);

    expect(result).toEqual([
      ["a", ["x", "y"]],
      ["b", ["z"]],
    ]);
  });
});

describe("typedKeys", () => {
  it("should return keys of a Record as an array", () => {
    const obj: Record<"a" | "b" | "c", number> = { a: 1, b: 2, c: 3 };

    const result = typedKeys(obj);

    expect(result).toEqual(["a", "b", "c"]);
  });

  it("should return an empty array for empty objects", () => {
    const obj: Record<string, unknown> = {};

    const result = typedKeys(obj);

    expect(result).toEqual([]);
  });

  it("should work with Partial<Record<...>>", () => {
    const obj: Partial<Record<"x" | "y" | "z", string>> = { x: "hello", z: "world" };

    const result = typedKeys(obj);

    expect(result).toEqual(["x", "z"]);
  });

  it("should preserve union key types", () => {
    type Domain = "web" | "api" | "cli";
    const obj: Record<Domain, boolean> = { web: true, api: false, cli: true };

    const result = typedKeys(obj);

    expect(result).toHaveLength(3);
    expect(result).toContain("web");
    expect(result).toContain("api");
    expect(result).toContain("cli");
  });

  it("should return only keys that are present on a partial record", () => {
    const obj: Partial<Record<"a" | "b" | "c" | "d", number>> = { b: 2, d: 4 };

    const result = typedKeys(obj);

    expect(result).toEqual(["b", "d"]);
    expect(result).not.toContain("a");
    expect(result).not.toContain("c");
  });
});
