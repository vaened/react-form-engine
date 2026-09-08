/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import { type Invoice, InvoiceStructure, sampleInvoice } from "./observation/__fixtures__/invoice";
import { PathKind } from "./path/types";
import { Reconciler } from "./Reconciler";
import { FieldState } from "./state/FieldState";
import { StateAssessor } from "./state/StateAssessor";
import { hasFlag, StateFlag } from "./state/StateFlag";
import { StateGraph } from "./state/StateGraph";
import { PathValueClassifier } from "./value/PathValueClassifier";
import { ValueStore } from "./value/ValueStore";

const classifier = new PathValueClassifier();

const fieldState = (flags: number, errors: readonly unknown[] = []) => {
  const state = new FieldState();

  state.flags = flags;
  state.errors = errors;

  return state;
};

describe("Reconciler", () => {
  let form: InvoiceStructure;
  let state: StateGraph;
  let value: ValueStore<Invoice>;
  let reconciler: Reconciler<Invoice>;

  beforeEach(() => {
    form = new InvoiceStructure();
    state = new StateGraph(form.index);
    value = new ValueStore<Invoice>(form.index, classifier, sampleInvoice(), sampleInvoice());
    reconciler = new Reconciler(form.index, state, value, classifier, new StateAssessor(classifier));
  });

  describe("what a write is allowed to change", () => {
    const { Dirty, Touched, Invalid, Validating } = StateFlag;

    it("leaves alone every flag a value cannot speak for", () => {
      state.register(form.name, fieldState(Touched | Invalid | Validating));
      value.register(form.name);
      value.write(form.index.entry(form.name), "Grace Hopper", () => {});

      reconciler.reconcile(form.index.entry(form.name));

      const flags = state.field(form.name).state.flags;

      expect(hasFlag(flags, Touched)).toBe(true);
      expect(hasFlag(flags, Invalid)).toBe(true);
      expect(hasFlag(flags, Validating)).toBe(true);
      expect(hasFlag(flags, Dirty)).toBe(true);
    });

    it("never leaves a field holding errors it no longer calls itself invalid for", () => {
      state.register(form.name, fieldState(Invalid, ["required"]));
      value.register(form.name);
      value.write(form.index.entry(form.name), "Grace Hopper", () => {});

      reconciler.reconcile(form.index.entry(form.name));

      const field = state.field(form.name).state;

      expect(field.errors).toEqual(["required"]);
      expect(field.isInvalid).toBe(true);
    });

    it("still takes dirty away when the value goes back to its default", () => {
      state.register(form.name, fieldState(Touched));
      value.register(form.name);
      value.write(form.index.entry(form.name), "Grace Hopper", () => {});
      reconciler.reconcile(form.index.entry(form.name));

      value.write(form.index.entry(form.name), sampleInvoice().invoice.client.name, () => {});
      reconciler.reconcile(form.index.entry(form.name));

      const flags = state.field(form.name).state.flags;

      expect(hasFlag(flags, Dirty)).toBe(false);
      expect(hasFlag(flags, Touched)).toBe(true);
    });
  });

  describe("a field", () => {
    it("marks it dirty once its observed value diverges from the default", () => {
      state.register(form.name);
      value.register(form.name);
      value.write(form.index.entry(form.name), "Grace Hopper", () => {});

      reconciler.reconcile(form.index.entry(form.name));

      expect(hasFlag(state.field(form.name).state.flags, StateFlag.Dirty)).toBe(true);
    });

    it("leaves it clean when the observed value still matches the default", () => {
      state.register(form.name);
      value.register(form.name);

      reconciler.reconcile(form.index.entry(form.name));

      expect(hasFlag(state.field(form.name).state.flags, StateFlag.Dirty)).toBe(false);
    });

    it("does nothing for a field nobody observed", () => {
      expect(() => reconciler.reconcile(form.index.entry(form.email))).not.toThrow();
      expect(state.has(form.email)).toBe(false);
    });
  });

  describe("an object", () => {
    it("reassesses every observed field beneath it", () => {
      state.register(form.name);
      value.register(form.name);
      value.write(form.index.entry(form.name), "Grace Hopper", () => {});

      reconciler.reconcile(form.index.entry(form.client));

      expect(hasFlag(state.field(form.name).state.flags, StateFlag.Dirty)).toBe(true);
    });

    it("does not disturb a field beneath it that nobody observed", () => {
      reconciler.reconcile(form.index.entry(form.client));

      expect(state.has(form.email)).toBe(false);
    });
  });

  describe("an array", () => {
    it("keeps the positions the value still reaches, and lets go of the ones past its end", () => {
      state.register(form.city0);
      value.register(form.city0);
      state.register(form.city1);
      value.register(form.city1);

      value.write(form.index.entry(form.addresses), [{ city: "Trujillo", reference: "cerca al mercado" }], () => {});
      reconciler.reconcile(form.index.entry(form.addresses));

      expect(form.index.find(form.address0)).toBeDefined();
      expect(state.has(form.city0)).toBe(true);
      expect(value.has(form.city0)).toBe(true);

      expect(form.index.find(form.address1)).toBeUndefined();
      expect(state.has(form.city1)).toBe(false);
      expect(value.has(form.city1)).toBe(false);
    });

    it("fully releases a discarded item even when more than one watcher joined the same field", () => {
      state.register(form.city0);
      state.register(form.city0); // a second watcher on the exact same field
      value.register(form.city0);
      value.register(form.city0);

      value.write(form.index.entry(form.addresses), [], () => {});
      reconciler.reconcile(form.index.entry(form.addresses));

      expect(state.has(form.city0)).toBe(false);
      expect(value.has(form.city0)).toBe(false);
    });

    it("fully releases a discarded item even when more than one watcher joined the item node itself", () => {
      state.materialize(form.address0);
      state.materialize(form.address0); // a second watcher on the whole item
      value.materialize(form.address0);
      value.materialize(form.address0);

      value.write(form.index.entry(form.addresses), [], () => {});
      reconciler.reconcile(form.index.entry(form.addresses));

      expect(state.has(form.address0)).toBe(false);
      expect(value.has(form.address0)).toBe(false);
    });

    it("mints an identity only for the positions the value brought", () => {
      value.write(
        form.index.entry(form.addresses),
        [
          { city: "Trujillo", reference: "cerca al mercado" },
          { city: "Piura", reference: "frente a la plaza" },
          { city: "Cusco", reference: "junto a la catedral" },
        ],
        () => {},
      );

      reconciler.reconcile(form.index.entry(form.addresses));

      const items = form.index.childrenOf(form.addresses);

      expect(items).toHaveLength(3);
      expect(items.every((item) => item.kind === PathKind.Object)).toBe(true);
      expect(items[0].id).toBe(form.address0);
      expect(items[1].id).toBe(form.address1);
      expect(items[2].id).not.toBe(form.address1);
    });

    it("mints a field identity for every new scalar item", () => {
      const phones = form.index.register("invoice.client.phones", PathKind.Array);

      value.write(phones, ["+51 900 000 000"], () => {});
      reconciler.reconcile(phones);

      const items = form.index.childrenOf(phones.id);

      expect(items).toHaveLength(1);
      expect(items[0]?.kind).toBe(PathKind.Field);
    });

    it("mints nothing when the new array is empty", () => {
      value.write(form.index.entry(form.addresses), [], () => {});

      reconciler.reconcile(form.index.entry(form.addresses));

      expect(form.index.childrenOf(form.addresses)).toHaveLength(0);
    });
  });
});
