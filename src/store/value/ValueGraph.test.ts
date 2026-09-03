/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  DetachedObservationParent,
  RootObservationRequired,
  UnexpectedObservationParent,
  UnknownObservation,
} from "../observation/errors";
import type { EntryId } from "../path/types";
import { type ValueEntry, ValueGraph } from "./ValueGraph";

const ROOT = 0 as EntryId;
const id = (value: number) => value as EntryId;

describe("ValueGraph", () => {
  let graph: ValueGraph;

  beforeEach(() => {
    graph = new ValueGraph(ROOT);
  });

  /**
   * Everyone the graph says has to hear about a write, in the order it says it.
   *
   * Resolving the entry here is what the store has to do for real: naming a
   * location that is not on the chain is refused rather than reported as if
   * nobody had to hear about it.
   */
  const reported = (from: EntryId) => {
    const told: EntryId[] = [];

    graph.report(graph.entry(from), (entry) => told.push(entry.id));

    return told;
  };

  describe("root", () => {
    it("is there from the start with nobody above it", () => {
      expect(graph.root().parent).toBeNull();
      expect(graph.has(ROOT)).toBe(true);
    });

    it("cannot stop being watched", () => {
      expect(() => graph.dematerialize(ROOT)).toThrow(RootObservationRequired);
    });

    it("ignores an attempt to unregister it", () => {
      graph.unregister(ROOT);

      expect(graph.has(ROOT)).toBe(true);
      expect(graph.root().parent).toBeNull();
    });
  });

  describe("registering fields", () => {
    it("points straight at the root when no node is watched", () => {
      const city = graph.register(id(14), graph.root());

      expect(city.parent).toBe(graph.root());
      expect(reported(id(14))).toEqual([14, ROOT]);
    });

    it("hands back the same entry when a field registers again", () => {
      const first = graph.register(id(14), graph.root());
      const again = graph.register(id(14), graph.root());

      expect(again).toBe(first);
    });

    it("takes a field off the chain when it leaves", () => {
      graph.register(id(14), graph.root());
      graph.unregister(id(14));

      expect(graph.has(id(14))).toBe(false);
      expect(() => reported(id(14))).toThrow(UnknownObservation);
    });

    it("ignores a field that was never on the chain", () => {
      expect(() => graph.unregister(id(99))).not.toThrow();
    });
  });

  describe("watching a node", () => {
    let city: ValueEntry;
    let reference: ValueEntry;

    beforeEach(() => {
      city = graph.register(id(14), graph.root());
      reference = graph.register(id(15), graph.root());
    });

    it("takes over the children that used to report further up", () => {
      const addresses = graph.materialize(id(12), graph.root(), [city, reference]);

      expect(city.parent).toBe(addresses);
      expect(reference.parent).toBe(addresses);
      expect(addresses.parent).toBe(graph.root());
    });

    it("puts itself between the field and the root when reporting", () => {
      graph.materialize(id(12), graph.root(), [city, reference]);

      expect(reported(id(14))).toEqual([14, 12, ROOT]);
    });

    it("leaves alone the children it was not given", () => {
      graph.materialize(id(12), graph.root(), [city]);

      expect(reference.parent).toBe(graph.root());
      expect(reported(id(15))).toEqual([15, ROOT]);
    });

    it("stacks, so a field reports through every watched ancestor", () => {
      const addresses = graph.materialize(id(12), graph.root(), [city, reference]);

      graph.materialize(id(5), graph.root(), [addresses]);

      expect(reported(id(14))).toEqual([14, 12, 5, ROOT]);
    });

    it("hands back what is already there when a node is watched twice", () => {
      const first = graph.materialize(id(12), graph.root(), [city]);
      const again = graph.materialize(id(12), graph.root(), []);

      expect(again).toBe(first);
      expect(city.parent).toBe(first);
    });

    it("counts a field that joins after it is already watched", () => {
      const addresses = graph.materialize(id(12), graph.root(), [city]);
      const later = graph.register(id(17), addresses);

      expect(later.parent).toBe(addresses);
      expect(reported(id(17))).toEqual([17, 12, ROOT]);
    });
  });

  describe("no longer watching a node", () => {
    let city: ValueEntry;
    let reference: ValueEntry;
    let addresses: ValueEntry;

    beforeEach(() => {
      city = graph.register(id(14), graph.root());
      reference = graph.register(id(15), graph.root());
      addresses = graph.materialize(id(12), graph.root(), [city, reference]);
    });

    it("gives every child back to whoever it reported to", () => {
      graph.dematerialize(id(12));

      expect(graph.has(id(12))).toBe(false);
      expect(city.parent).toBe(graph.root());
      expect(reference.parent).toBe(graph.root());
      expect(reported(id(14))).toEqual([14, ROOT]);
    });

    it("finds its own children, so none can be left reporting into it", () => {
      graph.dematerialize(id(12));

      expect(addresses.parent).toBeNull();
      expect(reported(id(15))).toEqual([15, ROOT]);
    });

    it("hands a middle node's children to the grandparent", () => {
      const client = graph.materialize(id(5), graph.root(), [addresses]);

      graph.dematerialize(id(12));

      expect(city.parent).toBe(client);
      expect(reference.parent).toBe(client);
      expect(reported(id(14))).toEqual([14, 5, ROOT]);
    });

    it("hands a watched node down when the one above it goes away", () => {
      const client = graph.materialize(id(5), graph.root(), [addresses]);

      graph.dematerialize(id(5));

      expect(addresses.parent).toBe(graph.root());
      expect(client.parent).toBeNull();
      expect(reported(id(14))).toEqual([14, 12, ROOT]);
    });

    it("refuses to report through something nobody can reach any more", () => {
      graph.dematerialize(id(12));

      expect(() => graph.materialize(id(20), addresses, [])).toThrow(DetachedObservationParent);
      expect(() => graph.register(id(17), addresses)).toThrow(DetachedObservationParent);
    });
  });

  describe("reporting", () => {
    it("names the written location first and the root last", () => {
      const city = graph.register(id(14), graph.root());

      graph.materialize(id(12), graph.root(), [city]);

      expect(reported(id(14))).toEqual([14, 12, ROOT]);
    });

    it("never stops early, unlike the state", () => {
      const city = graph.register(id(14), graph.root());
      const addresses = graph.materialize(id(12), graph.root(), [city]);

      graph.materialize(id(5), graph.root(), [addresses]);

      // Nothing about a value change can leave an ancestor unaffected, so the
      // walk has no reason to stop before the root.
      expect(reported(id(14))).toEqual([14, 12, 5, ROOT]);
    });

    it("refuses to start from a location that is not on the chain", () => {
      // Saying nobody has to hear about it would be a lie: a structural change
      // to an array nobody watches still reaches every ancestor that does. Where
      // to start is a structural question, and it is answered before getting
      // here rather than swallowed into an empty walk.
      expect(() => reported(id(99))).toThrow(UnknownObservation);
    });

    it("reaches the root in one hop when no node is watched", () => {
      graph.register(id(14), graph.root());

      expect(reported(id(14))).toEqual([14, ROOT]);
    });

    it("can start from a watched node rather than a field", () => {
      const city = graph.register(id(14), graph.root());
      const addresses = graph.materialize(id(12), graph.root(), [city]);

      graph.materialize(id(5), graph.root(), [addresses]);

      expect(reported(id(12))).toEqual([12, 5, ROOT]);
    });
  });

  describe("guards", () => {
    it("finds an unknown entry as undefined but requiring it throws", () => {
      expect(graph.find(id(99))).toBeUndefined();
      expect(graph.has(id(99))).toBe(false);
      expect(() => graph.entry(id(99))).toThrow(UnknownObservation);
    });

    it("refuses to take a child away from a parent it does not report to", () => {
      const city = graph.register(id(14), graph.root());
      const addresses = graph.materialize(id(12), graph.root(), []);

      expect(() => graph.materialize(id(5), addresses, [city])).toThrow(UnexpectedObservationParent);
      expect(city.parent).toBe(graph.root());
    });

    it("leaves the chain untouched when a list is rejected", () => {
      const city = graph.register(id(14), graph.root());
      const reference = graph.register(id(15), graph.root());
      const addresses = graph.materialize(id(12), graph.root(), [city]);

      expect(() => graph.materialize(id(5), addresses, [reference])).toThrow(UnexpectedObservationParent);

      expect(graph.has(id(5))).toBe(false);
      expect(city.parent).toBe(addresses);
      expect(reference.parent).toBe(graph.root());
    });

    it("refuses to hand a node its own parent as a child, which would close a loop", () => {
      const addresses = graph.materialize(id(12), graph.root(), []);

      expect(() => graph.materialize(id(5), addresses, [graph.root()])).toThrow(UnexpectedObservationParent);
    });
  });
});
