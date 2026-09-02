/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { EntryId } from "../path/types";
import {
  DetachedStateParent,
  DuplicatedStateChild,
  RootStateRequired,
  StateKindConflict,
  UnexpectedStateParent,
  UnknownStateEntry,
} from "./errors";
import { StateAggregate } from "./StateAggregate";
import { hasFlag, StateFlag } from "./StateFlag";
import { StateGraph } from "./StateGraph";
import type { StateFieldEntry, StateNodeEntry } from "./types";

const { Dirty, Touched, Invalid } = StateFlag;

const ROOT = 0 as EntryId;
const id = (value: number) => value as EntryId;

describe("StateGraph", () => {
  let graph: StateGraph;

  beforeEach(() => {
    graph = new StateGraph(ROOT);
  });

  const has = (entry: { flags: number }, flag: StateFlag) => hasFlag(entry.flags, flag);

  describe("root", () => {
    it("exists from the start with nothing on it", () => {
      expect(graph.root().flags).toBe(0);
      expect(graph.root().aggregate).toEqual(new StateAggregate());
      expect(graph.root().parent).toBeNull();
    });

    it("cannot be dematerialized", () => {
      expect(() => graph.dematerialize(ROOT)).toThrow(RootStateRequired);
    });
  });

  describe("registering fields", () => {
    it("reports straight to the root when nothing else is materialized", () => {
      const field = graph.register(id(1), graph.root());

      expect(field.parent).toBe(graph.root());
      expect(field.flags).toBe(0);
      expect(graph.root().flags).toBe(0);
    });

    it("counts a field that is born carrying flags", () => {
      graph.register(id(1), graph.root(), { flags: Dirty });

      expect(graph.root().aggregate.dirty).toBe(1);
      expect(has(graph.root(), Dirty)).toBe(true);
    });

    it("keeps the state a field already had when it registers again", () => {
      const field = graph.register(id(1), graph.root());

      graph.update(graph.field(id(1)), { flags: Touched, errors: ["obligatorio"] });

      const again = graph.register(id(1), graph.root());

      expect(again).toBe(field);
      expect(again.flags).toBe(Touched);
      expect(again.errors).toEqual(["obligatorio"]);
      expect(graph.root().aggregate.touched).toBe(1);
    });

    it("rejects reading a field as if it were a node", () => {
      graph.register(id(1), graph.root());

      expect(() => graph.dematerialize(id(1))).toThrow(StateKindConflict);
    });

    it("rejects updating something that was never registered", () => {
      expect(() => graph.update(graph.field(id(9)), { flags: Dirty })).toThrow(UnknownStateEntry);
    });
  });

  describe("updating a field", () => {
    beforeEach(() => {
      graph.register(id(1), graph.root());
    });

    it("carries the flag up to the root", () => {
      graph.update(graph.field(id(1)), { flags: Touched });

      expect(has(graph.root(), Touched)).toBe(true);
      expect(graph.root().aggregate.touched).toBe(1);
    });

    it("takes the flag away again when the field loses it", () => {
      graph.update(graph.field(id(1)), { flags: Touched });
      graph.update(graph.field(id(1)), { flags: 0 });

      expect(graph.root().flags).toBe(0);
      expect(graph.root().aggregate.touched).toBe(0);
    });

    it("keeps errors on the field and never on the node above", () => {
      graph.update(graph.field(id(1)), { flags: Invalid, errors: ["requerido", "muy corto"] });

      expect((graph.entry(id(1)) as StateFieldEntry).errors).toEqual(["requerido", "muy corto"]);
      expect(has(graph.root(), Invalid)).toBe(true);
      expect(graph.root()).not.toHaveProperty("errors");
    });

    it("does nothing above when the flags land on the same value", () => {
      graph.update(graph.field(id(1)), { flags: Touched });
      graph.update(graph.field(id(1)), { flags: Touched });

      expect(graph.root().aggregate.touched).toBe(1);
    });
  });

  describe("the cut", () => {
    let client: StateNodeEntry;

    beforeEach(() => {
      const first = graph.register(id(1), graph.root());
      const second = graph.register(id(2), graph.root());

      graph.register(id(3), graph.root());
      client = graph.materialize(id(10), graph.root(), [first, second, graph.entry(id(3))]);
    });

    it("stops at the first ancestor whose public flags did not change", () => {
      graph.update(graph.field(id(1)), { flags: Touched });

      expect(client.aggregate.touched).toBe(1);
      expect(graph.root().aggregate.touched).toBe(1);

      graph.update(graph.field(id(2)), { flags: Touched });

      expect(client.aggregate.touched).toBe(2);
      expect(graph.root().aggregate.touched).toBe(1);
    });

    it("still keeps counting so the flag survives until the last child drops it", () => {
      graph.update(graph.field(id(1)), { flags: Touched });
      graph.update(graph.field(id(2)), { flags: Touched });
      graph.update(graph.field(id(1)), { flags: 0 });

      expect(client.aggregate.touched).toBe(1);
      expect(has(client, Touched)).toBe(true);
      expect(has(graph.root(), Touched)).toBe(true);

      graph.update(graph.field(id(2)), { flags: 0 });

      expect(has(client, Touched)).toBe(false);
      expect(has(graph.root(), Touched)).toBe(false);
    });

    it("reaches the root again when a different flag appears", () => {
      graph.update(graph.field(id(1)), { flags: Touched });
      graph.update(graph.field(id(2)), { flags: Touched | Dirty });

      expect(graph.root().aggregate.touched).toBe(1);
      expect(has(graph.root(), Dirty)).toBe(true);
    });
  });

  describe("materializing", () => {
    it("takes the children over and counts as a single contributor above", () => {
      const first = graph.register(id(1), graph.root(), { flags: Touched });
      const second = graph.register(id(2), graph.root(), { flags: Touched });
      const third = graph.register(id(3), graph.root(), { flags: Touched });

      expect(graph.root().aggregate.touched).toBe(3);

      const client = graph.materialize(id(10), graph.root(), [first, second, third]);

      expect(client.aggregate.touched).toBe(3);
      expect(graph.root().aggregate.touched).toBe(1);
      expect(has(graph.root(), Touched)).toBe(true);
    });

    it("re-points the children it took over", () => {
      const field = graph.register(id(1), graph.root());
      const client = graph.materialize(id(10), graph.root(), [field]);

      expect(field.parent).toBe(client);
      expect(client.parent).toBe(graph.root());
    });

    it("routes later updates through the new node", () => {
      const field = graph.register(id(1), graph.root());
      const client = graph.materialize(id(10), graph.root(), [field]);

      graph.update(graph.field(id(1)), { flags: Dirty });

      expect(client.aggregate.dirty).toBe(1);
      expect(graph.root().aggregate.dirty).toBe(1);
    });

    it("stacks, so a node reports to the nearest materialized ancestor", () => {
      const field = graph.register(id(1), graph.root(), { flags: Dirty });
      const client = graph.materialize(id(10), graph.root(), [field]);
      const invoice = graph.materialize(id(20), graph.root(), [client]);

      expect(client.parent).toBe(invoice);
      expect(invoice.parent).toBe(graph.root());
      expect(invoice.aggregate.dirty).toBe(1);
      expect(graph.root().aggregate.dirty).toBe(1);

      graph.update(graph.field(id(1)), { flags: 0 });

      expect(has(client, Dirty)).toBe(false);
      expect(has(invoice, Dirty)).toBe(false);
      expect(has(graph.root(), Dirty)).toBe(false);
    });

    it("returns what is already there when a node is materialized twice", () => {
      const field = graph.register(id(1), graph.root(), { flags: Touched });
      const first = graph.materialize(id(10), graph.root(), [field]);
      const again = graph.materialize(id(10), graph.root(), []);

      expect(again).toBe(first);
      expect(again.aggregate.touched).toBe(1);
    });

    it("leaves the root untouched when the children carry nothing", () => {
      const field = graph.register(id(1), graph.root());

      graph.materialize(id(10), graph.root(), [field]);

      expect(graph.root().flags).toBe(0);
      expect(graph.root().aggregate).toEqual(new StateAggregate());
    });
  });

  describe("dematerializing", () => {
    it("gives the children back and keeps the totals right", () => {
      const first = graph.register(id(1), graph.root(), { flags: Touched });
      const second = graph.register(id(2), graph.root(), { flags: Touched });
      const client = graph.materialize(id(10), graph.root(), [first, second]);

      expect(graph.root().aggregate.touched).toBe(1);

      graph.dematerialize(id(10));

      expect(graph.has(id(10))).toBe(false);
      expect(first.parent).toBe(graph.root());
      expect(second.parent).toBe(graph.root());
      expect(graph.root().aggregate.touched).toBe(2);
      expect(has(graph.root(), Touched)).toBe(true);
      expect(client.parent).toBe(graph.root());
    });

    it("routes later updates straight to the root again", () => {
      const field = graph.register(id(1), graph.root());

      graph.materialize(id(10), graph.root(), [field]);
      graph.dematerialize(id(10));
      graph.update(graph.field(id(1)), { flags: Dirty });

      expect(graph.root().aggregate.dirty).toBe(1);
    });

    it("clears the flag above once its last contributor is unregistered", () => {
      const field = graph.register(id(1), graph.root(), { flags: Invalid });

      graph.materialize(id(10), graph.root(), [field]);
      graph.unregister(id(1));
      graph.dematerialize(id(10));

      expect(graph.root().flags).toBe(0);
    });

    it("hands back a child that carries flags instead of dropping what it holds", () => {
      const field = graph.register(id(1), graph.root(), { flags: Invalid });

      graph.materialize(id(10), graph.root(), [field]);
      graph.dematerialize(id(10));

      expect(field.parent).toBe(graph.root());
      expect(graph.root().aggregate.invalid).toBe(1);
      expect(has(graph.root(), Invalid)).toBe(true);
    });
  });

  describe("unregistering", () => {
    it("discounts the field from everyone above", () => {
      graph.register(id(1), graph.root(), { flags: Touched });
      graph.register(id(2), graph.root(), { flags: Touched });

      graph.unregister(id(1));

      expect(graph.has(id(1))).toBe(false);
      expect(graph.root().aggregate.touched).toBe(1);
      expect(has(graph.root(), Touched)).toBe(true);

      graph.unregister(id(2));

      expect(graph.root().flags).toBe(0);
    });

    it("discounts through a materialized node", () => {
      const field = graph.register(id(1), graph.root(), { flags: Dirty });
      const client = graph.materialize(id(10), graph.root(), [field]);

      graph.unregister(id(1));

      expect(client.aggregate.dirty).toBe(0);
      expect(has(client, Dirty)).toBe(false);
      expect(has(graph.root(), Dirty)).toBe(false);
    });

    it("ignores a field that was never registered", () => {
      expect(() => graph.unregister(id(9))).not.toThrow();
      expect(graph.root().flags).toBe(0);
    });
  });

  describe("joining a node that is already materialized", () => {
    let client: StateNodeEntry;

    beforeEach(() => {
      client = graph.materialize(id(10), graph.root(), []);
    });

    it("counts a field that mounts underneath it afterwards", () => {
      const field = graph.register(id(1), client, { flags: Touched });

      expect(field.parent).toBe(client);
      expect(client.aggregate.touched).toBe(1);
      expect(has(graph.root(), Touched)).toBe(true);
    });

    it("routes its later updates through the node", () => {
      graph.register(id(1), client);
      graph.update(graph.field(id(1)), { flags: Dirty });

      expect(client.aggregate.dirty).toBe(1);
      expect(graph.root().aggregate.dirty).toBe(1);

      graph.update(graph.field(id(1)), { flags: 0 });

      expect(client.flags).toBe(0);
      expect(graph.root().flags).toBe(0);
    });

    it("discounts it from the node when it unregisters", () => {
      graph.register(id(1), client, { flags: Invalid });
      graph.register(id(2), client, { flags: Invalid });

      graph.unregister(id(1));

      expect(client.aggregate.invalid).toBe(1);
      expect(has(graph.root(), Invalid)).toBe(true);
    });
  });

  describe("deep chains", () => {
    let field: StateFieldEntry;
    let sibling: StateFieldEntry;
    let client: StateNodeEntry;
    let invoice: StateNodeEntry;

    beforeEach(() => {
      field = graph.register(id(1), graph.root());
      sibling = graph.register(id(2), graph.root());
      client = graph.materialize(id(10), graph.root(), [field, sibling]);
      invoice = graph.materialize(id(20), graph.root(), [client]);
    });

    it("cuts at the middle node without disturbing the ones above", () => {
      graph.update(graph.field(id(1)), { flags: Touched });

      expect(invoice.aggregate.touched).toBe(1);
      expect(graph.root().aggregate.touched).toBe(1);

      graph.update(graph.field(id(2)), { flags: Touched });

      expect(client.aggregate.touched).toBe(2);
      expect(invoice.aggregate.touched).toBe(1);
      expect(graph.root().aggregate.touched).toBe(1);
    });

    it("hands a node down to the grandparent when the one above it goes away", () => {
      graph.update(graph.field(id(1)), { flags: Dirty });
      graph.dematerialize(id(20));

      expect(client.parent).toBe(graph.root());
      expect(graph.root().aggregate.dirty).toBe(1);

      graph.update(graph.field(id(2)), { flags: Invalid });

      expect(has(client, Invalid)).toBe(true);
      expect(has(graph.root(), Invalid)).toBe(true);
    });

    it("finds every one of its children, so none can be left behind carrying flags", () => {
      graph.update(graph.field(id(2)), { flags: Touched });
      graph.dematerialize(id(10));

      expect(field.parent).toBe(invoice);
      expect(sibling.parent).toBe(invoice);
      expect(invoice.aggregate.touched).toBe(1);
      expect(has(graph.root(), Touched)).toBe(true);
    });

    it("hands a middle node's children to the grandparent when it goes away", () => {
      graph.update(graph.field(id(1)), { flags: Dirty });
      graph.dematerialize(id(10));

      expect(field.parent).toBe(invoice);
      expect(sibling.parent).toBe(invoice);
      expect(invoice.aggregate.dirty).toBe(1);
      expect(has(graph.root(), Dirty)).toBe(true);

      graph.update(graph.field(id(1)), { flags: 0 });

      expect(invoice.flags).toBe(0);
      expect(graph.root().flags).toBe(0);
    });
  });

  describe("guards", () => {
    it("finds an unknown entry as undefined but requiring it throws", () => {
      expect(graph.find(id(9))).toBeUndefined();
      expect(graph.has(id(9))).toBe(false);
      expect(() => graph.entry(id(9))).toThrow(UnknownStateEntry);
    });

    it("refuses to update a node as if it were a field", () => {
      graph.materialize(id(10), graph.root(), []);

      expect(() => graph.update(graph.field(id(10)), { flags: Dirty })).toThrow(StateKindConflict);
      expect(() => graph.unregister(id(10))).toThrow(StateKindConflict);
    });

    it("refuses to materialize over a field", () => {
      graph.register(id(1), graph.root());

      expect(() => graph.materialize(id(1), graph.root(), [])).toThrow(StateKindConflict);
    });

    it("leaves the errors alone when an update brings none, so typing does not touch them", () => {
      const field = graph.register(id(1), graph.root());

      graph.update(field, { flags: Invalid, errors: ["requerido"] });
      graph.update(field, { flags: Invalid | Touched });

      expect(field.errors).toEqual(["requerido"]);
    });

    it("clears the errors when an update brings an empty collection", () => {
      const field = graph.register(id(1), graph.root());

      graph.update(field, { flags: Invalid, errors: ["requerido"] });
      graph.update(field, { flags: 0, errors: [] });

      expect(field.errors).toEqual([]);
      expect(graph.root().flags).toBe(0);
    });

    it("hands every field the same empty collection instead of one each", () => {
      const first = graph.register(id(1), graph.root());
      const second = graph.register(id(2), graph.root());

      expect(first.errors).toBe(second.errors);
    });

    it("refuses to discount a contributor twice", () => {
      const first = graph.register(id(1), graph.root(), { flags: Touched });
      const second = graph.register(id(2), graph.root(), { flags: Touched });
      const client = graph.materialize(id(10), graph.root(), [first, second]);

      expect(() => graph.materialize(id(20), client, [first, first])).toThrow(DuplicatedStateChild);
      expect(client.aggregate.touched).toBe(2);
    });

    it("refuses to take a child away from a parent it does not report to", () => {
      const field = graph.register(id(1), graph.root(), { flags: Touched });
      const client = graph.materialize(id(10), graph.root(), []);

      expect(() => graph.materialize(id(20), client, [field])).toThrow(UnexpectedStateParent);
      expect(field.parent).toBe(graph.root());
      expect(graph.root().aggregate.touched).toBe(1);
    });

    it("refuses to make a parent out of a node that was dematerialized", () => {
      const client = graph.materialize(id(10), graph.root(), []);

      graph.dematerialize(id(10));

      expect(() => graph.register(id(1), client)).toThrow(DetachedStateParent);
      expect(() => graph.materialize(id(20), client, [])).toThrow(DetachedStateParent);
    });

    it("refuses to hand a node its own parent as a child, which would close a loop", () => {
      const client = graph.materialize(id(10), graph.root(), []);

      expect(() => graph.materialize(id(20), client, [graph.root()])).toThrow(UnexpectedStateParent);
    });

    it("makes an update through an unregistered field inert", () => {
      const field = graph.register(id(1), graph.root(), { flags: Touched });

      graph.register(id(2), graph.root(), { flags: Touched });
      graph.unregister(id(1));

      expect(graph.root().aggregate.touched).toBe(1);

      graph.update(field, { flags: 0 });
      graph.update(field, { flags: Touched });

      expect(graph.root().aggregate.touched).toBe(1);
      expect(has(graph.root(), Touched)).toBe(true);
    });
  });
});
