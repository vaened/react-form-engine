/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import { InvoiceStructure, sampleInvoice } from "../observation/__fixtures__/invoice";
import { RootObservationRequired, UnknownObservation } from "../observation/errors";
import { type EntryId, PathKind } from "../path/types";
import { type ValueEntry, ValueStore } from "./ValueStore";

describe("ValueStore", () => {
  let form: InvoiceStructure;
  let store: ValueStore;

  beforeEach(() => {
    form = new InvoiceStructure();
    store = new ValueStore(form.index, sampleInvoice(), sampleInvoice());
  });

  /** Everyone the store says has to hear about a write, in the order it says it. */
  const reported = (id: EntryId) => {
    const told: EntryId[] = [];

    store.write(form.index.entry(id), "unused", (entry) => told.push(entry.id));

    return told;
  };

  const named = (id: EntryId) => reported(id).map((entryId) => form.index.describe(entryId));

  describe("root", () => {
    it("is there from the start with nobody above it", () => {
      expect(store.root().parent).toBeNull();
      expect(store.has(form.root)).toBe(true);
    });

    it("cannot stop being watched", () => {
      expect(() => store.dematerialize(form.root)).toThrow(RootObservationRequired);
    });

    it("ignores an attempt to unregister it", () => {
      store.unregister(form.root);

      expect(store.has(form.root)).toBe(true);
    });

    it("exposes the live value and the defaults it started with", () => {
      const initial = sampleInvoice();

      expect(store.value).toEqual(initial);
      expect(store.defaults).toEqual(initial);
    });
  });

  describe("registering fields", () => {
    it("points straight at the root when no node is watched", () => {
      const city = store.register(form.city0);

      expect(city.parent).toBe(store.root());
      expect(reported(form.city0)).toEqual([form.city0, form.root]);
    });

    it("points at the nearest watcher, however deep it sits", () => {
      const client = store.materialize(form.client);
      const city = store.register(form.city0);

      expect(city.parent).toBe(client);
      // The root has no public path of its own, hence the empty one at the end.
      expect(named(form.city0)).toEqual(["invoice.client.addresses.0.city", "invoice.client", ""]);
    });

    it("hands back the same entry when a field registers again", () => {
      expect(store.register(form.city0)).toBe(store.register(form.city0));
    });

    it("takes a field off the chain when it leaves", () => {
      store.register(form.city0);
      store.unregister(form.city0);

      expect(store.has(form.city0)).toBe(false);
    });

    it("ignores a field that was never on the chain", () => {
      expect(() => store.unregister(form.city0)).not.toThrow();
    });
  });

  describe("watching a node", () => {
    let city: ValueEntry;
    let reference: ValueEntry;

    beforeEach(() => {
      city = store.register(form.city0);
      reference = store.register(form.reference0);
    });

    it("takes over the children that used to report further up", () => {
      const address = store.materialize(form.address0);

      expect(city.parent).toBe(address);
      expect(reference.parent).toBe(address);
      expect(address.parent).toBe(store.root());
    });

    it("puts itself between the field and the root when reporting", () => {
      store.materialize(form.address0);

      expect(reported(form.city0)).toEqual([form.city0, form.address0, form.root]);
    });

    it("leaves alone the ones that report to a closer watcher", () => {
      const address = store.materialize(form.address0);

      store.materialize(form.client);

      expect(city.parent).toBe(address);
      expect(reference.parent).toBe(address);
    });

    it("stacks, so a field reports through every watched ancestor", () => {
      store.materialize(form.address0);
      store.materialize(form.client);

      expect(reported(form.city0)).toEqual([form.city0, form.address0, form.client, form.root]);
    });

    it("hands back what is already there when a node is watched twice", () => {
      expect(store.materialize(form.address0)).toBe(store.materialize(form.address0));
    });

    it("counts a field that joins after it is already watched", () => {
      const address = store.materialize(form.address0);
      const later = store.register(form.city1);

      // A different item: it belongs to the array, not to this address.
      expect(later.parent).toBe(store.root());
      expect(store.register(form.reference0).parent).toBe(address);
    });
  });

  describe("no longer watching a node", () => {
    let city: ValueEntry;
    let reference: ValueEntry;
    let address: ValueEntry;

    beforeEach(() => {
      city = store.register(form.city0);
      reference = store.register(form.reference0);
      address = store.materialize(form.address0);
    });

    it("gives every child back to whoever it reported to", () => {
      store.dematerialize(form.address0);

      expect(store.has(form.address0)).toBe(false);
      expect(city.parent).toBe(store.root());
      expect(reference.parent).toBe(store.root());
      expect(reported(form.city0)).toEqual([form.city0, form.root]);
    });

    it("finds its own children, so none can be left reporting into it", () => {
      store.dematerialize(form.address0);

      expect(address.parent).toBeNull();
      expect(reported(form.reference0)).toEqual([form.reference0, form.root]);
    });

    it("hands a middle node's children to the grandparent", () => {
      const client = store.materialize(form.client);

      store.dematerialize(form.address0);

      expect(city.parent).toBe(client);
      expect(reported(form.city0)).toEqual([form.city0, form.client, form.root]);
    });

    it("hands a watched node down when the one above it goes away", () => {
      store.materialize(form.client);
      store.dematerialize(form.client);

      expect(address.parent).toBe(store.root());
      expect(reported(form.city0)).toEqual([form.city0, form.address0, form.root]);
    });
  });

  describe("reporting", () => {
    it("names the written location first and the root last", () => {
      store.register(form.city0);
      store.materialize(form.address0);

      expect(reported(form.city0)).toEqual([form.city0, form.address0, form.root]);
    });

    it("never stops early, unlike the state", () => {
      store.register(form.city0);
      store.materialize(form.address0);
      store.materialize(form.client);

      // Nothing about a value change can leave an ancestor unaffected, so the
      // walk has no reason to stop before the root.
      expect(reported(form.city0)).toEqual([form.city0, form.address0, form.client, form.root]);
    });

    it("reaches the root in one hop when no node is watched", () => {
      store.register(form.city0);

      expect(reported(form.city0)).toEqual([form.city0, form.root]);
    });

    it("can start from a watched node rather than a field", () => {
      store.register(form.city0);
      store.materialize(form.address0);
      store.materialize(form.client);

      expect(reported(form.address0)).toEqual([form.address0, form.client, form.root]);
    });
  });

  /**
   * A value can be written at any height: a whole node, or an array taking and
   * losing items. Those locations are not on the chain unless somebody watches
   * them, so the walk has to be told where to start.
   */
  describe("writing above a field", () => {
    it("reaches a watched ancestor when the array itself is not watched", () => {
      store.register(form.city0);

      const client = store.materialize(form.client);

      expect(store.has(form.addresses)).toBe(false);
      expect(reported(form.addresses)).toEqual([form.client, form.root]);
      expect(client.parent).toBe(store.root());
    });

    it("reaches a watched ancestor when a whole object is set and not watched", () => {
      store.register(form.email);
      store.materialize(form.client);

      expect(store.has(form.address0)).toBe(false);
      expect(reported(form.address0)).toEqual([form.client, form.root]);
    });

    it("reaches the root when not even an ancestor is watched", () => {
      store.register(form.city0);

      expect(reported(form.addresses)).toEqual([form.root]);
      expect(reported(form.client)).toEqual([form.root]);
    });

    it("names the array itself once somebody watches it", () => {
      store.register(form.city0);
      store.materialize(form.addresses);
      store.materialize(form.client);

      expect(reported(form.addresses)).toEqual([form.addresses, form.client, form.root]);
    });

    it("tells a watcher of the array about a write inside one of its items", () => {
      store.register(form.city0);
      store.materialize(form.addresses);

      expect(reported(form.city0)).toEqual([form.city0, form.addresses, form.root]);
    });

    it("reaches a watched ancestor for an item a structural insert just created", () => {
      store.materialize(form.client);

      const inserted = form.index.insert(form.addresses, 2, PathKind.Object);

      expect(store.has(form.addresses)).toBe(false);
      expect(reported(inserted.id)).toEqual([form.client, form.root]);
    });
  });

  describe("more than one watcher on the same location", () => {
    it("keeps reporting to a node while a second watcher is still there", () => {
      store.register(form.city0);
      store.materialize(form.client);
      store.materialize(form.client);

      store.dematerialize(form.client);

      expect(store.has(form.client)).toBe(true);
      expect(reported(form.city0)).toEqual([form.city0, form.client, form.root]);
    });

    it("stops once the last watcher goes", () => {
      store.register(form.city0);
      store.materialize(form.client);
      store.materialize(form.client);

      store.dematerialize(form.client);
      store.dematerialize(form.client);

      expect(store.has(form.client)).toBe(false);
      expect(reported(form.city0)).toEqual([form.city0, form.root]);
    });

    it("keeps a field on the chain while a second one still holds it", () => {
      const city = store.register(form.city0);

      store.register(form.city0);
      store.unregister(form.city0);

      expect(store.has(form.city0)).toBe(true);
      expect(city.parent).toBe(store.root());

      store.unregister(form.city0);

      expect(store.has(form.city0)).toBe(false);
    });

    it("leaves the children of a still watched node where they are", () => {
      const city = store.register(form.city0);
      const address = store.materialize(form.address0);

      store.materialize(form.address0);
      store.dematerialize(form.address0);

      expect(city.parent).toBe(address);
      expect(reported(form.city0)).toEqual([form.city0, form.address0, form.root]);
    });
  });

  describe("writing the live value", () => {
    it("changes the live value at the written location", () => {
      store.write(form.index.entry(form.city0), "Chorrillos", () => {});

      expect(store.value.invoice.client.addresses[0]?.city).toBe("Chorrillos");
    });

    it("leaves the defaults untouched", () => {
      store.write(form.index.entry(form.city0), "Chorrillos", () => {});

      expect(store.defaults.invoice.client.addresses[0]?.city).toBe("Lima");
    });

    it("creates whatever containers a write below the root needs", () => {
      form.index.insert(form.details, 0, PathKind.Object);

      const description = form.index.register("invoice.details.0.description", PathKind.Field);

      store.write(description, "Support renewal", () => {});

      expect(store.value.invoice.details[0]).toMatchObject({ description: "Support renewal" });
    });
  });

  /**
   * What a subscriber compares with `Object.is` against what it read last, to
   * decide whether to re-render.
   */
  describe("snapshots", () => {
    it("reads a field straight from the live value, uncached", () => {
      expect(store.snapshot(form.city0)).toBe("Lima");

      store.write(form.index.entry(form.city0), "Chorrillos", () => {});

      expect(store.snapshot(form.city0)).toBe("Chorrillos");
    });

    it("stays the same reference across reads while nothing below it changed", () => {
      store.materialize(form.client);

      expect(store.snapshot(form.client)).toBe(store.snapshot(form.client));
    });

    it("changes reference once something below it is written", () => {
      store.materialize(form.client);

      const before = store.snapshot(form.client);

      store.write(form.index.entry(form.city0), "Chorrillos", () => {});

      const after = store.snapshot(form.client);

      expect(after).not.toBe(before);
    });

    it("carries correct data for everything below it without cloning it", () => {
      store.materialize(form.client);
      store.write(form.index.entry(form.city0), "Chorrillos", () => {});

      const client = store.snapshot(form.client) as { addresses: { city: string }[] };

      expect(client.addresses[0]?.city).toBe("Chorrillos");
    });

    it("leaves a materialized sibling's snapshot untouched", () => {
      store.materialize(form.client);
      store.materialize(form.details);

      const untouched = store.snapshot(form.details);

      store.write(form.index.entry(form.city0), "Chorrillos", () => {});

      expect(store.snapshot(form.details)).toBe(untouched);
    });

    it("collapses two writes to the same node into a single rebuild", () => {
      store.materialize(form.client);

      store.write(form.index.entry(form.city0), "Chorrillos", () => {});
      store.write(form.index.entry(form.name), "Grace Hopper", () => {});

      const client = store.snapshot(form.client) as { name: string; addresses: { city: string }[] };

      expect(client.name).toBe("Grace Hopper");
      expect(client.addresses[0]?.city).toBe("Chorrillos");
      expect(store.snapshot(form.client)).toBe(client);
    });

    it("returns an array for an array node, not an object with numeric keys", () => {
      store.materialize(form.addresses);

      expect(Array.isArray(store.snapshot(form.addresses))).toBe(true);
    });

    it("builds correctly the first time a node is materialized, before any write", () => {
      store.materialize(form.client);

      expect(store.snapshot(form.client)).toEqual(sampleInvoice().invoice.client);
    });

    it("does not throw when an array node has no value yet", () => {
      const empty = new ValueStore(form.index, {} as never);

      empty.materialize(form.addresses);

      expect(empty.snapshot(form.addresses)).toEqual([]);
    });

    it("does not throw when an object node has no value yet", () => {
      const empty = new ValueStore(form.index, {} as never);

      empty.materialize(form.client);

      expect(empty.snapshot(form.client)).toEqual({});
    });

    it("throws for a node that was never materialized", () => {
      expect(() => store.snapshot(form.client)).toThrow(UnknownObservation);
    });

    it("reads a field that was never registered, same as any other read", () => {
      expect(store.snapshot(form.email)).toBe("ada@example.com");
    });

    it("returns a field's own value by identity, never a copy", () => {
      const attachment = { name: "invoice.pdf" };

      store.write(form.index.entry(form.email), attachment, () => {});

      expect(store.snapshot(form.email)).toBe(attachment);
    });

    describe("the root", () => {
      it("builds and stays stable while nothing changed", () => {
        store.materialize(form.root);

        expect(store.snapshot(form.root)).toBe(store.snapshot(form.root));
      });

      it("changes reference for any write anywhere, since it is always on the chain", () => {
        store.materialize(form.root);

        const before = store.snapshot(form.root);

        store.write(form.index.entry(form.city0), "Chorrillos", () => {});

        expect(store.snapshot(form.root)).not.toBe(before);
      });

      it("carries the same correct nested data as any other materialized node", () => {
        store.materialize(form.root);
        store.write(form.index.entry(form.city0), "Chorrillos", () => {});

        const root = store.snapshot(form.root) as typeof store.value;

        expect(root.invoice.client.addresses[0]?.city).toBe("Chorrillos");
      });
    });

    it("changes every materialized ancestor's reference in one write, and nobody else's", () => {
      store.materialize(form.client);
      store.materialize(form.root);
      store.materialize(form.details);

      const clientBefore = store.snapshot(form.client);
      const rootBefore = store.snapshot(form.root);
      const detailsBefore = store.snapshot(form.details);

      store.write(form.index.entry(form.city0), "Chorrillos", () => {});

      expect(store.snapshot(form.client)).not.toBe(clientBefore);
      expect(store.snapshot(form.root)).not.toBe(rootBefore);
      expect(store.snapshot(form.details)).toBe(detailsBefore);
    });

    it("resets to a fresh snapshot after a node leaves and is materialized again", () => {
      store.materialize(form.client);
      store.snapshot(form.client);

      store.dematerialize(form.client);
      store.materialize(form.client);

      expect(store.snapshot(form.client)).toEqual(sampleInvoice().invoice.client);
    });
  });

  describe("guards", () => {
    it("finds an unknown entry as undefined but requiring it throws", () => {
      expect(store.find(form.city0)).toBeUndefined();
      expect(store.has(form.city0)).toBe(false);
      expect(() => store.entry(form.city0)).toThrow(UnknownObservation);
    });
  });
});
