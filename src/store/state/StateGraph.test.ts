/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import { InvoiceStructure } from "../observation/__fixtures__/invoice";
import { RootObservationRequired, UnknownObservation } from "../observation/errors";
import { StateKindConflict } from "./errors";
import { StateAggregate } from "./StateAggregate";
import { hasFlag, StateFlag } from "./StateFlag";
import { StateGraph } from "./StateGraph";
import type { StateFieldEntry, StateNodeEntry } from "./types";

const { Dirty, Touched, Invalid } = StateFlag;

describe("StateGraph", () => {
  let form: InvoiceStructure;
  let graph: StateGraph;

  beforeEach(() => {
    form = new InvoiceStructure();
    graph = new StateGraph(form.index);
  });

  const has = (entry: { flags: number }, flag: StateFlag) => hasFlag(entry.flags, flag);

  describe("root", () => {
    it("exists from the start with nothing on it", () => {
      expect(graph.root().flags).toBe(0);
      expect(graph.root().aggregate).toEqual(new StateAggregate());
      expect(graph.root().parent).toBeNull();
    });

    it("cannot be dematerialized", () => {
      expect(() => graph.dematerialize(form.root)).toThrow(RootObservationRequired);
    });
  });

  describe("registering fields", () => {
    it("reports straight to the root when nothing else is materialized", () => {
      const field = graph.register(form.city0);

      expect(field.parent).toBe(graph.root());
      expect(field.flags).toBe(0);
      expect(graph.root().flags).toBe(0);
    });

    it("finds the nearest materialized ancestor, however deep it sits", () => {
      const client = graph.materialize(form.client);
      const field = graph.register(form.city0);

      expect(field.parent).toBe(client);
    });

    it("counts a field that is born carrying flags", () => {
      graph.register(form.city0, { flags: Dirty });

      expect(graph.root().aggregate.dirty).toBe(1);
      expect(has(graph.root(), Dirty)).toBe(true);
    });

    it("keeps the state a field already had when it registers again", () => {
      const field = graph.register(form.city0);

      graph.update(graph.field(form.city0), { flags: Touched, errors: ["obligatorio"] });

      const again = graph.register(form.city0);

      expect(again).toBe(field);
      expect(again.flags).toBe(Touched);
      expect(again.errors).toEqual(["obligatorio"]);
      expect(graph.root().aggregate.touched).toBe(1);
    });

    it("rejects reading a field as if it were a node", () => {
      graph.register(form.city0);

      expect(() => graph.dematerialize(form.city0)).toThrow(StateKindConflict);
    });

    it("rejects updating something that was never registered", () => {
      expect(() => graph.update(graph.field(form.city0), { flags: Dirty })).toThrow(UnknownObservation);
    });
  });

  describe("updating a field", () => {
    beforeEach(() => {
      graph.register(form.city0);
    });

    it("carries the flag up to the root", () => {
      graph.update(graph.field(form.city0), { flags: Touched });

      expect(has(graph.root(), Touched)).toBe(true);
      expect(graph.root().aggregate.touched).toBe(1);
    });

    it("takes the flag away again when the field loses it", () => {
      graph.update(graph.field(form.city0), { flags: Touched });
      graph.update(graph.field(form.city0), { flags: 0 });

      expect(graph.root().flags).toBe(0);
      expect(graph.root().aggregate.touched).toBe(0);
    });

    it("keeps errors on the field and never on the node above", () => {
      graph.update(graph.field(form.city0), { flags: Invalid, errors: ["requerido", "muy corto"] });

      expect((graph.entry(form.city0) as StateFieldEntry).errors).toEqual(["requerido", "muy corto"]);
      expect(has(graph.root(), Invalid)).toBe(true);
      expect(graph.root()).not.toHaveProperty("errors");
    });

    it("does nothing above when the flags land on the same value", () => {
      graph.update(graph.field(form.city0), { flags: Touched });
      graph.update(graph.field(form.city0), { flags: Touched });

      expect(graph.root().aggregate.touched).toBe(1);
    });
  });

  describe("the cut", () => {
    let address: StateNodeEntry;

    beforeEach(() => {
      graph.register(form.city0);
      graph.register(form.reference0);
      address = graph.materialize(form.address0);
    });

    it("stops at the first ancestor whose public flags did not change", () => {
      graph.update(graph.field(form.city0), { flags: Touched });

      expect(address.aggregate.touched).toBe(1);
      expect(graph.root().aggregate.touched).toBe(1);

      graph.update(graph.field(form.reference0), { flags: Touched });

      expect(address.aggregate.touched).toBe(2);
      expect(graph.root().aggregate.touched).toBe(1);
    });

    it("still keeps counting so the flag survives until the last child drops it", () => {
      graph.update(graph.field(form.city0), { flags: Touched });
      graph.update(graph.field(form.reference0), { flags: Touched });
      graph.update(graph.field(form.city0), { flags: 0 });

      expect(address.aggregate.touched).toBe(1);
      expect(has(address, Touched)).toBe(true);
      expect(has(graph.root(), Touched)).toBe(true);

      graph.update(graph.field(form.reference0), { flags: 0 });

      expect(has(address, Touched)).toBe(false);
      expect(has(graph.root(), Touched)).toBe(false);
    });

    it("reaches the root again when a different flag appears", () => {
      graph.update(graph.field(form.city0), { flags: Touched });
      graph.update(graph.field(form.reference0), { flags: Touched | Dirty });

      expect(graph.root().aggregate.touched).toBe(1);
      expect(has(graph.root(), Dirty)).toBe(true);
    });
  });

  describe("reporting what moved", () => {
    it("says nothing moved when the flags land on the same value", () => {
      const field = graph.register(form.city0);

      expect(graph.update(field, { flags: 0 })).toEqual([]);

      graph.update(field, { flags: Touched });

      expect(graph.update(field, { flags: Touched })).toEqual([]);
    });

    it("hands back the same empty collection every time, so saying nothing costs nothing", () => {
      const field = graph.register(form.city0);

      expect(graph.update(field, { flags: 0 })).toBe(graph.update(field, { flags: 0 }));
    });

    it("names the field and every ancestor that moved with it", () => {
      const field = graph.register(form.city0);
      const address = graph.materialize(form.address0);

      expect(graph.update(field, { flags: Touched })).toEqual([field, address, graph.root()]);
    });

    it("stops naming ancestors where the cut stops the walk", () => {
      const first = graph.register(form.city0);
      const second = graph.register(form.reference0);
      const address = graph.materialize(form.address0);

      expect(graph.update(first, { flags: Touched })).toEqual([first, address, graph.root()]);

      // The second one raises the count but not the flag, so the cut fires at
      // the very first ancestor and nobody above the field hears about it.
      expect(graph.update(second, { flags: Touched })).toEqual([second]);
      expect(address.aggregate.touched).toBe(2);
      expect(graph.root().aggregate.touched).toBe(1);
    });

    it("names only the field when nothing above it moved", () => {
      const first = graph.register(form.city0, { flags: Touched });
      const second = graph.register(form.reference0);

      expect(graph.update(second, { flags: Touched })).toEqual([second]);
      expect(first.flags).toBe(Touched);
    });

    /**
     * Errors are compared by reference, never by content: `StateGraph` has no
     * way to know what a caller's error shape means, so a new message under the
     * same flag has to be reported too, and a caller that hands back the exact
     * reference it was given has to be trusted that nothing changed.
     */
    it("names the field when only its errors reference changed, flags untouched", () => {
      const field = graph.register(form.city0, { flags: Invalid, errors: ["muy corto"] });

      expect(graph.update(field, { flags: Invalid, errors: ["formato invalido"] })).toEqual([field]);
      expect(field.errors).toEqual(["formato invalido"]);
    });

    it("does not climb to ancestors for an errors-only change, since they never derive from errors", () => {
      const field = graph.register(form.city0, { flags: Invalid, errors: ["muy corto"] });
      const address = graph.materialize(form.address0);

      graph.update(field, { flags: Invalid, errors: ["formato invalido"] });

      expect(address.aggregate.invalid).toBe(1);
    });

    it("says nothing moved when the same errors reference is handed back", () => {
      const errors = ["muy corto"];
      const field = graph.register(form.city0, { flags: Invalid, errors });

      expect(graph.update(field, { flags: Invalid, errors })).toEqual([]);
    });

    it("reports a move for two error lists with identical content but different references", () => {
      const field = graph.register(form.city0, { flags: Invalid, errors: ["muy corto"] });

      // Content-equal but not the same array: StateGraph cannot and does not
      // guess this — a caller that wants this treated as unchanged has to hand
      // back its own previous reference.
      expect(graph.update(field, { flags: Invalid, errors: ["muy corto"] })).toEqual([field]);
    });
  });

  describe("materializing", () => {
    it("takes over the weight its children used to carry upward", () => {
      graph.register(form.city0, { flags: Touched });
      graph.register(form.reference0, { flags: Touched });

      const address = graph.materialize(form.address0);

      expect(address.aggregate.touched).toBe(2);
      expect(has(address, Touched)).toBe(true);
      expect(graph.root().aggregate.touched).toBe(1);
      expect(has(graph.root(), Touched)).toBe(true);
    });

    it("re-points the children it took over", () => {
      const field = graph.register(form.city0);
      const address = graph.materialize(form.address0);

      expect(field.parent).toBe(address);
      expect(address.parent).toBe(graph.root());
    });

    it("routes later updates through the new node", () => {
      graph.register(form.city0);

      const address = graph.materialize(form.address0);

      graph.update(graph.field(form.city0), { flags: Dirty });

      expect(address.aggregate.dirty).toBe(1);
      expect(graph.root().aggregate.dirty).toBe(1);
    });

    it("stacks, so a node reports to the nearest materialized ancestor", () => {
      graph.register(form.city0, { flags: Dirty });

      const address = graph.materialize(form.address0);
      const client = graph.materialize(form.client);

      expect(address.parent).toBe(client);
      expect(client.parent).toBe(graph.root());
      expect(client.aggregate.dirty).toBe(1);
      expect(graph.root().aggregate.dirty).toBe(1);

      graph.update(graph.field(form.city0), { flags: 0 });

      expect(has(address, Dirty)).toBe(false);
      expect(has(client, Dirty)).toBe(false);
      expect(has(graph.root(), Dirty)).toBe(false);
    });

    it("leaves alone the ones that report to a closer node", () => {
      const field = graph.register(form.city0, { flags: Touched });
      const address = graph.materialize(form.address0);
      const client = graph.materialize(form.client);

      // Taking it would count its weight in two places at once.
      expect(field.parent).toBe(address);
      expect(client.aggregate.touched).toBe(1);
      expect(address.aggregate.touched).toBe(1);
    });

    it("never takes something outside its own branch", () => {
      const email = graph.register(form.email, { flags: Dirty });

      graph.materialize(form.address0);

      expect(email.parent).toBe(graph.root());
      expect(graph.root().aggregate.dirty).toBe(1);
    });

    it("returns what is already there when a node is materialized twice", () => {
      graph.register(form.city0, { flags: Touched });

      const first = graph.materialize(form.address0);
      const again = graph.materialize(form.address0);

      expect(again).toBe(first);
      expect(again.aggregate.touched).toBe(1);
    });

    it("leaves the root untouched when the children carry nothing", () => {
      graph.register(form.city0);
      graph.materialize(form.address0);

      expect(graph.root().flags).toBe(0);
      expect(graph.root().aggregate).toEqual(new StateAggregate());
    });
  });

  describe("dematerializing", () => {
    it("gives the children back and keeps the totals right", () => {
      const first = graph.register(form.city0, { flags: Touched });
      const second = graph.register(form.reference0, { flags: Touched });

      graph.materialize(form.address0);

      expect(graph.root().aggregate.touched).toBe(1);

      graph.dematerialize(form.address0);

      expect(graph.has(form.address0)).toBe(false);
      expect(first.parent).toBe(graph.root());
      expect(second.parent).toBe(graph.root());
      expect(graph.root().aggregate.touched).toBe(2);
      expect(has(graph.root(), Touched)).toBe(true);
    });

    it("detaches the node, so a reference somebody kept is inert", () => {
      graph.register(form.city0, { flags: Touched });

      const address = graph.materialize(form.address0);

      graph.dematerialize(form.address0);

      // Its weight was already discounted from the root, so leaving it linked
      // would let anything arriving through this reference count it twice.
      expect(address.parent).toBeNull();
    });

    it("routes later updates straight to the root again", () => {
      graph.register(form.city0);
      graph.materialize(form.address0);
      graph.dematerialize(form.address0);
      graph.update(graph.field(form.city0), { flags: Dirty });

      expect(graph.root().aggregate.dirty).toBe(1);
    });

    it("clears the flag above once its last contributor is unregistered", () => {
      graph.register(form.city0, { flags: Invalid });
      graph.materialize(form.address0);
      graph.unregister(form.city0);
      graph.dematerialize(form.address0);

      expect(graph.root().flags).toBe(0);
    });

    it("hands back a child that carries flags instead of dropping what it holds", () => {
      const field = graph.register(form.city0, { flags: Invalid });

      graph.materialize(form.address0);
      graph.dematerialize(form.address0);

      expect(field.parent).toBe(graph.root());
      expect(graph.root().aggregate.invalid).toBe(1);
      expect(has(graph.root(), Invalid)).toBe(true);
    });
  });

  describe("unregistering", () => {
    it("discounts the field from everyone above", () => {
      graph.register(form.city0, { flags: Touched });
      graph.register(form.reference0, { flags: Touched });

      graph.unregister(form.city0);

      expect(graph.has(form.city0)).toBe(false);
      expect(graph.root().aggregate.touched).toBe(1);
      expect(has(graph.root(), Touched)).toBe(true);

      graph.unregister(form.reference0);

      expect(graph.root().flags).toBe(0);
    });

    it("discounts through a materialized node", () => {
      graph.register(form.city0, { flags: Dirty });

      const address = graph.materialize(form.address0);

      graph.unregister(form.city0);

      expect(address.aggregate.dirty).toBe(0);
      expect(has(address, Dirty)).toBe(false);
      expect(has(graph.root(), Dirty)).toBe(false);
    });

    it("ignores a field that was never registered", () => {
      expect(() => graph.unregister(form.city0)).not.toThrow();
      expect(graph.root().flags).toBe(0);
    });
  });

  describe("joining a node that is already materialized", () => {
    let address: StateNodeEntry;

    beforeEach(() => {
      address = graph.materialize(form.address0);
    });

    it("counts a field that mounts underneath it afterwards", () => {
      const field = graph.register(form.city0, { flags: Touched });

      expect(field.parent).toBe(address);
      expect(address.aggregate.touched).toBe(1);
      expect(has(graph.root(), Touched)).toBe(true);
    });

    /** What an array insert produces: the new item's fields mount afterwards. */
    it("hangs a field of another item off the ancestor they share", () => {
      const client = graph.materialize(form.client);
      const other = graph.register(form.city1, { flags: Dirty });

      expect(other.parent).toBe(client);
      expect(client.aggregate.dirty).toBe(1);
      expect(has(graph.root(), Dirty)).toBe(true);
    });

    it("routes its later updates through the node", () => {
      graph.register(form.city0);
      graph.update(graph.field(form.city0), { flags: Dirty });

      expect(address.aggregate.dirty).toBe(1);
      expect(graph.root().aggregate.dirty).toBe(1);

      graph.update(graph.field(form.city0), { flags: 0 });

      expect(address.flags).toBe(0);
      expect(graph.root().flags).toBe(0);
    });

    it("discounts it from the node when it unregisters", () => {
      graph.register(form.city0, { flags: Invalid });
      graph.register(form.reference0, { flags: Invalid });

      graph.unregister(form.city0);

      expect(address.aggregate.invalid).toBe(1);
      expect(has(graph.root(), Invalid)).toBe(true);
    });
  });

  describe("deep chains", () => {
    let field: StateFieldEntry;
    let sibling: StateFieldEntry;
    let address: StateNodeEntry;
    let client: StateNodeEntry;

    beforeEach(() => {
      field = graph.register(form.city0);
      sibling = graph.register(form.reference0);
      address = graph.materialize(form.address0);
      client = graph.materialize(form.client);
    });

    it("cuts at the middle node without disturbing the ones above", () => {
      graph.update(graph.field(form.city0), { flags: Touched });

      expect(client.aggregate.touched).toBe(1);
      expect(graph.root().aggregate.touched).toBe(1);

      graph.update(graph.field(form.reference0), { flags: Touched });

      expect(address.aggregate.touched).toBe(2);
      expect(client.aggregate.touched).toBe(1);
      expect(graph.root().aggregate.touched).toBe(1);
    });

    it("hands a node down to the grandparent when the one above it goes away", () => {
      graph.update(graph.field(form.city0), { flags: Dirty });
      graph.dematerialize(form.client);

      expect(address.parent).toBe(graph.root());
      expect(graph.root().aggregate.dirty).toBe(1);

      graph.update(graph.field(form.reference0), { flags: Invalid });

      expect(has(address, Invalid)).toBe(true);
      expect(has(graph.root(), Invalid)).toBe(true);
    });

    it("finds every one of its children, so none can be left behind carrying flags", () => {
      graph.update(graph.field(form.reference0), { flags: Touched });
      graph.dematerialize(form.address0);

      expect(field.parent).toBe(client);
      expect(sibling.parent).toBe(client);
      expect(client.aggregate.touched).toBe(1);
      expect(has(graph.root(), Touched)).toBe(true);
    });

    it("hands a middle node's children to the grandparent when it goes away", () => {
      graph.update(graph.field(form.city0), { flags: Dirty });
      graph.dematerialize(form.address0);

      expect(field.parent).toBe(client);
      expect(sibling.parent).toBe(client);
      expect(client.aggregate.dirty).toBe(1);
      expect(has(graph.root(), Dirty)).toBe(true);

      graph.update(graph.field(form.city0), { flags: 0 });

      expect(client.flags).toBe(0);
      expect(graph.root().flags).toBe(0);
    });
  });

  describe("more than one watcher on the same location", () => {
    it("counts a field once however many times it is registered", () => {
      const first = graph.register(form.city0, { flags: Dirty });
      const again = graph.register(form.city0, { flags: Dirty });

      expect(again).toBe(first);
      expect(graph.root().aggregate.dirty).toBe(1);
    });

    it("does not discount a field a second watcher still holds", () => {
      graph.register(form.city0, { flags: Dirty });
      graph.register(form.city0);

      expect(graph.unregister(form.city0)).toEqual([]);
      expect(graph.has(form.city0)).toBe(true);
      expect(graph.root().aggregate.dirty).toBe(1);
      expect(has(graph.root(), Dirty)).toBe(true);
    });

    it("discounts it once the last watcher goes", () => {
      graph.register(form.city0, { flags: Dirty });
      graph.register(form.city0);

      graph.unregister(form.city0);
      graph.unregister(form.city0);

      expect(graph.has(form.city0)).toBe(false);
      expect(graph.root().aggregate.dirty).toBe(0);
      expect(graph.root().flags).toBe(0);
    });

    it("counts a node once however many times it is materialized", () => {
      graph.register(form.city0, { flags: Touched });

      const first = graph.materialize(form.address0);
      const again = graph.materialize(form.address0);

      expect(again).toBe(first);
      expect(first.aggregate.touched).toBe(1);
      expect(graph.root().aggregate.touched).toBe(1);
    });

    it("keeps a node deriving while a second watcher still holds it", () => {
      const field = graph.register(form.city0, { flags: Touched });
      const address = graph.materialize(form.address0);

      graph.materialize(form.address0);
      graph.dematerialize(form.address0);

      expect(graph.has(form.address0)).toBe(true);
      expect(field.parent).toBe(address);
      expect(address.aggregate.touched).toBe(1);
      expect(graph.root().aggregate.touched).toBe(1);
    });

    it("hands the children back and keeps the totals once the last one goes", () => {
      const field = graph.register(form.city0, { flags: Touched });

      graph.materialize(form.address0);
      graph.materialize(form.address0);

      graph.dematerialize(form.address0);
      graph.dematerialize(form.address0);

      expect(graph.has(form.address0)).toBe(false);
      expect(field.parent).toBe(graph.root());
      expect(graph.root().aggregate.touched).toBe(1);
      expect(has(graph.root(), Touched)).toBe(true);
    });

    it("still routes updates through a node one watcher let go of", () => {
      graph.register(form.city0);

      const address = graph.materialize(form.address0);

      graph.materialize(form.address0);
      graph.dematerialize(form.address0);
      graph.update(graph.field(form.city0), { flags: Invalid });

      expect(address.aggregate.invalid).toBe(1);
      expect(has(graph.root(), Invalid)).toBe(true);
    });
  });

  describe("guards", () => {
    it("finds an unknown entry as undefined but requiring it throws", () => {
      expect(graph.find(form.email)).toBeUndefined();
      expect(graph.has(form.email)).toBe(false);
      expect(() => graph.entry(form.email)).toThrow(UnknownObservation);
    });

    it("refuses to update a node as if it were a field", () => {
      graph.materialize(form.address0);

      expect(() => graph.update(graph.field(form.address0), { flags: Dirty })).toThrow(StateKindConflict);
      expect(() => graph.unregister(form.address0)).toThrow(StateKindConflict);
    });

    it("refuses to materialize over a field", () => {
      graph.register(form.city0);

      expect(() => graph.materialize(form.city0)).toThrow(StateKindConflict);
    });

    it("leaves the errors alone when an update brings none, so typing does not touch them", () => {
      const field = graph.register(form.city0);

      graph.update(field, { flags: Invalid, errors: ["requerido"] });
      graph.update(field, { flags: Invalid | Touched });

      expect(field.errors).toEqual(["requerido"]);
    });

    it("clears the errors when an update brings an empty collection", () => {
      const field = graph.register(form.city0);

      graph.update(field, { flags: Invalid, errors: ["requerido"] });
      graph.update(field, { flags: 0, errors: [] });

      expect(field.errors).toEqual([]);
      expect(graph.root().flags).toBe(0);
    });

    it("hands every field the same empty collection instead of one each", () => {
      const first = graph.register(form.city0);
      const second = graph.register(form.reference0);

      expect(first.errors).toBe(second.errors);
    });

    it("makes an update through an unregistered field inert", () => {
      const field = graph.register(form.city0, { flags: Touched });

      graph.register(form.reference0, { flags: Touched });
      graph.unregister(form.city0);

      expect(graph.root().aggregate.touched).toBe(1);

      graph.update(field, { flags: 0 });
      graph.update(field, { flags: Touched });

      expect(graph.root().aggregate.touched).toBe(1);
      expect(has(graph.root(), Touched)).toBe(true);
    });
  });
});
