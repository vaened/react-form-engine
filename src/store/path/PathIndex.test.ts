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
import { type EntryId, type PathIndexArrayEntry, PathKind } from "./types";

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

  const arrayEntry = (id: EntryId): PathIndexArrayEntry => {
    const entry = index.entry(id);

    if (entry.kind !== PathKind.Array) {
      throw new NotAnArrayEntry(id);
    }

    return entry;
  };

  const registerAddresses = () => {
    const addresses = index.register(ADDRESSES, PathKind.Array);
    const lima = index.register(CITY_0, PathKind.Field);
    const arequipa = index.register(CITY_1, PathKind.Field);

    return { addresses, lima, arequipa };
  };

  describe("replacing one position", () => {
    it("puts another item where one was, without moving what is around it", () => {
      const { addresses, lima, arequipa } = registerAddresses();
      const before = index.composedOf(addresses.id) ?? [];

      const replaced = index.replace(addresses.id, 0, PathKind.Field);

      const after = index.composedOf(addresses.id) ?? [];

      expect(after).toHaveLength(2);
      expect(after[0]).toBe(replaced.id);
      expect(after[1]).toBe(before[1]);
      expect(index.contains(arequipa.id)).toBe(true);
      expect(index.contains(lima.id)).toBe(false);
    });

    it("keeps the positions of everything that stayed", () => {
      const { addresses, arequipa } = registerAddresses();

      index.replace(addresses.id, 0, PathKind.Field);

      expect(index.positionOf(index.entry(arequipa.id).parent?.id ?? arequipa.id)).toBe(1);
    });

    /** One thing happened, so it is said once. */
    it("says it recomposed once, not once per step", () => {
      const { addresses } = registerAddresses();
      const heard: EntryId[] = [];

      index.on("recomposed", (id) => heard.push(id));
      index.replace(addresses.id, 0, PathKind.Field);

      expect(heard).toEqual([addresses.id]);
    });

    it("hands over what left, in one go", () => {
      const { addresses } = registerAddresses();
      const rounds: number[] = [];

      index.on("discarded", (entries) => rounds.push(entries.length));
      index.replace(addresses.id, 0, PathKind.Field);

      expect(rounds).toHaveLength(1);
    });

    it("answers a fresh composition afterwards", () => {
      const { addresses } = registerAddresses();
      const before = index.composedOf(addresses.id);

      index.replace(addresses.id, 0, PathKind.Field);

      expect(index.composedOf(addresses.id)).not.toBe(before);
    });

    it("refuses a position the array does not hold", () => {
      const { addresses } = registerAddresses();

      expect(() => index.replace(addresses.id, 5, PathKind.Field)).toThrow(MissingArrayPosition);
    });
  });

  describe("composition", () => {
    it("answers the entries an array is made of, in their order", () => {
      const { addresses, lima, arequipa } = registerAddresses();

      expect(index.composedOf(addresses.id)).toEqual([
        arrayEntry(addresses.id).children[0].id,
        arrayEntry(addresses.id).children[1].id,
      ]);

      void lima;
      void arequipa;
    });

    it("answers the entries an object is made of", () => {
      const name = index.register("invoice.client.name", PathKind.Field);
      const email = index.register("invoice.client.email", PathKind.Field);

      expect(index.composedOf(index.entry(name.id).parent?.id ?? name.id)).toEqual([name.id, email.id]);
    });

    /** The same question has the same answer while nothing about it changed. */
    it("gives back the very same answer while it goes on being composed of the same", () => {
      const { addresses } = registerAddresses();

      expect(index.composedOf(addresses.id)).toBe(index.composedOf(addresses.id));
    });

    it("answers nothing for an entry that does not exist", () => {
      expect(index.composedOf(9999 as EntryId)).toBeUndefined();
    });

    it("answers nothing twice over, rather than a fresh emptiness each time", () => {
      expect(index.composedOf(9999 as EntryId)).toBe(index.composedOf(9999 as EntryId));
    });

    it("tells an array with no items apart from one that was never registered", () => {
      const addresses = index.register(ADDRESSES, PathKind.Array);

      expect(index.composedOf(addresses.id)).toEqual([]);
      expect(index.composedOf(9999 as EntryId)).toBeUndefined();
    });
  });

  describe("a composition that changed", () => {
    const restructures = (what: string, act: () => EntryId) => {
      it(`answers again after ${what}`, () => {
        const before = index.composedOf(act());
        const heard: EntryId[] = [];

        index.on("recomposed", (id) => heard.push(id));

        const id = act();

        expect(index.composedOf(id)).not.toBe(before);
        expect(heard).toContain(id);
      });
    };

    it("answers again after append", () => {
      const { addresses } = registerAddresses();
      const before = index.composedOf(addresses.id);
      const heard: EntryId[] = [];
      index.on("recomposed", (id) => heard.push(id));

      index.append(addresses.id, PathKind.Object);

      expect(index.composedOf(addresses.id)).not.toBe(before);
      expect(heard).toEqual([addresses.id]);
    });

    it("answers again after insert", () => {
      const { addresses } = registerAddresses();
      const before = index.composedOf(addresses.id);

      index.insert(addresses.id, 0, PathKind.Object);

      expect(index.composedOf(addresses.id)).not.toBe(before);
    });

    it("answers again after remove", () => {
      const { addresses } = registerAddresses();
      const before = index.composedOf(addresses.id);

      index.remove(addresses.id, 0);

      expect(index.composedOf(addresses.id)).not.toBe(before);
    });

    it("answers again after truncate", () => {
      const { addresses } = registerAddresses();
      const before = index.composedOf(addresses.id);

      index.truncate(addresses.id, 1);

      expect(index.composedOf(addresses.id)).not.toBe(before);
    });

    /** move and swap keep every identity and change only where each one sits,
     * which is precisely what a fresh answer has to show. */
    it("answers again after move, with the same identities in another order", () => {
      const { addresses } = registerAddresses();
      const before = index.composedOf(addresses.id);

      index.move(addresses.id, 0, 1);

      const after = index.composedOf(addresses.id);

      expect(after).not.toBe(before);
      expect(after).toEqual([...(before ?? [])].reverse());
    });

    it("answers again after swap", () => {
      const { addresses } = registerAddresses();
      const before = index.composedOf(addresses.id);

      index.swap(addresses.id, 0, 1);

      const after = index.composedOf(addresses.id);

      expect(after).not.toBe(before);
      expect(after).toEqual([...(before ?? [])].reverse());
    });

    it("answers again after a child is registered under it", () => {
      const name = index.register("invoice.client.name", PathKind.Field);
      const client = index.entry(name.id).parent?.id ?? name.id;
      const before = index.composedOf(client);
      const heard: EntryId[] = [];
      index.on("recomposed", (id) => heard.push(id));

      index.register("invoice.client.email", PathKind.Field);

      expect(index.composedOf(client)).not.toBe(before);
      expect(heard).toContain(client);
    });

    /** A field answers for no structure at all, so reopening it is where one
     * starts existing rather than where one changes. */
    it("starts answering once a field of it reopened into a node", () => {
      const client = index.register("invoice.client", PathKind.Field);

      expect(index.composedOf(client.id)).toBeUndefined();

      const heard: EntryId[] = [];
      index.on("recomposed", (id) => heard.push(id));

      const name = index.register("invoice.client.name", PathKind.Field);

      expect(index.composedOf(client.id)).toEqual([name.id]);
      expect(heard).toContain(client.id);
    });

    /** Nothing about the shape changed, so nobody has anything to hear. */
    it("keeps its answer when a path that already exists is registered again", () => {
      const { addresses } = registerAddresses();
      const before = index.composedOf(addresses.id);
      const heard: EntryId[] = [];

      index.on("recomposed", (id) => heard.push(id));
      index.register(CITY_0, PathKind.Field);

      expect(index.composedOf(addresses.id)).toBe(before);
      expect(heard).toEqual([]);
    });

    void restructures;
  });

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

  /**
   * A path string alone can only guess what a location holding others is, and
   * reads a digit as a position. A walk carries what was found there instead,
   * and the guess is left for where nothing was.
   */
  describe("a walk over the path", () => {
    type Keyed = { byYear: Record<string, { total: number }>; rows: string[] };

    let keyed: PathIndex<Keyed>;

    beforeEach(() => {
      keyed = new PathIndex<Keyed>(new PathRegistry<Path<Keyed>>());
    });

    it("takes the location for what was found there, over what the next segment reads like", () => {
      const total = keyed.ensure("byYear.2026.total", PathKind.Field, [
        { segment: "byYear", observed: PathKind.Object },
        { segment: "2026", observed: PathKind.Object },
        { segment: "total", observed: PathKind.Field },
      ]);

      expect(total.parent.kind).toBe(PathKind.Object);
      expect(total.parent.parent?.kind).toBe(PathKind.Object);
      expect(keyed.describe(total.id)).toBe("byYear.2026.total");
    });

    it("holds a list to its positions once the value says it is one", () => {
      expect(() =>
        keyed.ensure("rows.total" as never, PathKind.Field, [
          { segment: "rows", observed: PathKind.Array },
          { segment: "total" },
        ] as never),
      ).toThrow(InvalidArrayIndex);
    });

    it("guesses where the walk found nothing, exactly as a bare path does", () => {
      const guessed = keyed.ensure("byYear.2026.total", PathKind.Field, [
        { segment: "byYear" },
        { segment: "2026" },
        { segment: "total" },
      ]);

      expect(guessed.parent.parent?.kind).toBe(PathKind.Array);
      expect(keyed.ensure("rows.0" as never, PathKind.Field).parent.kind).toBe(PathKind.Array);
    });

    it("guesses where the walk found a value that holds nobody", () => {
      const inside = keyed.ensure("byYear.2026.total", PathKind.Field, [
        { segment: "byYear", observed: PathKind.Field },
        { segment: "2026" },
        { segment: "total" },
      ]);

      expect(inside.parent.parent?.kind).toBe(PathKind.Array);
    });

    it("reopens a field into what the value holds there, not into what sits inside it", () => {
      const byYear = keyed.ensure("byYear", PathKind.Field);

      keyed.ensure("byYear.2026.total", PathKind.Field, [
        { segment: "byYear", observed: PathKind.Object },
        { segment: "2026", observed: PathKind.Object },
        { segment: "total", observed: PathKind.Field },
      ]);

      expect(byYear.kind).toBe(PathKind.Object);
    });

    it("reopens it into a list when that is what the value holds, whatever sits inside it", () => {
      const nested = new PathIndex<{ rows: { city: string }[] }>(new PathRegistry());
      const rows = nested.ensure("rows", PathKind.Field);

      nested.ensure("rows.0.city", PathKind.Field, [
        { segment: "rows", observed: PathKind.Array },
        { segment: "0", observed: PathKind.Object },
        { segment: "city", observed: PathKind.Field },
      ]);

      expect(rows.kind).toBe(PathKind.Array);
    });

    it("leaves the location the walk ends on to whoever asked for it", () => {
      const leaf = keyed.ensure("byYear.2026", PathKind.Object, [
        { segment: "byYear", observed: PathKind.Object },
        { segment: "2026", observed: PathKind.Field },
      ]);

      expect(leaf.kind).toBe(PathKind.Object);
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

    it("tells an array how many positions it has before going on into them", () => {
      const { addresses, lima, arequipa } = registerAddresses();
      const seen: string[] = [];

      index.reconcile(
        addresses.id,
        (field) => seen.push(`field:${field.id}`),
        (array) => seen.push(`array:${array.id}`),
      );

      expect(seen).toEqual([`array:${addresses.id}`, `field:${lima.id}`, `field:${arequipa.id}`]);
    });

    it("reaches every field at any depth, telling each array it passes through", () => {
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

      expect(fields).toEqual([name.id, lima.id, arequipa.id]);
      expect(arrays).toEqual([addresses.id]);
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

  describe("positionOf", () => {
    const items = (array: EntryId) => index.childrenOf(array);

    it("answers where an item sits in its array", () => {
      const { addresses } = registerAddresses();
      const [first, second] = items(addresses.id);

      expect(index.positionOf(first.id)).toBe(0);
      expect(index.positionOf(second.id)).toBe(1);
    });

    it("refuses an entry whose parent is not an array", () => {
      const name = index.register("invoice.client.name", PathKind.Field);

      expect(() => index.positionOf(name.id)).toThrow(NotAnArrayEntry);
    });

    it("refuses the root", () => {
      expect(() => index.positionOf(index.root().id)).toThrow(NotAnArrayEntry);
    });

    it("follows an item across an insert", () => {
      const { addresses } = registerAddresses();
      const [first, second] = items(addresses.id);

      expect(index.positionOf(first.id)).toBe(0);

      index.insert(addresses.id, 0, PathKind.Object);

      expect(index.positionOf(first.id)).toBe(1);
      expect(index.positionOf(second.id)).toBe(2);
    });

    it("follows an item across a remove", () => {
      const { addresses } = registerAddresses();
      const [, second] = items(addresses.id);

      expect(index.positionOf(second.id)).toBe(1);

      index.remove(addresses.id, 0);

      expect(index.positionOf(second.id)).toBe(0);
    });

    it("follows an item across a move", () => {
      const { addresses } = registerAddresses();
      const [first, second] = items(addresses.id);

      expect(index.positionOf(first.id)).toBe(0);

      index.move(addresses.id, 0, 1);

      expect(index.positionOf(first.id)).toBe(1);
      expect(index.positionOf(second.id)).toBe(0);
    });

    it("follows an item across a swap", () => {
      const { addresses } = registerAddresses();
      const [first, second] = items(addresses.id);

      expect(index.positionOf(first.id)).toBe(0);
      expect(index.positionOf(second.id)).toBe(1);

      index.swap(addresses.id, 0, 1);

      expect(index.positionOf(first.id)).toBe(1);
      expect(index.positionOf(second.id)).toBe(0);
    });

    it("stays right when an item lands back where it was remembered", () => {
      const { addresses } = registerAddresses();
      const [first, second] = items(addresses.id);

      expect(index.positionOf(first.id)).toBe(0);
      expect(index.positionOf(second.id)).toBe(1);

      index.swap(addresses.id, 0, 1);
      index.swap(addresses.id, 0, 1);

      expect(index.positionOf(first.id)).toBe(0);
      expect(index.positionOf(second.id)).toBe(1);
    });

    it("refuses an item the array no longer holds", () => {
      const { addresses } = registerAddresses();
      const [first] = items(addresses.id);

      expect(index.positionOf(first.id)).toBe(0);

      index.remove(addresses.id, 0);

      expect(() => index.positionOf(first.id)).toThrow(UnknownEntryId);
    });

    it("refuses every item after the array is cleared", () => {
      const { addresses } = registerAddresses();
      const [first, second] = items(addresses.id);

      expect(index.positionOf(first.id)).toBe(0);

      index.clear(addresses.id);

      expect(() => index.positionOf(first.id)).toThrow(UnknownEntryId);
      expect(() => index.positionOf(second.id)).toThrow(UnknownEntryId);
    });

    it("sees an item appended after it already answered", () => {
      const { addresses } = registerAddresses();
      const [first] = items(addresses.id);

      expect(index.positionOf(first.id)).toBe(0);

      const appended = index.append(addresses.id, PathKind.Object);

      expect(index.positionOf(appended.id)).toBe(2);
    });

    it("sees the positions a gap-filling registration created", () => {
      const { addresses } = registerAddresses();
      const [first] = items(addresses.id);

      expect(index.positionOf(first.id)).toBe(0);

      index.register("invoice.client.addresses.4.city", PathKind.Field);

      expect(index.positionOf(items(addresses.id)[4].id)).toBe(4);
    });

    it("agrees with describe on every item", () => {
      const { addresses } = registerAddresses();

      index.append(addresses.id, PathKind.Object);
      index.insert(addresses.id, 0, PathKind.Object);
      index.swap(addresses.id, 0, 3);
      index.move(addresses.id, 3, 1);

      for (const item of items(addresses.id)) {
        expect(index.describe(item.id)).toBe(`${ADDRESSES}.${index.positionOf(item.id)}`);
      }
    });

    it("looks at the order once, however many items ask afterwards", () => {
      const { addresses } = registerAddresses();
      const order = arrayEntry(addresses.id);

      index.positionOf(order.children[0].id);

      const looked = order.positions;

      for (const item of order.children) {
        index.positionOf(item.id);
      }

      expect(order.positions).toBe(looked);
    });

    it("looks again once the order has changed under it", () => {
      const { addresses } = registerAddresses();
      const order = arrayEntry(addresses.id);

      index.positionOf(order.children[0].id);

      const looked = order.positions;

      index.swap(addresses.id, 0, 1);
      index.positionOf(order.children[0].id);

      expect(order.positions).not.toBe(looked);
    });

    it("answers on an array a field was reopened into", () => {
      const phones = index.register("invoice.client.phones", PathKind.Field);

      index.register("invoice.client.phones.1", PathKind.Field);

      const [first, second] = index.childrenOf(phones.id);

      expect(index.positionOf(first.id)).toBe(0);
      expect(index.positionOf(second.id)).toBe(1);
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
