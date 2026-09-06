/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { Path } from "../../path";
import { PathRegistry } from "../state/PathRegistry";
import {
  InvalidArrayIndex,
  MissingArrayPosition,
  NotAnArrayEntry,
  PathKindConflict,
  UnknownEntryId,
  UnknownPathId,
} from "./errors";
import { PathIndex } from "./PathIndex";
import { type EntryId, PathKind } from "./types";

/** Shape of docs/FormValue.example.json. */
type Invoice = {
  invoice: {
    createdAt: string;
    series: string;
    number: string;
    client: {
      documentNumber: string;
      name: string;
      email: string;
      phones: string[];
      addresses: { city: string; reference: string }[];
    };
    details: { description: string; quantity: number; unitPrice: number; discount: number }[];
  };
};

const ADDRESSES = "invoice.client.addresses";
const CITY_0 = "invoice.client.addresses.0.city";
const CITY_1 = "invoice.client.addresses.1.city";
const REFERENCE_0 = "invoice.client.addresses.0.reference";

describe("PathIndex", () => {
  let index: PathIndex<Invoice>;

  beforeEach(() => {
    index = new PathIndex<Invoice>(new PathRegistry<Path<Invoice>>());
  });

  const registerAddresses = () => {
    const addresses = index.register(ADDRESSES, PathKind.Array);
    const lima = index.register(CITY_0, PathKind.Field);
    const arequipa = index.register(CITY_1, PathKind.Field);

    return { addresses, lima, arequipa };
  };

  describe("registration", () => {
    it("builds the whole branch and returns the leaf", () => {
      const name = index.register("invoice.client.name", PathKind.Field);

      expect(name.kind).toBe(PathKind.Field);
      expect(name.segment).toBe("name");
      expect(index.describe(name.id)).toBe("invoice.client.name");
    });

    it("returns the same entry when the same path is registered twice", () => {
      const first = index.register("invoice.client.name", PathKind.Field);
      const second = index.register("invoice.client.name", PathKind.Field);

      expect(second).toBe(first);
    });

    it("infers an array node when the next segment is an index", () => {
      index.register(CITY_0, PathKind.Field);

      const addresses = index.resolve(ADDRESSES as Path<Invoice>);

      expect(addresses).toBeUndefined();
      expect(index.register(ADDRESSES, PathKind.Array).kind).toBe(PathKind.Array);
    });

    it("does not give a segment to an array item, because its name is its position", () => {
      const { lima } = registerAddresses();
      const item = lima.parent;

      expect(item.segment).toBeNull();
      expect(item.parent?.segment).toBe("addresses");
    });

    it("rejects a kind that contradicts the registered one", () => {
      index.register("invoice.client.name", PathKind.Field);

      expect(() => index.register("invoice.client.name", PathKind.Object)).toThrow(PathKindConflict);
    });

    it("accepts consecutive positions", () => {
      index.register("invoice.client.phones.0", PathKind.Field);

      expect(() => index.register("invoice.client.phones.1", PathKind.Field)).not.toThrow();
    });
  });

  describe("gap filling", () => {
    it("fills the gap when a path claims a position beyond the end", () => {
      const addresses = index.register(ADDRESSES, PathKind.Array);
      const far = index.register("invoice.client.addresses.5.city", PathKind.Field);

      expect(index.childrenOf(addresses.id)).toHaveLength(6);
      expect(index.describe(far.id)).toBe("invoice.client.addresses.5.city");
    });

    it("creates the filled positions as real childless entries", () => {
      const addresses = index.register(ADDRESSES, PathKind.Array);

      index.register("invoice.client.addresses.3.city", PathKind.Field);

      const [first] = index.childrenOf(addresses.id);

      expect(first.kind).toBe(PathKind.Object);
      expect(first.segment).toBeNull();
      expect(index.childrenOf(first.id)).toEqual([]);
    });

    it("attaches to a filled entry later without changing its id", () => {
      const addresses = index.register(ADDRESSES, PathKind.Array);

      index.register("invoice.client.addresses.3.city", PathKind.Field);

      const skipped = index.childrenOf(addresses.id)[1];
      const identity = skipped.id;
      const city = index.register("invoice.client.addresses.1.city", PathKind.Field);

      expect(city.parent).toBe(skipped);
      expect(skipped.id).toBe(identity);
    });

    it("moves a filled position like any other item", () => {
      const addresses = index.register(ADDRESSES, PathKind.Array);
      const city = index.register("invoice.client.addresses.2.city", PathKind.Field);

      index.move(addresses.id, 2, 0);

      expect(index.describe(city.id)).toBe("invoice.client.addresses.0.city");
    });

    it("locks the item kind for the whole array", () => {
      index.register("invoice.client.addresses.2.city", PathKind.Field);

      expect(() => index.register("invoice.client.addresses.0", PathKind.Field)).toThrow(PathKindConflict);
    });

    it("rejects an index that cannot be represented exactly, which would fill forever", () => {
      index.register(ADDRESSES, PathKind.Array);

      expect(() => index.register("invoice.client.addresses.99999999999999999999.city", PathKind.Field)).toThrow(
        InvalidArrayIndex,
      );
    });
  });

  describe("opening a field", () => {
    it("turns it into an object when something registers a named child", () => {
      const client = index.register("invoice.client", PathKind.Field);
      const name = index.register("invoice.client.name", PathKind.Field);

      expect(client.kind).toBe(PathKind.Object);
      expect(name.parent).toBe(client);
      expect(index.childrenOf(client.id)).toEqual([name]);
    });

    it("turns it into an array when what registers inside is a position", () => {
      const addresses = index.register(ADDRESSES, PathKind.Field);
      const city = index.register(CITY_0, PathKind.Field);

      expect(addresses.kind).toBe(PathKind.Array);
      expect(index.childrenOf(addresses.id)).toEqual([city.parent]);
      expect(index.describe(city.id)).toBe(CITY_0);
    });

    it("keeps its identity, so the state and the value keyed by it survive", () => {
      const client = index.register("invoice.client", PathKind.Field);
      const identity = client.id;

      index.register("invoice.client.name", PathKind.Field);

      expect(client.id).toBe(identity);
      expect(index.entry(identity)).toBe(client);
    });

    it("keeps the routes that were anchored on it resolving", () => {
      const client = index.register("invoice.client", PathKind.Field);

      index.register("invoice.client.name", PathKind.Field);

      expect(index.resolve("invoice.client")).toBe(client);
      expect(index.resolve("invoice.client.name")).toBe(index.childrenOf(client.id)[0]);
    });

    it("opens as many levels as the path needs in one registration", () => {
      const client = index.register("invoice.client", PathKind.Field);
      const city = index.register(CITY_0, PathKind.Field);

      expect(client.kind).toBe(PathKind.Object);
      expect(index.describe(city.id)).toBe(CITY_0);
      expect(index.ancestorsOf(city.id)).toContain(client);
    });

    it("leaves a field alone while nothing registers inside it", () => {
      const client = index.register("invoice.client", PathKind.Field);

      expect(client.kind).toBe(PathKind.Field);
      expect(index.childrenOf(client.id)).toEqual([]);
    });

    it("still refuses to register the same path as two different things", () => {
      index.register("invoice.client.name", PathKind.Field);

      expect(() => index.register("invoice.client.name", PathKind.Object)).toThrow(PathKindConflict);
    });
  });

  describe("resolution", () => {
    it("resolves a path that crosses no array", () => {
      const name = index.register("invoice.client.name", PathKind.Field);

      expect(index.resolve("invoice.client.name")).toBe(name);
    });

    it("resolves a path that crosses an array", () => {
      const { lima, arequipa } = registerAddresses();

      expect(index.resolve(CITY_0)).toBe(lima);
      expect(index.resolve(CITY_1)).toBe(arequipa);
    });

    it("returns undefined for an unregistered path", () => {
      expect(index.resolve("invoice.series")).toBeUndefined();
    });

    it("locates a registered path id without going through the string", () => {
      const registry = new PathRegistry<Path<Invoice>>();
      const scoped = new PathIndex<Invoice>(registry);
      const city = scoped.register(CITY_0, PathKind.Field);

      expect(scoped.locate(registry.identify(CITY_0))).toBe(city);
    });

    it("rejects a path id the registry knows but the index never routed", () => {
      const registry = new PathRegistry<Path<Invoice>>();
      const scoped = new PathIndex<Invoice>(registry);

      // A Control interns alias paths through the registry without registering
      // them in the index, so a path id can exist with no route behind it.
      const orphan = registry.register("invoice.series");

      expect(() => scoped.locate(orphan)).toThrow(UnknownPathId);
    });

    it("follows the live occupant after a move when located by id", () => {
      const registry = new PathRegistry<Path<Invoice>>();
      const scoped = new PathIndex<Invoice>(registry);
      const addresses = scoped.register(ADDRESSES, PathKind.Array);

      scoped.register(CITY_0, PathKind.Field);

      const arequipa = scoped.register(CITY_1, PathKind.Field);
      const pathId = registry.identify(CITY_0);

      scoped.move(addresses.id, 1, 0);

      expect(scoped.locate(pathId)).toBe(arequipa);
    });
  });

  describe("navigation", () => {
    it("walks up to the ancestors by reference", () => {
      const { lima, addresses } = registerAddresses();
      const ancestors = index.ancestorsOf(lima.id);

      expect(ancestors.map((entry) => entry.segment)).toEqual([null, "addresses", "client", "invoice", null]);
      expect(ancestors[1]).toBe(addresses);
    });

    it("lists the children of an array in order", () => {
      const { addresses, lima, arequipa } = registerAddresses();
      const items = index.childrenOf(addresses.id);

      expect(items).toEqual([lima.parent, arequipa.parent]);
    });

    it("collects descendants split by kind", () => {
      index.register(CITY_0, PathKind.Field);
      index.register(REFERENCE_0, PathKind.Field);

      const addresses = index.register(ADDRESSES, PathKind.Array);
      const { nodes, fields } = index.descendantsOf(addresses.id);

      expect(nodes).toHaveLength(1);
      expect(fields.map((field) => field.segment)).toEqual(["city", "reference"]);
    });
  });

  describe("ensure", () => {
    it("returns an existing location untouched, whatever kind is asked for", () => {
      const client = index.register("invoice.client", PathKind.Object);

      const reached = index.ensure("invoice.client", PathKind.Field);

      expect(reached).toBe(client);
      expect(reached.kind).toBe(PathKind.Object);
    });

    it("reaches a location nobody named, created on the way to a descendant", () => {
      const name = index.register("invoice.client.name", PathKind.Field);

      expect(index.ensure("invoice.client", PathKind.Field)).toBe(name.parent);
    });

    it("creates with the kind it is given when nothing is there yet", () => {
      const created = index.ensure("invoice.client.email", PathKind.Field);

      expect(created.kind).toBe(PathKind.Field);
      expect(index.describe(created.id)).toBe("invoice.client.email");
    });

    it("refuses nothing, where registering the same thing would conflict", () => {
      index.register("invoice.client", PathKind.Object);

      expect(() => index.ensure("invoice.client", PathKind.Field)).not.toThrow();
      expect(() => index.register("invoice.client", PathKind.Field)).toThrow(PathKindConflict);
    });
  });

  describe("reconcile", () => {
    it("reports a field to onField, and never touches onArray", () => {
      const name = index.register("invoice.client.name", PathKind.Field);
      const fields: EntryId[] = [];
      const arrays: EntryId[] = [];

      index.reconcile(
        name.id,
        (field) => fields.push(field.id),
        (array) => arrays.push(array.id),
      );

      expect(fields).toEqual([name.id]);
      expect(arrays).toEqual([]);
    });

    it("reports an array to onArray without descending into its items", () => {
      const { addresses } = registerAddresses();
      const fields: EntryId[] = [];
      const arrays: EntryId[] = [];

      index.reconcile(
        addresses.id,
        (field) => fields.push(field.id),
        (array) => arrays.push(array.id),
      );

      expect(arrays).toEqual([addresses.id]);
      expect(fields).toEqual([]);
    });

    it("descends through objects at any depth, stopping only at a field or an array", () => {
      const name = index.register("invoice.client.name", PathKind.Field);
      const { addresses, lima, arequipa } = registerAddresses();
      const client = index.register("invoice.client", PathKind.Object);
      const fields: EntryId[] = [];
      const arrays: EntryId[] = [];

      index.reconcile(
        client.id,
        (field) => fields.push(field.id),
        (array) => arrays.push(array.id),
      );

      expect(fields).toEqual([name.id]);
      expect(arrays).toEqual([addresses.id]);
      expect(fields).not.toContain(lima.id);
      expect(fields).not.toContain(arequipa.id);
    });
  });

  describe("move", () => {
    it("keeps the routes correct without touching them", () => {
      const { addresses, lima, arequipa } = registerAddresses();

      index.move(addresses.id, 1, 0);

      expect(index.resolve(CITY_0)).toBe(arequipa);
      expect(index.resolve(CITY_1)).toBe(lima);
    });

    it("preserves the identity of the moved item", () => {
      const { addresses, lima } = registerAddresses();
      const identity = lima.id;

      index.move(addresses.id, 1, 0);

      expect(index.entry(identity)).toBe(lima);
      expect(lima.id).toBe(identity);
    });

    it("moves the public path of the item, not its identity", () => {
      const { addresses, lima } = registerAddresses();

      expect(index.describe(lima.id)).toBe(CITY_0);

      index.move(addresses.id, 1, 0);

      expect(index.describe(lima.id)).toBe(CITY_1);
    });

    it("survives a swap the same way", () => {
      const { addresses, lima, arequipa } = registerAddresses();

      index.swap(addresses.id, 0, 1);

      expect(index.resolve(CITY_0)).toBe(arequipa);
      expect(index.resolve(CITY_1)).toBe(lima);
      expect(index.entry(lima.id)).toBe(lima);
      expect(index.describe(lima.id)).toBe(CITY_1);
      expect(index.describe(arequipa.id)).toBe(CITY_0);
    });
  });

  describe("scalar arrays", () => {
    const PHONES = "invoice.client.phones";

    it("keeps identity when scalar items move", () => {
      const phones = index.register(PHONES, PathKind.Array);
      const first = index.register("invoice.client.phones.0", PathKind.Field);
      const second = index.register("invoice.client.phones.1", PathKind.Field);

      index.move(phones.id, 1, 0);

      expect(index.resolve("invoice.client.phones.0")).toBe(second);
      expect(index.describe(first.id)).toBe("invoice.client.phones.1");
    });

    it("removes a scalar item without touching its siblings", () => {
      const phones = index.register(PHONES, PathKind.Array);
      const first = index.register("invoice.client.phones.0", PathKind.Field);
      const second = index.register("invoice.client.phones.1", PathKind.Field);

      index.remove(phones.id, 0);

      expect(index.contains(first.id)).toBe(false);
      expect(index.contains(second.id)).toBe(true);
      expect(index.describe(second.id)).toBe("invoice.client.phones.0");
    });
  });

  describe("guards", () => {
    const UNKNOWN = 9999 as EntryId;

    it("exposes the root as the only parentless entry", () => {
      const name = index.register("invoice.client.name", PathKind.Field);

      expect(index.root().parent).toBeNull();
      expect(index.ancestorsOf(name.id).at(-1)).toBe(index.root());
    });

    it("reports the structural parent of an entry", () => {
      const { lima } = registerAddresses();

      expect(index.parentOf(lima.id)).toBe(lima.parent);
      expect(index.parentOf(index.root().id)).toBeNull();
    });

    it("finds an unknown entry as undefined but requiring it throws", () => {
      expect(index.find(UNKNOWN)).toBeUndefined();
      expect(index.contains(UNKNOWN)).toBe(false);
      expect(() => index.entry(UNKNOWN)).toThrow(UnknownEntryId);
    });

    it("rejects a structural operation on something that is not an array", () => {
      const name = index.register("invoice.client.name", PathKind.Field);

      expect(() => index.move(name.id, 0, 0)).toThrow(NotAnArrayEntry);
      expect(() => index.insert(name.id, 0, PathKind.Field)).toThrow(NotAnArrayEntry);
    });

    it("rejects a position outside the array", () => {
      const { addresses } = registerAddresses();

      expect(() => index.move(addresses.id, 0, 5)).toThrow(MissingArrayPosition);
      expect(() => index.remove(addresses.id, 7)).toThrow(MissingArrayPosition);
      expect(() => index.swap(addresses.id, 0, 4)).toThrow(MissingArrayPosition);
      expect(() => index.insert(addresses.id, 9, PathKind.Object)).toThrow(MissingArrayPosition);
    });

    /**
     * A position is a place in the order, so anything that is not one has no
     * place to be. `NaN` compares false against every bound, and a fraction sits
     * between two positions rather than on one.
     */
    it("rejects a position that is not a whole number", () => {
      const { addresses } = registerAddresses();

      expect(() => index.remove(addresses.id, Number.NaN)).toThrow(MissingArrayPosition);
      expect(() => index.remove(addresses.id, 0.5)).toThrow(MissingArrayPosition);
      expect(() => index.move(addresses.id, Number.NaN, 1)).toThrow(MissingArrayPosition);
      expect(() => index.move(addresses.id, 0, 1.5)).toThrow(MissingArrayPosition);
      expect(() => index.swap(addresses.id, Number.NaN, 1)).toThrow(MissingArrayPosition);
      expect(() => index.insert(addresses.id, 0.5, PathKind.Object)).toThrow(MissingArrayPosition);
    });

    it("leaves the order untouched when it refuses one", () => {
      const { addresses } = registerAddresses();
      const order = index.childrenOf(addresses.id);

      expect(() => index.remove(addresses.id, Number.NaN)).toThrow(MissingArrayPosition);
      expect(() => index.swap(addresses.id, Number.NaN, 1)).toThrow(MissingArrayPosition);

      expect(index.childrenOf(addresses.id)).toEqual(order);
    });
  });

  describe("insert", () => {
    it("shifts the occupants without reassigning any identity", () => {
      const { addresses, lima, arequipa } = registerAddresses();

      const inserted = index.insert(addresses.id, 0, PathKind.Object);

      expect(index.childrenOf(addresses.id)).toEqual([inserted, lima.parent, arequipa.parent]);
      expect(index.entry(lima.id)).toBe(lima);
      expect(index.describe(lima.id)).toBe(CITY_1);
    });

    it("appends at the end", () => {
      const { addresses } = registerAddresses();

      const appended = index.append(addresses.id, PathKind.Object);

      expect(index.childrenOf(addresses.id)[2]).toBe(appended);
    });
  });

  describe("remove", () => {
    it("promotes the next occupant into the freed position", () => {
      const { addresses, lima, arequipa } = registerAddresses();

      index.remove(addresses.id, 0);

      expect(index.resolve(CITY_0)).toBe(arequipa);
      expect(index.contains(lima.id)).toBe(false);
    });

    it("forgets the whole removed subtree", () => {
      const { addresses, lima } = registerAddresses();
      const reference = index.register(REFERENCE_0, PathKind.Field);
      const item = lima.parent;

      index.remove(addresses.id, 0);

      expect(index.contains(item.id)).toBe(false);
      expect(index.contains(lima.id)).toBe(false);
      expect(index.contains(reference.id)).toBe(false);
    });

    it("resolves to nothing for a position that no longer exists, rather than throwing", () => {
      const { addresses } = registerAddresses();

      index.remove(addresses.id, 1);

      expect(index.resolve(CITY_1)).toBeUndefined();
    });
  });

  /**
   * Emptying an array is one thing that happens, not one thing repeated: taking
   * the items out one at a time shifts the order on every step and wakes every
   * listener once per item.
   */
  describe("clear", () => {
    it("leaves the array holding nothing", () => {
      const { addresses } = registerAddresses();

      index.clear(addresses.id);

      expect(index.childrenOf(addresses.id)).toEqual([]);
    });

    it("forgets every item and everything under it", () => {
      const { addresses, lima, arequipa } = registerAddresses();
      const reference = index.register(REFERENCE_0, PathKind.Field);
      const item = lima.parent;

      index.clear(addresses.id);

      expect(index.contains(item.id)).toBe(false);
      expect(index.contains(lima.id)).toBe(false);
      expect(index.contains(arequipa.id)).toBe(false);
      expect(index.contains(reference.id)).toBe(false);
    });

    it("says what went once, however many items went", () => {
      const { addresses, lima, arequipa } = registerAddresses();
      const rounds: number[] = [];

      index.on("discarded", (entries) => rounds.push(entries.length));

      index.clear(addresses.id);

      expect(rounds).toHaveLength(1);
      expect(rounds[0]).toBe(index.descendantsOf(addresses.id).fields.length + 4);
      expect(index.contains(lima.id)).toBe(false);
      expect(index.contains(arequipa.id)).toBe(false);
    });

    it("says nothing about an array that was already empty", () => {
      const addresses = index.register(ADDRESSES, PathKind.Array);
      const rounds: number[] = [];

      index.on("discarded", (entries) => rounds.push(entries.length));

      index.clear(addresses.id);

      expect(rounds).toEqual([]);
    });

    it("refuses on something that is not an array", () => {
      const name = index.register("invoice.client.name", PathKind.Field);

      expect(() => index.clear(name.id)).toThrow(NotAnArrayEntry);
    });
  });

  describe("re-registration after a structural change", () => {
    it("rebuilds the branch when the route outlived its entries", () => {
      const { addresses, lima } = registerAddresses();

      index.remove(addresses.id, 0);

      const rebuilt = index.register(CITY_0, PathKind.Field);

      expect(index.contains(lima.id)).toBe(false);
      expect(rebuilt.id).not.toBe(lima.id);
      expect(index.resolve(CITY_0)).toBe(rebuilt);
    });

    it("restores a position that had been emptied entirely", () => {
      const addresses = index.register(ADDRESSES, PathKind.Array);

      index.register(CITY_0, PathKind.Field);
      index.remove(addresses.id, 0);

      expect(index.childrenOf(addresses.id)).toEqual([]);

      const rebuilt = index.register(CITY_0, PathKind.Field);

      expect(index.childrenOf(addresses.id)).toHaveLength(1);
      expect(index.describe(rebuilt.id)).toBe(CITY_0);
    });

    it("rebuilds when the anchor itself was destroyed", () => {
      type Rows = { invoice: { rows: { tags: { label: string }[] }[] } };

      const nested = new PathIndex<Rows>(new PathRegistry<Path<Rows>>());
      const rows = nested.register("invoice.rows", PathKind.Array);
      const label = nested.register("invoice.rows.0.tags.0.label", PathKind.Field);
      const tags = nested.register("invoice.rows.0.tags", PathKind.Array);

      nested.remove(rows.id, 0);

      expect(nested.contains(tags.id)).toBe(false);

      const rebuilt = nested.register("invoice.rows.0.tags.0.label", PathKind.Field);

      expect(rebuilt.id).not.toBe(label.id);
      expect(nested.describe(rebuilt.id)).toBe("invoice.rows.0.tags.0.label");
    });

    it("resolves a positional route to nothing until the new occurrence is registered", () => {
      const { addresses } = registerAddresses();

      index.insert(addresses.id, 0, PathKind.Object);

      expect(index.resolve(CITY_0)).toBeUndefined();
    });

    it("repairs a positional route after an insert pushed a new occurrence in front", () => {
      const { addresses, lima } = registerAddresses();
      const inserted = index.insert(addresses.id, 0, PathKind.Object);
      const rebuilt = index.register(CITY_0, PathKind.Field);

      expect(rebuilt.parent).toBe(inserted);
      expect(rebuilt.id).not.toBe(lima.id);
      expect(index.resolve(CITY_0)).toBe(rebuilt);
    });

    it("leaves the shifted occurrence untouched while the route is repaired", () => {
      const { addresses, lima } = registerAddresses();

      index.insert(addresses.id, 0, PathKind.Object);
      index.register(CITY_0, PathKind.Field);

      expect(index.contains(lima.id)).toBe(true);
      expect(index.describe(lima.id)).toBe(CITY_1);
      expect(index.resolve(CITY_1)).toBe(lima);
    });

    it("still returns the same entry when nothing changed", () => {
      const { lima } = registerAddresses();

      expect(index.register(CITY_0, PathKind.Field)).toBe(lima);
    });

    it("does not rebuild when another item merely took the position", () => {
      const { addresses, lima, arequipa } = registerAddresses();

      index.move(addresses.id, 1, 0);

      expect(index.register(CITY_0, PathKind.Field)).toBe(arequipa);
      expect(index.contains(lima.id)).toBe(true);
    });
  });

  describe("nested arrays", () => {
    type Matrix = { invoice: { grid: number[][]; rows: { tags: { label: string }[] }[] } };

    let nested: PathIndex<Matrix>;

    beforeEach(() => {
      nested = new PathIndex<Matrix>(new PathRegistry<Path<Matrix>>());
    });

    it("resolves an array of arrays with consecutive positional steps", () => {
      nested.register("invoice.grid.0.0", PathKind.Field);

      const cell = nested.register("invoice.grid.0.1", PathKind.Field);
      const inner = nested.register("invoice.grid.0", PathKind.Array);

      expect(inner.segment).toBeNull();
      expect(inner.kind).toBe(PathKind.Array);
      expect(nested.resolve("invoice.grid.0.1")).toBe(cell);
      expect(nested.describe(cell.id)).toBe("invoice.grid.0.1");
    });

    it("keeps the inner array correct when the outer one moves", () => {
      nested.register("invoice.grid.0.0", PathKind.Field);
      const second = nested.register("invoice.grid.1.0", PathKind.Field);
      const grid = nested.register("invoice.grid", PathKind.Array);

      nested.move(grid.id, 1, 0);

      expect(nested.resolve("invoice.grid.0.0")).toBe(second);
      expect(nested.describe(second.id)).toBe("invoice.grid.0.0");
    });

    it("keeps a named array inside an unnamed item", () => {
      nested.register("invoice.rows.0.tags.0.label", PathKind.Field);

      const label = nested.register("invoice.rows.0.tags.1.label", PathKind.Field);
      const tags = nested.register("invoice.rows.0.tags", PathKind.Array);
      const rows = nested.register("invoice.rows", PathKind.Array);

      expect(tags.segment).toBe("tags");
      expect(tags.parent.segment).toBeNull();

      nested.register("invoice.rows.1.tags.0.label", PathKind.Field);
      nested.move(rows.id, 1, 0);

      expect(nested.describe(label.id)).toBe("invoice.rows.1.tags.1.label");
    });
  });
});
