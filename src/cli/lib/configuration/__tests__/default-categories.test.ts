import { describe, it, expect } from "vitest";
import { defaultCategories } from "../default-categories";
import type { Category } from "../../../types";
import { typedKeys } from "../../../utils/typed-object";

const EXPECTED_CATEGORY_COUNT = 36;

describe("defaultCategories", () => {
  it("has the expected number of categories", () => {
    const keys = typedKeys(defaultCategories);
    expect(keys).toHaveLength(EXPECTED_CATEGORY_COUNT);
  });

  it("includes web-framework with correct fields", () => {
    const cat = defaultCategories["web-framework"];
    expect(cat).toBeDefined();
    expect(cat!.id).toBe("web-framework");
    expect(cat!.displayName).toBe("Framework");
    expect(cat!.domain).toBe("web");
    expect(cat!.exclusive).toBe(true);
    expect(cat!.required).toBe(true);
    expect(cat!.order).toBe(1);
  });

  it("includes api-api with correct fields", () => {
    const cat = defaultCategories["api-api"];
    expect(cat).toBeDefined();
    expect(cat!.id).toBe("api-api");
    expect(cat!.displayName).toBe("API Framework");
    expect(cat!.domain).toBe("api");
    expect(cat!.exclusive).toBe(true);
    expect(cat!.required).toBe(true);
  });

  it("includes cli-framework with correct fields", () => {
    const cat = defaultCategories["cli-framework"];
    expect(cat).toBeDefined();
    expect(cat!.id).toBe("cli-framework");
    expect(cat!.displayName).toBe("CLI Framework");
    expect(cat!.domain).toBe("cli");
  });

  it("includes shared-meta", () => {
    const cat = defaultCategories["shared-meta"];
    expect(cat).toBeDefined();
    expect(cat!.domain).toBe("shared");
    expect(cat!.exclusive).toBe(false);
  });

  it("all categories have required fields", () => {
    for (const [key, cat] of Object.entries(defaultCategories)) {
      expect(cat!.id, `${key} missing id`).toBe(key as Category);
      expect(cat!.displayName, `${key} missing displayName`).toBeTruthy();
      expect(cat!.description, `${key} missing description`).toBeTruthy();
      expect(cat!.domain, `${key} missing domain`).toBeTruthy();
      expect(typeof cat!.exclusive, `${key} exclusive not boolean`).toBe("boolean");
      expect(typeof cat!.required, `${key} required not boolean`).toBe("boolean");
      expect(typeof cat!.order, `${key} order not number`).toBe("number");
    }
  });
});
