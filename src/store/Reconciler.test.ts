/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import { type Invoice, InvoiceStructure, sampleInvoice } from "./observation/__fixtures__/invoice";
import { PathKind } from "./path/types";
import { Reconciler } from "./Reconciler";
import { StateAssessor } from "./state/StateAssessor";
import { hasFlag, StateFlag } from "./state/StateFlag";
import { StateGraph } from "./state/StateGraph";
import { PathValueClassifier } from "./value/PathValueClassifier";
import { ValueStore } from "./value/ValueStore";

const classifier = new PathValueClassifier();

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
    it("discards every old item along with whatever state and value they held", () => {
      state.register(form.city0);
      value.register(form.city0);

      value.write(form.index.entry(form.addresses), [{ city: "Trujillo", reference: "cerca al mercado" }], () => {});
      reconciler.reconcile(form.index.entry(form.addresses));

      expect(state.has(form.city0)).toBe(false);
      expect(value.has(form.city0)).toBe(false);
      expect(form.index.find(form.city0)).toBeUndefined();
      expect(form.index.find(form.address0)).toBeUndefined();
    });

    it("fully releases an old item even when more than one watcher joined the same field", () => {
      state.register(form.city0);
      state.register(form.city0); // a second watcher on the exact same field
      value.register(form.city0);
      value.register(form.city0);

      value.write(form.index.entry(form.addresses), [{ city: "Trujillo", reference: "cerca al mercado" }], () => {});
      reconciler.reconcile(form.index.entry(form.addresses));

      expect(state.has(form.city0)).toBe(false);
      expect(value.has(form.city0)).toBe(false);
    });

    it("fully releases an old item even when more than one watcher joined the item node itself", () => {
      state.materialize(form.address0);
      state.materialize(form.address0); // a second watcher on the whole item
      value.materialize(form.address0);
      value.materialize(form.address0);

      value.write(form.index.entry(form.addresses), [{ city: "Trujillo", reference: "cerca al mercado" }], () => {});
      reconciler.reconcile(form.index.entry(form.addresses));

      expect(state.has(form.address0)).toBe(false);
      expect(value.has(form.address0)).toBe(false);
    });

    it("mints a fresh object identity for every new object item", () => {
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
      expect(items.map((item) => item.id)).not.toContain(form.address0);
      expect(items.map((item) => item.id)).not.toContain(form.address1);
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
