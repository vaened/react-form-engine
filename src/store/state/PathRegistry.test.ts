import { describe, expect, it } from "vitest";

import { PathRegistry } from "./PathRegistry";

describe("PathRegistry", () => {
  it("assigns stable ids to registered paths and describes them back", () => {
    const registry = new PathRegistry();

    const personNameId = registry.register("invoice.client.person.name");
    const documentId = registry.register("invoice.client.person.documentNumber");

    expect(personNameId).toBe(1);
    expect(documentId).toBe(2);
    expect(registry.register("invoice.client.person.name")).toBe(personNameId);
    expect(registry.identify("invoice.client.person.name")).toBe(personNameId);
    expect(registry.describe(documentId)).toBe("invoice.client.person.documentNumber");
  });

  it("throws when identifying or describing values that were not registered", () => {
    const registry = new PathRegistry();
    const pathId = registry.register("invoice.client.person.name");

    registry.clear();

    expect(() => registry.identify("invoice.client.person.name")).toThrow(
      'Path "invoice.client.person.name" has not been registered.',
    );
    expect(() => registry.describe(pathId)).toThrow('Path id "1" has not been registered.');
  });

  it("unregisters existing paths and keeps unknown paths as a no-op", () => {
    const registry = new PathRegistry();
    const personNameId = registry.register("invoice.client.person.name");

    expect(registry.unregister("invoice.client.person.name")).toBe(true);
    expect(registry.unregister("invoice.client.person.name")).toBe(false);
    expect(() => registry.identify("invoice.client.person.name")).toThrow(
      'Path "invoice.client.person.name" has not been registered.',
    );
    expect(() => registry.describe(personNameId)).toThrow('Path id "1" has not been registered.');
  });

  it("clears all registrations and resets id assignment", () => {
    const registry = new PathRegistry();

    registry.register("invoice.client.person.name");
    registry.register("invoice.serial.number");

    registry.clear();

    expect(() => registry.identify("invoice.client.person.name")).toThrow(
      'Path "invoice.client.person.name" has not been registered.',
    );
    expect(registry.register("invoice.client.contact.email")).toBe(1);
  });

  it("rejects empty and malformed paths", () => {
    expect(() => PathRegistry.assertValid("")).toThrow("Path cannot be empty.");
    expect(() => PathRegistry.assertValid(".invoice")).toThrow('Invalid path ".invoice".');
    expect(() => PathRegistry.assertValid("invoice.")).toThrow('Invalid path "invoice.".');
    expect(() => PathRegistry.assertValid("invoice..client")).toThrow('Invalid path "invoice..client".');
  });
});
