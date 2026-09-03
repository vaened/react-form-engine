/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { EntryId } from "../path/types";
import { InvoiceStructure } from "./__fixtures__/invoice";
import { RootHasNoParent, RootObservationRequired, UnknownObservation } from "./errors";
import { ObservationChain } from "./ObservationChain";

/** `label` stands in for whatever an owner keeps beside the link. */
type Node = {
  readonly id: EntryId;
  parent: Node | null;
  label: string;
};

describe("ObservationChain", () => {
  let form: InvoiceStructure;
  let chain: ObservationChain<Node>;

  beforeEach(() => {
    form = new InvoiceStructure();
    chain = new ObservationChain<Node>(form.index, { id: form.root, parent: null, label: "invoice" });
  });

  const node = (id: EntryId, label: string): Node => ({ id, parent: null, label });

  const join = (id: EntryId, label: string) => chain.join(node(id, label));

  const insert = (id: EntryId, label: string) => chain.insert(node(id, label));

  /** Removing what is on the chain, which every one of these has just put there. */
  const drop = (id: EntryId) => {
    const removal = chain.remove(id);

    if (!removal) {
      throw new Error(`entry ${id as number} was still claimed`);
    }

    return removal;
  };

  const upward = (from: EntryId) => {
    const walked: string[] = [];

    for (let at: Node | null = chain.originOf(from); at; at = at.parent) {
      walked.push(at.label);
    }

    return walked;
  };

  describe("root", () => {
    it("is on the chain from the start with nobody above it", () => {
      expect(chain.root().parent).toBeNull();
      expect(chain.has(form.root)).toBe(true);
    });

    it("cannot be removed", () => {
      expect(() => chain.remove(form.root)).toThrow(RootObservationRequired);
    });

    it("has nothing above it to report to", () => {
      expect(() => chain.parentOf(form.root)).toThrow(RootHasNoParent);
    });

    it("ignores an attempt to make it leave", () => {
      expect(chain.leave(form.root)).toBeUndefined();
      expect(chain.has(form.root)).toBe(true);
    });
  });

  describe("the climb", () => {
    it("reaches the root in one hop when nothing in between is watched", () => {
      expect(chain.parentOf(form.city0)).toBe(chain.root());
    });

    it("stops at the nearest watcher, however many levels up it is", () => {
      join(form.city0, "city");

      const client = insert(form.client, "client").node;

      expect(chain.parentOf(form.city0)).toBe(client);
      expect(chain.parentOf(form.reference0)).toBe(client);
    });

    it("prefers the closest one when several above are watched", () => {
      insert(form.client, "client");

      const address = insert(form.address0, "address0").node;

      expect(chain.parentOf(form.city0)).toBe(address);
    });

    it("answers with the location itself when it is already on the chain", () => {
      const city = join(form.city0, "city");

      expect(chain.originOf(form.city0)).toBe(city);
    });

    it("climbs from a location nobody watches, which is never on the chain", () => {
      join(form.city0, "city");

      const client = insert(form.client, "client").node;

      expect(chain.has(form.addresses)).toBe(false);
      expect(chain.originOf(form.addresses)).toBe(client);
      expect(chain.originOf(form.address0)).toBe(client);
    });

    it("climbs to the root when not even an ancestor is watched", () => {
      expect(chain.originOf(form.addresses)).toBe(chain.root());
      expect(chain.originOf(form.details)).toBe(chain.root());
    });
  });

  describe("joining", () => {
    it("hangs off the root while nothing in between is watched", () => {
      const city = join(form.city0, "city");

      expect(city.parent).toBe(chain.root());
      expect(upward(form.city0)).toEqual(["city", "invoice"]);
    });

    it("hangs off a watcher that is already there", () => {
      const client = insert(form.client, "client").node;
      const city = join(form.city0, "city");

      expect(city.parent).toBe(client);
      expect(upward(form.city0)).toEqual(["city", "client", "invoice"]);
    });

    it("takes nothing over", () => {
      const city = join(form.city0, "city");

      join(form.reference0, "reference");

      expect(city.parent).toBe(chain.root());
    });

    it("leaves what the node carries untouched", () => {
      expect(join(form.city0, "city").label).toBe("city");
    });
  });

  describe("leaving", () => {
    it("hands back what left, so the caller can settle it", () => {
      const city = join(form.city0, "city");

      expect(chain.leave(form.city0)).toBe(city);
      expect(chain.has(form.city0)).toBe(false);
    });

    it("detaches it, so a reference somebody kept leads nowhere", () => {
      const city = join(form.city0, "city");

      chain.leave(form.city0);

      expect(city.parent).toBeNull();
    });

    it("hands back nothing for a location that was never on the chain", () => {
      expect(chain.leave(form.city0)).toBeUndefined();
    });
  });

  describe("inserting", () => {
    let city: Node;
    let reference: Node;

    beforeEach(() => {
      city = join(form.city0, "city");
      reference = join(form.reference0, "reference");
    });

    it("claims the members that now belong under it", () => {
      const { node: address, claimed } = insert(form.address0, "address0");

      expect(claimed).toEqual([city, reference]);
      expect(city.parent).toBe(address);
      expect(reference.parent).toBe(address);
      expect(address.parent).toBe(chain.root());
    });

    it("puts itself in the way up", () => {
      insert(form.address0, "address0");

      expect(upward(form.city0)).toEqual(["city", "address0", "invoice"]);
    });

    it("stacks, so the way up passes through every watcher", () => {
      insert(form.address0, "address0");
      insert(form.client, "client");

      expect(upward(form.city0)).toEqual(["city", "address0", "client", "invoice"]);
    });

    it("leaves alone the ones that report to a closer watcher", () => {
      const address = insert(form.address0, "address0").node;
      const { claimed } = insert(form.client, "client");

      // Both already report to `address0`, so they are not `client`'s to take.
      expect(claimed).toEqual([address]);
      expect(city.parent).toBe(address);
      expect(reference.parent).toBe(address);
    });

    it("claims nothing when nothing below it is watched", () => {
      expect(insert(form.details, "details").claimed).toEqual([]);
    });

    it("never claims something outside its own branch", () => {
      const email = join(form.email, "email");
      const { claimed } = insert(form.address0, "address0");

      expect(claimed).not.toContain(email);
      expect(email.parent).toBe(chain.root());
    });
  });

  describe("removing", () => {
    let city: Node;
    let reference: Node;
    let address: Node;

    beforeEach(() => {
      city = join(form.city0, "city");
      reference = join(form.reference0, "reference");
      address = insert(form.address0, "address0").node;
    });

    it("finds its own children, so none can be left behind", () => {
      drop(form.address0);

      expect(city.parent).toBe(chain.root());
      expect(reference.parent).toBe(chain.root());
      expect(upward(form.city0)).toEqual(["city", "invoice"]);
    });

    it("hands back what left, detached, and who takes over from it", () => {
      const removal = drop(form.address0);

      expect(removal.node).toBe(address);
      expect(removal.parent).toBe(chain.root());
      expect(address.parent).toBeNull();
      expect(chain.has(form.address0)).toBe(false);
    });

    it("names every child that changed hands, already relinked", () => {
      const { adopted } = drop(form.address0);

      expect(adopted).toEqual([city, reference]);
      expect(adopted.every((child) => child.parent === chain.root())).toBe(true);
    });

    it("names nobody when it had no children", () => {
      insert(form.details, "details");

      expect(drop(form.details).adopted).toEqual([]);
    });

    it("hands a middle one's children to the grandparent", () => {
      const client = insert(form.client, "client").node;

      drop(form.address0);

      expect(city.parent).toBe(client);
      expect(reference.parent).toBe(client);
      expect(upward(form.city0)).toEqual(["city", "client", "invoice"]);
    });

    it("hands a watcher down when the one above it goes", () => {
      insert(form.client, "client");
      drop(form.client);

      expect(address.parent).toBe(chain.root());
      expect(upward(form.city0)).toEqual(["city", "address0", "invoice"]);
    });

    it("throws for a location that was never on the chain", () => {
      expect(() => chain.remove(form.email)).toThrow(UnknownObservation);
    });
  });

  describe("counting watchers", () => {
    it("keeps one node however many times it is joined", () => {
      const first = join(form.city0, "city");
      const second = join(form.city0, "other");

      expect(second).toBe(first);
      expect(second.label).toBe("city");
    });

    it("stays on the chain until the last one leaves", () => {
      const city = join(form.city0, "city");

      join(form.city0, "again");

      expect(chain.leave(form.city0)).toBeUndefined();
      expect(chain.has(form.city0)).toBe(true);
      expect(city.parent).toBe(chain.root());

      expect(chain.leave(form.city0)).toBe(city);
      expect(chain.has(form.city0)).toBe(false);
      expect(city.parent).toBeNull();
    });

    it("claims nothing the second time a node is inserted", () => {
      const city = join(form.city0, "city");
      const first = insert(form.address0, "address0");
      const again = insert(form.address0, "again");

      expect(again.node).toBe(first.node);
      expect(again.claimed).toEqual([]);
      expect(city.parent).toBe(first.node);
    });

    it("holds a node's children while somebody still watches it", () => {
      const city = join(form.city0, "city");
      const address = insert(form.address0, "address0").node;

      insert(form.address0, "again");

      expect(chain.remove(form.address0)).toBeUndefined();
      expect(chain.has(form.address0)).toBe(true);
      expect(city.parent).toBe(address);
      expect(upward(form.city0)).toEqual(["city", "address0", "invoice"]);
    });

    it("hands the children back once the last one lets go", () => {
      const city = join(form.city0, "city");

      insert(form.address0, "address0");
      insert(form.address0, "again");

      chain.remove(form.address0);

      expect(drop(form.address0).adopted).toEqual([city]);
      expect(city.parent).toBe(chain.root());
    });

    it("starts over when a node joins again after leaving", () => {
      join(form.city0, "city");
      chain.leave(form.city0);

      const reborn = join(form.city0, "reborn");

      expect(reborn.label).toBe("reborn");
      expect(chain.leave(form.city0)).toBe(reborn);
      expect(chain.has(form.city0)).toBe(false);
    });

    it("ignores letting go of something that already left", () => {
      join(form.city0, "city");
      chain.leave(form.city0);

      expect(chain.leave(form.city0)).toBeUndefined();
      expect(chain.has(form.city0)).toBe(false);
    });

    it("counts join and insert on the same location together", () => {
      const city = join(form.city0, "city");

      insert(form.city0, "watched too");

      expect(chain.leave(form.city0)).toBeUndefined();
      expect(chain.leave(form.city0)).toBe(city);
    });
  });

  describe("guards", () => {
    it("finds an unknown location as undefined but requiring it throws", () => {
      expect(chain.find(form.email)).toBeUndefined();
      expect(chain.has(form.email)).toBe(false);
      expect(() => chain.node(form.email)).toThrow(UnknownObservation);
    });
  });

  describe("carrying whatever the owner needs", () => {
    it("never looks at anything but the id and the link", () => {
      const counters = new ObservationChain<{ id: EntryId; parent: null; hits: number }>(form.index, {
        id: form.root,
        parent: null,
        hits: 0,
      });

      counters.root().hits += 1;

      expect(counters.root().hits).toBe(1);
    });
  });
});
