/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { EntryId } from "../path/types";
import type { PathId } from "../state/PathRegistry";
import { InvoiceStructure } from "./__fixtures__/invoice";
import { RootHasNoParent, RootObservationRequired, UnknownObservation } from "./errors";
import { ObservationChain } from "./ObservationChain";

/** `label` stands in for whatever an owner keeps beside the link. */
type Node = {
  readonly id: EntryId;
  parent: Node | null;
  label: string;
  listeners?: Set<() => void>;
  path?: PathId<string>;
  claims?: number;
  reporting?: Set<Node>;
};

/** Every subscription here is on one location, so one name is enough to tell them apart. */
const NAMED = 1 as PathId<string>;

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

  /**
   * The chain answers who reports to whom from both ends. Kept at one end and
   * rebuilt at the other, the two could disagree.
   */
  describe("who reports to a node", () => {
    it("is nobody until somebody joins under it", () => {
      expect(insert(form.client, "client").node.reporting).toBeUndefined();
    });

    it("holds the ones that joined under it", () => {
      const client = insert(form.client, "client").node;
      const city = join(form.city0, "city");

      expect([...(client.reporting ?? [])]).toEqual([city]);
    });

    it("lets go of one that left", () => {
      const client = insert(form.client, "client").node;

      join(form.city0, "city");
      drop(form.city0);

      expect([...(client.reporting ?? [])]).toEqual([]);
    });

    /** A node taking a location over takes over what reported past it. */
    it("hands them to the node that takes the location over", () => {
      const client = insert(form.client, "client").node;
      const city = join(form.city0, "city");

      const next = chain.replace(form.client, node(form.client, "otro"));

      expect([...(next.reporting ?? [])]).toEqual([city]);
      expect(client.reporting).toBeUndefined();
      expect(city.parent).toBe(next);
    });

    /** Losing a node hands what reported to it up to whoever it reported to. */
    it("hands them upward when the node in between goes", () => {
      const client = insert(form.client, "client").node;
      const city = join(form.city0, "city");

      drop(form.client);

      expect(city.parent).toBe(chain.root());
      expect([...(chain.root().reporting ?? [])]).toContain(city);
      expect(client.reporting).toBeUndefined();
    });

    /** Three levels on the chain, so reaching the last one takes more than one step down. */
    it("walks down to everyone inside a location, however deep", () => {
      insert(form.client, "client");
      const addresses = insert(form.addresses, "addresses").node;
      const city = join(form.city0, "city");

      expect(city.parent).toBe(addresses);
      expect(chain.descendantsOf(form.client)).toEqual([addresses, city]);
    });
  });

  /**
   * Two ways in, and they must agree: one asks the chain, which only a location
   * on it can answer, and the other asks the shape.
   */
  describe("everyone on the chain inside a location", () => {
    it("comes off the chain when the location is on it, each one under the one it reports to", () => {
      insert(form.client, "client");

      const name = join(form.name, "name");
      const addresses = insert(form.addresses, "addresses").node;
      const city = join(form.city0, "city");

      // A field that reports straight to `client` arrived before the node that
      // sits between `client` and `city`, which the shape has no way to know.
      expect(chain.descendantsOf(form.client)).toEqual([name, addresses, city]);
    });

    it("comes off the shape when the location is not on the chain, missing neither nodes nor fields", () => {
      const addresses = insert(form.addresses, "addresses").node;
      const city = join(form.city0, "city");
      const name = join(form.name, "name");

      expect(chain.has(form.client)).toBe(false);

      const found = chain.descendantsOf(form.client);

      expect(found).toHaveLength(3);
      expect(found).toContain(addresses);
      expect(found).toContain(city);
      expect(found).toContain(name);
    });

    it("finds nobody inside a location nothing watches", () => {
      join(form.email, "email");

      expect(chain.descendantsOf(form.details)).toEqual([]);
    });
  });

  /**
   * A subscription keeps the name it arrived by, because a location can stop
   * being what that name reaches and the listener has to be able to find out.
   */
  describe("the name a listener arrived by", () => {
    it("is remembered on the node it listens to", () => {
      const held = join(form.city0, "city");

      chain.subscribe(held, () => {}, 7 as PathId<string>);

      expect(held.path).toBe(7);
    });

    it("is absent until somebody listens", () => {
      expect(join(form.city0, "city").path).toBeUndefined();
    });

    it("is given up when the last listener leaves", () => {
      const node = join(form.city0, "city");
      const leave = chain.subscribe(node, () => {}, 7 as PathId<string>);
      const stay = chain.subscribe(node, () => {}, 7 as PathId<string>);

      leave();
      expect(node.path).toBe(7);

      stay();
      expect(node.path).toBeUndefined();
    });
  });

  describe("who is waiting to hear about a node", () => {
    it("keeps every listener that joined, in the order they arrived", () => {
      const heard: string[] = [];
      const name = join(form.name, "name");

      chain.subscribe(name, () => heard.push("first"), NAMED);
      chain.subscribe(name, () => heard.push("second"), NAMED);

      for (const listener of name.listeners ?? []) listener();

      expect(heard).toEqual(["first", "second"]);
    });

    it("drops the one that left and nobody else", () => {
      const heard: string[] = [];
      const name = join(form.name, "name");

      const leave = chain.subscribe(name, () => heard.push("gone"), NAMED);
      chain.subscribe(name, () => heard.push("stayed"), NAMED);

      leave();

      for (const listener of name.listeners ?? []) listener();

      expect(heard).toEqual(["stayed"]);
    });

    it("leaving twice is the same as leaving once", () => {
      const name = join(form.name, "name");

      const leave = chain.subscribe(name, () => {}, NAMED);
      chain.subscribe(name, () => {}, NAMED);

      leave();
      leave();

      expect(name.listeners?.size).toBe(1);
    });

    it("waits on nobody else", () => {
      const name = join(form.name, "name");
      const email = join(form.email, "email");

      chain.subscribe(name, () => {}, NAMED);

      expect(email.listeners).toBeUndefined();
    });

    /** Keeping it on the chain belongs to whoever joined it, so this claims nothing. */
    it("waiting on a node does not keep it on the chain", () => {
      const name = join(form.name, "name");

      chain.subscribe(name, () => {}, NAMED);

      expect(chain.remove(name.id)).toBeDefined();
    });
  });

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

    it("detaches it and leaves nothing counted on it, so a reference somebody kept is inert", () => {
      const city = join(form.city0, "city");

      chain.leave(form.city0);

      expect(city.parent).toBeNull();
      expect(city.claims).toBeUndefined();
    });

    it("hands back nothing for a location that was never on the chain", () => {
      expect(chain.leave(form.city0)).toBeUndefined();
    });

    it("stops being heard from by the one it reported to", () => {
      const client = insert(form.client, "client").node;

      join(form.city0, "city");
      chain.leave(form.city0);

      expect([...(client.reporting ?? [])]).toEqual([]);
    });
  });

  /**
   * A location the shape stopped having is not one everybody has to stop asking
   * about: the question itself is gone, so every claim goes at once.
   */
  describe("forgetting a location", () => {
    it("lets go of every claim at once, however many were held", () => {
      const city = join(form.city0, "city");

      join(form.city0, "again");
      insert(form.city0, "and again");

      expect(chain.forget(form.city0)?.node).toBe(city);
      expect(chain.has(form.city0)).toBe(false);
      expect(city.claims).toBeUndefined();
    });

    it("leaves nothing counted behind, so the location starts over", () => {
      join(form.city0, "city");
      join(form.city0, "again");

      chain.forget(form.city0);

      const reborn = join(form.city0, "reborn");

      expect(chain.leave(form.city0)).toBe(reborn);
      expect(chain.has(form.city0)).toBe(false);
    });

    it("hands its children up, the same as any other removal", () => {
      const city = join(form.city0, "city");
      const address = insert(form.address0, "address0").node;

      const removal = chain.forget(form.address0);

      expect(removal?.node).toBe(address);
      expect(removal?.parent).toBe(chain.root());
      expect(removal?.adopted).toEqual([city]);
      expect(city.parent).toBe(chain.root());
      expect(address.parent).toBeNull();
    });

    it("hands back nothing for a location that was never on the chain", () => {
      expect(chain.forget(form.email)).toBeUndefined();
      expect(chain.has(form.email)).toBe(false);
    });

    it("hands back nothing for the root, which no shape stops having", () => {
      expect(chain.forget(form.root)).toBeUndefined();
      expect(chain.has(form.root)).toBe(true);
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

  describe("replacing what occupies a location", () => {
    it("re-parents every child that reported to the one it replaces, not just one", () => {
      insert(form.address0, "address0");

      const city = join(form.city0, "city");
      const reference = join(form.reference0, "reference");

      const next = chain.replace(form.address0, node(form.address0, "reshaped"));

      expect(city.parent).toBe(next);
      expect(reference.parent).toBe(next);
    });

    /** Reported to a watcher and not to the root, so inheriting is not climbing. */
    it("keeps whoever the replaced occupant reported to", () => {
      const client = insert(form.client, "client").node;

      insert(form.address0, "address0");

      const next = chain.replace(form.address0, node(form.address0, "reshaped"));

      expect(next.parent).toBe(client);
    });

    it("is the only one of the two the node above hears from", () => {
      const client = insert(form.client, "client").node;
      const address = insert(form.address0, "address0").node;

      const next = chain.replace(form.address0, node(form.address0, "reshaped"));

      expect([...(client.reporting ?? [])]).toEqual([next]);
      expect(address.parent).toBeNull();
    });

    it("detaches the old occupant and puts the new one on the chain in its place", () => {
      const address = insert(form.address0, "address0").node;

      const next = chain.replace(form.address0, node(form.address0, "reshaped"));

      expect(address.parent).toBeNull();
      expect(chain.node(form.address0)).toBe(next);
    });

    it("leaves an unrelated child untouched", () => {
      insert(form.address0, "address0");
      insert(form.client, "client");

      const untouched = join(form.name, "name");

      chain.replace(form.address0, node(form.address0, "reshaped"));

      expect(untouched.parent?.label).toBe("client");
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
