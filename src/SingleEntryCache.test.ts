import { describe, expect, it } from "vitest";
import { SingleEntryCache } from "./SingleEntryCache";

describe("SingleEntryCache", () => {
  it("returns undefined when the cache is empty or the input does not match", () => {
    const cache = new SingleEntryCache<string, number>();

    expect(cache.get("person.name")).toBeUndefined();

    cache.set("person.name", 1);

    expect(cache.get("person.documentNumber")).toBeUndefined();
  });

  it("returns the cached output for the exact same input", () => {
    const cache = new SingleEntryCache<string, number>();

    cache.set("person.name", 1);

    expect(cache.get("person.name")).toBe(1);
  });

  it("replaces the previous entry when a new input is cached", () => {
    const cache = new SingleEntryCache<string, number>();

    cache.set("person.name", 1);
    cache.set("serial.number", 2);

    expect(cache.get("person.name")).toBeUndefined();
    expect(cache.get("serial.number")).toBe(2);
  });

  it("clears the cached entry", () => {
    const cache = new SingleEntryCache<string, number>();

    cache.set("person.name", 1);
    cache.clear();

    expect(cache.get("person.name")).toBeUndefined();
  });
});
