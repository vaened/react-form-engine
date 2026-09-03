/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { EntryId } from "../path/types";
import {
  DetachedObservationParent,
  DuplicatedObservationChild,
  RootObservationRequired,
  UnexpectedObservationParent,
  UnknownObservation,
} from "./errors";
import { ObservationChain } from "./ObservationChain";

/** Whatever the owner of the chain keeps beside the link is none of its business. */
type Node = {
  readonly id: EntryId;
  parent: Node | null;
  label: string;
};

const ROOT = 0 as EntryId;

describe("ObservationChain", () => {
  let chain: ObservationChain<Node>;

  beforeEach(() => {
    chain = new ObservationChain<Node>({ id: ROOT, parent: null, label: "root" });
  });

  const node = (id: number): Node => ({ id: id as EntryId, parent: null, label: `node-${id}` });

  const join = (id: number, parent: Node): Node => {
    const created = node(id);

    chain.join(created, parent);

    return created;
  };

  const insert = (id: number, parent: Node, children: readonly Node[]): Node => {
    const created = node(id);

    chain.insert(created, parent, children);

    return created;
  };

  /** The way up from a location, which is the only thing the chain exists for. */
  const upward = (from: number) => {
    const walked: number[] = [];

    for (let current = chain.find(from as EntryId); current; current = current.parent ?? undefined) {
      walked.push(current.id as number);
    }

    return walked;
  };

  describe("root", () => {
    it("is on the chain from the start with nobody above it", () => {
      expect(chain.root().parent).toBeNull();
      expect(chain.root().label).toBe("root");
      expect(chain.has(ROOT)).toBe(true);
    });

    it("cannot be removed", () => {
      expect(() => chain.remove(ROOT)).toThrow(RootObservationRequired);
    });

    it("ignores an attempt to make it leave", () => {
      expect(chain.leave(ROOT)).toBeUndefined();
      expect(chain.has(ROOT)).toBe(true);
      expect(chain.root().parent).toBeNull();
    });
  });

  describe("joining", () => {
    it("links to the root while nothing in between is watched", () => {
      const city = join(14, chain.root());

      expect(city.parent).toBe(chain.root());
      expect(upward(14)).toEqual([14, ROOT]);
    });

    it("takes nothing over", () => {
      const city = join(14, chain.root());

      join(15, chain.root());

      expect(chain.find(15 as EntryId)?.parent).toBe(chain.root());
      expect(city.parent).toBe(chain.root());
    });

    it("leaves what the node carries untouched", () => {
      const city = join(14, chain.root());

      expect(city.label).toBe("node-14");
    });
  });

  describe("leaving", () => {
    it("hands back what left, so the caller can settle it", () => {
      const city = join(14, chain.root());

      expect(chain.leave(14 as EntryId)).toBe(city);
      expect(chain.has(14 as EntryId)).toBe(false);
    });

    it("detaches it, so a reference somebody kept leads nowhere", () => {
      const city = join(14, chain.root());

      chain.leave(14 as EntryId);

      expect(city.parent).toBeNull();
      expect(upward(14)).toEqual([]);
    });

    it("hands back nothing for a location that was never on the chain", () => {
      expect(chain.leave(99 as EntryId)).toBeUndefined();
    });
  });

  describe("inserting", () => {
    let city: Node;
    let reference: Node;

    beforeEach(() => {
      city = join(14, chain.root());
      reference = join(15, chain.root());
    });

    it("takes over the children it was given", () => {
      const addresses = insert(12, chain.root(), [city, reference]);

      expect(city.parent).toBe(addresses);
      expect(reference.parent).toBe(addresses);
      expect(addresses.parent).toBe(chain.root());
    });

    it("puts itself in the way up", () => {
      insert(12, chain.root(), [city, reference]);

      expect(upward(14)).toEqual([14, 12, ROOT]);
    });

    it("leaves alone the children it was not given", () => {
      insert(12, chain.root(), [city]);

      expect(reference.parent).toBe(chain.root());
      expect(upward(15)).toEqual([15, ROOT]);
    });

    it("stacks, so the way up passes through every one of them", () => {
      const addresses = insert(12, chain.root(), [city, reference]);

      insert(5, chain.root(), [addresses]);

      expect(upward(14)).toEqual([14, 12, 5, ROOT]);
    });

    it("accepts a node that joins after it is already there", () => {
      const addresses = insert(12, chain.root(), [city]);
      const later = join(17, addresses);

      expect(later.parent).toBe(addresses);
      expect(upward(17)).toEqual([17, 12, ROOT]);
    });
  });

  describe("removing", () => {
    let city: Node;
    let reference: Node;
    let addresses: Node;

    beforeEach(() => {
      city = join(14, chain.root());
      reference = join(15, chain.root());
      addresses = insert(12, chain.root(), [city, reference]);
    });

    it("finds its own children, so none can be left behind", () => {
      chain.remove(12 as EntryId);

      expect(city.parent).toBe(chain.root());
      expect(reference.parent).toBe(chain.root());
      expect(upward(14)).toEqual([14, ROOT]);
      expect(upward(15)).toEqual([15, ROOT]);
    });

    it("hands back what left, detached, and who takes over from it", () => {
      const removal = chain.remove(12 as EntryId);

      expect(removal.node).toBe(addresses);
      expect(removal.parent).toBe(chain.root());
      expect(chain.has(12 as EntryId)).toBe(false);
      expect(addresses.parent).toBeNull();
    });

    it("names every child that changed hands, already relinked", () => {
      const { adopted } = chain.remove(12 as EntryId);

      expect(adopted).toEqual([city, reference]);
      expect(adopted.every((child) => child.parent === chain.root())).toBe(true);
    });

    it("names nobody when it had no children", () => {
      const alone = insert(7, chain.root(), []);

      expect(chain.remove(alone.id).adopted).toEqual([]);
    });

    it("hands a middle one's children to the grandparent", () => {
      const client = insert(5, chain.root(), [addresses]);

      chain.remove(12 as EntryId);

      expect(city.parent).toBe(client);
      expect(reference.parent).toBe(client);
      expect(upward(14)).toEqual([14, 5, ROOT]);
    });

    it("hands a watched node down when the one above it goes", () => {
      insert(5, chain.root(), [addresses]);

      chain.remove(5 as EntryId);

      expect(addresses.parent).toBe(chain.root());
      expect(upward(14)).toEqual([14, 12, ROOT]);
    });

    it("refuses to hand children to something that already left", () => {
      chain.remove(12 as EntryId);

      expect(() => join(17, addresses)).toThrow(DetachedObservationParent);
      expect(() => insert(20, addresses, [])).toThrow(DetachedObservationParent);
    });

    it("throws for a location that was never on the chain", () => {
      expect(() => chain.remove(99 as EntryId)).toThrow(UnknownObservation);
    });
  });

  describe("guards", () => {
    it("finds an unknown location as undefined but requiring it throws", () => {
      expect(chain.find(99 as EntryId)).toBeUndefined();
      expect(chain.has(99 as EntryId)).toBe(false);
      expect(() => chain.node(99 as EntryId)).toThrow(UnknownObservation);
    });

    it("refuses to take a child away from a parent it does not report to", () => {
      const city = join(14, chain.root());
      const addresses = insert(12, chain.root(), []);

      expect(() => insert(5, addresses, [city])).toThrow(UnexpectedObservationParent);
      expect(city.parent).toBe(chain.root());
    });

    it("refuses to take the same child over twice", () => {
      const city = join(14, chain.root());

      expect(() => insert(12, chain.root(), [city, city])).toThrow(DuplicatedObservationChild);
    });

    it("leaves the chain exactly as it was when a list is rejected", () => {
      const city = join(14, chain.root());
      const reference = join(15, chain.root());
      const addresses = insert(12, chain.root(), [city]);

      expect(() => insert(5, addresses, [reference])).toThrow(UnexpectedObservationParent);

      expect(chain.has(5 as EntryId)).toBe(false);
      expect(city.parent).toBe(addresses);
      expect(reference.parent).toBe(chain.root());
    });

    it("refuses to hand a node its own parent as a child, which would close a loop", () => {
      const addresses = insert(12, chain.root(), []);

      expect(() => insert(5, addresses, [chain.root()])).toThrow(UnexpectedObservationParent);
    });
  });
});
