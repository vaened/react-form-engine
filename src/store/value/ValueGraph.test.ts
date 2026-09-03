/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import { InvoiceStructure } from "../observation/__fixtures__/invoice";
import { RootObservationRequired, UnknownObservation } from "../observation/errors";
import type { EntryId } from "../path/types";
import { type ValueEntry, ValueGraph } from "./ValueGraph";

describe("ValueGraph", () => {
  let form: InvoiceStructure;
  let graph: ValueGraph;

  beforeEach(() => {
    form = new InvoiceStructure();
    graph = new ValueGraph(form.index);
  });

  /** Everyone the graph says has to hear about a write, in the order it says it. */
  const reported = (from: EntryId) => {
    const told: EntryId[] = [];

    graph.report(from, (entry) => told.push(entry.id));

    return told;
  };

  const named = (from: EntryId) => reported(from).map((id) => form.index.describe(id));

  describe("root", () => {
    it("is there from the start with nobody above it", () => {
      expect(graph.root().parent).toBeNull();
      expect(graph.has(form.root)).toBe(true);
    });

    it("cannot stop being watched", () => {
      expect(() => graph.dematerialize(form.root)).toThrow(RootObservationRequired);
    });

    it("ignores an attempt to unregister it", () => {
      graph.unregister(form.root);

      expect(graph.has(form.root)).toBe(true);
    });
  });

  describe("registering fields", () => {
    it("points straight at the root when no node is watched", () => {
      const city = graph.register(form.city0);

      expect(city.parent).toBe(graph.root());
      expect(reported(form.city0)).toEqual([form.city0, form.root]);
    });

    it("points at the nearest watcher, however deep it sits", () => {
      const client = graph.materialize(form.client);
      const city = graph.register(form.city0);

      expect(city.parent).toBe(client);
      // The root has no public path of its own, hence the empty one at the end.
      expect(named(form.city0)).toEqual(["invoice.client.addresses.0.city", "invoice.client", ""]);
    });

    it("hands back the same entry when a field registers again", () => {
      expect(graph.register(form.city0)).toBe(graph.register(form.city0));
    });

    it("takes a field off the chain when it leaves", () => {
      graph.register(form.city0);
      graph.unregister(form.city0);

      expect(graph.has(form.city0)).toBe(false);
    });

    it("ignores a field that was never on the chain", () => {
      expect(() => graph.unregister(form.city0)).not.toThrow();
    });
  });

  describe("watching a node", () => {
    let city: ValueEntry;
    let reference: ValueEntry;

    beforeEach(() => {
      city = graph.register(form.city0);
      reference = graph.register(form.reference0);
    });

    it("takes over the children that used to report further up", () => {
      const address = graph.materialize(form.address0);

      expect(city.parent).toBe(address);
      expect(reference.parent).toBe(address);
      expect(address.parent).toBe(graph.root());
    });

    it("puts itself between the field and the root when reporting", () => {
      graph.materialize(form.address0);

      expect(reported(form.city0)).toEqual([form.city0, form.address0, form.root]);
    });

    it("leaves alone the ones that report to a closer watcher", () => {
      const address = graph.materialize(form.address0);

      graph.materialize(form.client);

      expect(city.parent).toBe(address);
      expect(reference.parent).toBe(address);
    });

    it("stacks, so a field reports through every watched ancestor", () => {
      graph.materialize(form.address0);
      graph.materialize(form.client);

      expect(reported(form.city0)).toEqual([form.city0, form.address0, form.client, form.root]);
    });

    it("hands back what is already there when a node is watched twice", () => {
      expect(graph.materialize(form.address0)).toBe(graph.materialize(form.address0));
    });

    it("counts a field that joins after it is already watched", () => {
      const address = graph.materialize(form.address0);
      const later = graph.register(form.city1);

      // A different item: it belongs to the array, not to this address.
      expect(later.parent).toBe(graph.root());
      expect(graph.register(form.reference0).parent).toBe(address);
    });
  });

  describe("no longer watching a node", () => {
    let city: ValueEntry;
    let reference: ValueEntry;
    let address: ValueEntry;

    beforeEach(() => {
      city = graph.register(form.city0);
      reference = graph.register(form.reference0);
      address = graph.materialize(form.address0);
    });

    it("gives every child back to whoever it reported to", () => {
      graph.dematerialize(form.address0);

      expect(graph.has(form.address0)).toBe(false);
      expect(city.parent).toBe(graph.root());
      expect(reference.parent).toBe(graph.root());
      expect(reported(form.city0)).toEqual([form.city0, form.root]);
    });

    it("finds its own children, so none can be left reporting into it", () => {
      graph.dematerialize(form.address0);

      expect(address.parent).toBeNull();
      expect(reported(form.reference0)).toEqual([form.reference0, form.root]);
    });

    it("hands a middle node's children to the grandparent", () => {
      const client = graph.materialize(form.client);

      graph.dematerialize(form.address0);

      expect(city.parent).toBe(client);
      expect(reported(form.city0)).toEqual([form.city0, form.client, form.root]);
    });

    it("hands a watched node down when the one above it goes away", () => {
      graph.materialize(form.client);
      graph.dematerialize(form.client);

      expect(address.parent).toBe(graph.root());
      expect(reported(form.city0)).toEqual([form.city0, form.address0, form.root]);
    });
  });

  describe("reporting", () => {
    it("names the written location first and the root last", () => {
      graph.register(form.city0);
      graph.materialize(form.address0);

      expect(reported(form.city0)).toEqual([form.city0, form.address0, form.root]);
    });

    it("never stops early, unlike the state", () => {
      graph.register(form.city0);
      graph.materialize(form.address0);
      graph.materialize(form.client);

      // Nothing about a value change can leave an ancestor unaffected, so the
      // walk has no reason to stop before the root.
      expect(reported(form.city0)).toEqual([form.city0, form.address0, form.client, form.root]);
    });

    it("reaches the root in one hop when no node is watched", () => {
      graph.register(form.city0);

      expect(reported(form.city0)).toEqual([form.city0, form.root]);
    });

    it("can start from a watched node rather than a field", () => {
      graph.register(form.city0);
      graph.materialize(form.address0);
      graph.materialize(form.client);

      expect(reported(form.address0)).toEqual([form.address0, form.client, form.root]);
    });
  });

  /**
   * A value can be written at any height: a whole node, or an array taking and
   * losing items. Those locations are not on the chain unless somebody watches
   * them, and the walk used to begin nowhere and tell nobody while an ancestor
   * was watching the entire time.
   */
  describe("writing above a field", () => {
    it("reaches a watched ancestor when the array itself is not watched", () => {
      graph.register(form.city0);

      const client = graph.materialize(form.client);

      expect(graph.has(form.addresses)).toBe(false);
      expect(reported(form.addresses)).toEqual([form.client, form.root]);
      expect(client.parent).toBe(graph.root());
    });

    it("reaches a watched ancestor when a whole object is set and not watched", () => {
      graph.register(form.email);
      graph.materialize(form.client);

      expect(graph.has(form.address0)).toBe(false);
      expect(reported(form.address0)).toEqual([form.client, form.root]);
    });

    it("reaches the root when not even an ancestor is watched", () => {
      graph.register(form.city0);

      expect(reported(form.addresses)).toEqual([form.root]);
      expect(reported(form.client)).toEqual([form.root]);
    });

    it("names the array itself once somebody watches it", () => {
      graph.register(form.city0);
      graph.materialize(form.addresses);
      graph.materialize(form.client);

      expect(reported(form.addresses)).toEqual([form.addresses, form.client, form.root]);
    });

    it("tells a watcher of the array about a write inside one of its items", () => {
      graph.register(form.city0);
      graph.materialize(form.addresses);

      expect(reported(form.city0)).toEqual([form.city0, form.addresses, form.root]);
    });
  });

  describe("guards", () => {
    it("finds an unknown entry as undefined but requiring it throws", () => {
      expect(graph.find(form.city0)).toBeUndefined();
      expect(graph.has(form.city0)).toBe(false);
      expect(() => graph.entry(form.city0)).toThrow(UnknownObservation);
    });
  });
});
