/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import { FormStore } from "./FormStore";
import { InvalidArrayIndex, InvalidPathSegment } from "./store/path/errors";
import { hasFlag, StateFlag } from "./store/state/StateFlag";
import type { StateFieldEntry } from "./store/state/types";
import { StateKind } from "./store/state/types";
import { CircularPatchValue, CircularValue, PathInsideValue } from "./store/value/errors";

/** Shape of docs/FormValue.example.json. */
type Invoice = {
  invoice: {
    createdAt: string;
    series: string;
    number: string;
    client: {
      documentNumber: string;
      name: string;
      email: string;
      phones: string[];
      addresses: { city: string; reference: string }[];
    };
    details: { description: string; quantity: number; unitPrice: number; discount: number }[];
  };
};

const sample = (): Invoice => ({
  invoice: {
    createdAt: "2026-08-28T12:00:00.000Z",
    series: "F001",
    number: "000001",
    client: {
      documentNumber: "12345678",
      name: "Ada Lovelace",
      email: "ada@example.com",
      phones: ["+51 999 999 999", "+51 988 888 888"],
      addresses: [{ city: "Lima", reference: "Frente al parque principal" }],
    },
    details: [{ description: "Consulting service", quantity: 2, unitPrice: 120, discount: 10 }],
  },
});

describe("FormStore", () => {
  let store: FormStore<Invoice>;

  beforeEach(() => {
    store = new FormStore<Invoice>({ defaults: sample() });
  });

  describe("registering a field", () => {
    it("appears as a field once registered", () => {
      store.register("invoice.client.name");

      const state = store.getState("invoice.client.name");

      expect(state).toBeDefined();
      expect(state?.kind).toBe(StateKind.Field);
    });

    it("registers a branch nobody set yet, since an absent value classifies as a field", () => {
      const empty = new FormStore<Invoice>({ defaults: {} as Invoice });

      empty.register("invoice.client.name");

      expect(empty.getState("invoice.client.name")?.kind).toBe(StateKind.Field);
    });

    it("is idempotent: registering twice does not duplicate anything", () => {
      store.register("invoice.client.name");

      const first = store.getState("invoice.client.name");

      store.register("invoice.client.name");

      expect(store.getState("invoice.client.name")).toBe(first);
    });

    it("does not touch the value: registering never assigns or clears anything", () => {
      store.register("invoice.client.name");

      expect(store.values.invoice.client.name).toBe("Ada Lovelace");
    });

    it("is not dirty when the value matches the default", () => {
      const withDefaults = new FormStore<Invoice>({ values: sample(), defaults: sample() });

      withDefaults.register("invoice.client.name");

      const field = withDefaults.getState("invoice.client.name") as StateFieldEntry;

      expect(hasFlag(field.flags, StateFlag.Dirty)).toBe(false);
    });

    /** Editing an existing record: the value already differs before anyone types. */
    it("is born dirty when the value already differs from the default at register time", () => {
      const defaults = sample();
      const values = sample();
      values.invoice.client.name = "Grace Hopper";
      const editing = new FormStore<Invoice>({ values, defaults });

      editing.register("invoice.client.name");

      const field = editing.getState("invoice.client.name") as StateFieldEntry;

      expect(hasFlag(field.flags, StateFlag.Dirty)).toBe(true);
    });

    it("is never touched at registration, dirty or not", () => {
      const defaults = sample();
      const values = sample();
      values.invoice.client.name = "Grace Hopper";
      const editing = new FormStore<Invoice>({ values, defaults });

      editing.register("invoice.client.name");

      const field = editing.getState("invoice.client.name") as StateFieldEntry;

      expect(hasFlag(field.flags, StateFlag.Touched)).toBe(false);
    });

    it("is never dirty when values and defaults are the same object", () => {
      // No separate defaults given: ValueStore falls back to `defaults = values`,
      // so reading either side always reaches the exact same data.
      const shared = new FormStore<Invoice>({ defaults: sample() });

      shared.register("invoice.client.name");

      const field = shared.getState("invoice.client.name") as StateFieldEntry;

      expect(hasFlag(field.flags, StateFlag.Dirty)).toBe(false);
    });
  });

  describe("registering a node", () => {
    it("appears as a node, not a field", () => {
      store.register("invoice.client");

      expect(store.getState("invoice.client")?.kind).toBe(StateKind.Node);
    });

    it("is idempotent: registering twice does not duplicate or reset it", () => {
      store.register("invoice.client");

      const first = store.getState("invoice.client");

      store.register("invoice.client");

      expect(store.getState("invoice.client")).toBe(first);
    });

    it("parents a field already registered under the node once the node registers too", () => {
      store.register("invoice.client.name");
      store.register("invoice.client");

      const field = store.getState("invoice.client.name");
      const node = store.getState("invoice.client");

      expect(field?.parent).toBe(node);
    });

    it("parents a field that registers after the node already exists", () => {
      store.register("invoice.client");
      store.register("invoice.client.name");

      const field = store.getState("invoice.client.name");
      const node = store.getState("invoice.client");

      expect(field?.parent).toBe(node);
    });
  });

  /**
   * A location claimed as a field because nothing was known to live inside it
   * reopens into a node the moment something registers underneath — the same
   * mechanic PathIndex already guarantees, exercised end to end through the
   * store.
   */
  describe("a field that turns out to have children", () => {
    it("stops being a field once something registers below it", () => {
      const empty = new FormStore<Invoice>({ defaults: {} as Invoice });

      empty.register("invoice.client");

      expect(empty.getState("invoice.client")?.kind).toBe(StateKind.Field);

      empty.register("invoice.client.name");

      expect(empty.getState("invoice.client")?.kind).toBe(StateKind.Node);
    });

    it("stops being a field the moment a write reaches through it", () => {
      const empty = new FormStore<Invoice>({ defaults: {} as Invoice });

      empty.register("invoice.client");

      expect(empty.getState("invoice.client")?.kind).toBe(StateKind.Field);

      empty.set("invoice.client.name", "Ada Lovelace");

      expect(empty.getState("invoice.client")?.kind).toBe(StateKind.Node);
    });

    it("can still be unregistered afterwards, from the kind it is now", () => {
      const empty = new FormStore<Invoice>({ defaults: {} as Invoice });

      empty.register("invoice.client");
      empty.set("invoice.client.name", "Ada Lovelace");

      empty.unregister("invoice.client");

      expect(empty.getState("invoice.client")).toBeUndefined();
    });

    it("leaves a location nobody watches alone", () => {
      const empty = new FormStore<Invoice>({ defaults: {} as Invoice });

      empty.set("invoice.client.name", "Ada Lovelace");

      expect(empty.getState("invoice.client")).toBeUndefined();
    });
  });

  describe("unregistering", () => {
    it("removes a field from state and value", () => {
      store.register("invoice.client.name");

      store.unregister("invoice.client.name");

      expect(store.getState("invoice.client.name")).toBeUndefined();
    });

    it("dematerializes a node", () => {
      store.register("invoice.client");

      store.unregister("invoice.client");

      expect(store.getState("invoice.client")).toBeUndefined();
    });

    it("ignores a path that was never registered", () => {
      expect(() => store.unregister("invoice.client.name")).not.toThrow();
    });

    it("ignores a path that only exists structurally, never registered on its own", () => {
      // Registering the field creates the client node structurally in the
      // index, but nobody registered `client` itself in state or value.
      store.register("invoice.client.name");

      expect(() => store.unregister("invoice.client")).not.toThrow();
    });

    it("keeps a field alive for a second watcher until the last one leaves", () => {
      store.register("invoice.client.name");
      store.register("invoice.client.name");

      store.unregister("invoice.client.name");

      expect(store.getState("invoice.client.name")).toBeDefined();

      store.unregister("invoice.client.name");

      expect(store.getState("invoice.client.name")).toBeUndefined();
    });

    it("does not throw when a mounted Controller cleans up after its array item was already replaced", () => {
      store.register("invoice.client.addresses.0.city");

      store.set("invoice.client.addresses", [{ city: "Trujillo", reference: "cerca al mercado" }]);

      expect(() => store.unregister("invoice.client.addresses.0.city")).not.toThrow();
    });
  });

  describe("set", () => {
    it("writes the value at the path", () => {
      store.set("invoice.client.name", "Grace Hopper");

      expect(store.values.invoice.client.name).toBe("Grace Hopper");
    });

    it("registers the path if nothing had yet, so a write to a fresh path does not throw", () => {
      const empty = new FormStore<Invoice>({ defaults: {} as Invoice });

      expect(() => empty.set("invoice.client.name", "Ada")).not.toThrow();
      expect(empty.values.invoice.client.name).toBe("Ada");
    });

    it("marks a registered field dirty when the write differs from the default", () => {
      store.register("invoice.client.name");

      store.set("invoice.client.name", "Grace Hopper");

      const field = store.getState("invoice.client.name") as StateFieldEntry;

      expect(hasFlag(field.flags, StateFlag.Dirty)).toBe(true);
    });

    it("leaves a registered field clean when the write matches the default", () => {
      store.register("invoice.client.name");

      store.set("invoice.client.name", "Ada Lovelace");

      const field = store.getState("invoice.client.name") as StateFieldEntry;

      expect(hasFlag(field.flags, StateFlag.Dirty)).toBe(false);
    });

    it("clears dirty once a later write brings the value back to the default", () => {
      store.register("invoice.client.name");
      store.set("invoice.client.name", "Grace Hopper");

      store.set("invoice.client.name", "Ada Lovelace");

      const field = store.getState("invoice.client.name") as StateFieldEntry;

      expect(hasFlag(field.flags, StateFlag.Dirty)).toBe(false);
    });

    it("does not create state for a field nobody registered", () => {
      store.set("invoice.client.name", "Grace Hopper");

      expect(store.getState("invoice.client.name")).toBeUndefined();
    });

    /**
     * A write reaches a location, it never claims what kind it is: the value
     * being assigned says nothing about the shape somebody already declared.
     */
    it("assigns null to a node without contradicting the kind it was declared as", () => {
      store.register("invoice.client.name");

      expect(() => store.set("invoice.client", null as never)).not.toThrow();
      expect(store.values.invoice.client).toBeNull();
    });

    /**
     * The two rules meet here without contradicting each other, because each
     * one speaks about a different kind: an object keeps its descendants
     * because a key still names the same place, while an array cannot, since
     * position was never identity.
     */
    it("discards the items of an array assigned null, state and identity alike", () => {
      store.register("invoice.client.addresses.0.city");

      store.set("invoice.client.addresses", null as never);

      expect(store.getState("invoice.client.addresses.0.city")).toBeUndefined();
      expect(store.values.invoice.client.addresses).toBeNull();
    });

    it("leaves the descendants of a nulled node registered, reading as absent", () => {
      store.register("invoice.client.name");

      store.set("invoice.client", null as never);

      const field = store.getState("invoice.client.name") as StateFieldEntry;

      expect(field).toBeDefined();
      expect(hasFlag(field.flags, StateFlag.Dirty)).toBe(true);
    });

    it("reassesses a registered field under a replaced node that hangs from the root", () => {
      store.register("invoice.series");

      store.set("invoice", { ...sample().invoice, series: "F002" });

      const field = store.getState("invoice.series") as StateFieldEntry;

      expect(store.values.invoice.series).toBe("F002");
      expect(hasFlag(field.flags, StateFlag.Dirty)).toBe(true);
    });

    it("reassesses a registered field nested under a replaced object", () => {
      store.register("invoice.client.name");

      store.set("invoice.client", {
        documentNumber: "87654321",
        name: "Grace Hopper",
        email: "grace@example.com",
        phones: [],
        addresses: [],
      });

      const field = store.getState("invoice.client.name") as StateFieldEntry;

      expect(hasFlag(field.flags, StateFlag.Dirty)).toBe(true);
    });

    it("finds nothing for a stale path once its array item is destroyed and rebuilt", () => {
      store.register("invoice.client.addresses.0.city");

      store.set("invoice.client.addresses", [{ city: "Trujillo", reference: "cerca al mercado" }]);

      expect(store.getState("invoice.client.addresses.0.city")).toBeUndefined();
    });

    it("compares a freshly replaced array item against whatever default still occupies that position", () => {
      store.set("invoice.client.addresses", [{ city: "Trujillo", reference: "cerca al mercado" }]);

      store.register("invoice.client.addresses.0.city");

      const field = store.getState("invoice.client.addresses.0.city") as StateFieldEntry;

      expect(field.kind).toBe(StateKind.Field);
      expect(hasFlag(field.flags, StateFlag.Dirty)).toBe(true);
    });
  });

  describe("set under patch semantics", () => {
    let patch: FormStore<Invoice>;

    beforeEach(() => {
      patch = new FormStore<Invoice>({ defaults: sample(), mode: "patch" });
    });

    it("writes the keys the value carries and leaves the rest of the object alone", () => {
      patch.set("invoice.client", { name: "Grace Hopper" } as never);

      expect(patch.values.invoice.client.name).toBe("Grace Hopper");
      expect(patch.values.invoice.client.email).toBe("ada@example.com");
      expect(patch.values.invoice.client.documentNumber).toBe("12345678");
    });

    it("descends as deep as the value goes", () => {
      patch.set("invoice", { client: { name: "Grace Hopper" } } as never);

      expect(patch.values.invoice.client.name).toBe("Grace Hopper");
      expect(patch.values.invoice.series).toBe("F001");
    });

    it("writes null as the value it is, not as an absence", () => {
      patch.set("invoice.client", { name: null } as never);

      expect(patch.values.invoice.client.name).toBeNull();
      expect(patch.values.invoice.client.email).toBe("ada@example.com");
    });

    it("reassesses only the fields the value carried", () => {
      patch.register("invoice.client.name");
      patch.register("invoice.client.email");

      patch.set("invoice.client", { name: "Grace Hopper" } as never);

      expect(hasFlag((patch.getState("invoice.client.name") as StateFieldEntry).flags, StateFlag.Dirty)).toBe(true);
      expect(hasFlag((patch.getState("invoice.client.email") as StateFieldEntry).flags, StateFlag.Dirty)).toBe(false);
    });

    /** The whole point of a patch: what it never named keeps its identity. */
    it("leaves an array the value never named untouched, items and all", () => {
      patch.register("invoice.client.addresses.0.city");

      patch.set("invoice.client", { name: "Grace Hopper" } as never);

      expect(patch.getState("invoice.client.addresses.0.city")).toBeDefined();
      expect(patch.values.invoice.client.addresses[0]?.city).toBe("Lima");
    });

    it("replaces an array the value does name, discarding its items", () => {
      patch.register("invoice.client.addresses.0.city");

      patch.set("invoice.client", { addresses: [{ city: "Trujillo", reference: "cerca al mercado" }] } as never);

      expect(patch.getState("invoice.client.addresses.0.city")).toBeUndefined();
      expect(patch.values.invoice.client.addresses[0]?.city).toBe("Trujillo");
    });

    it("still replaces outright when the value is not an object", () => {
      patch.set("invoice.client.name", "Grace Hopper");

      expect(patch.values.invoice.client.name).toBe("Grace Hopper");
    });
  });

  describe("a patch value that reaches itself", () => {
    it("refuses a value holding a reference back to itself", () => {
      const patch = new FormStore<Invoice>({ defaults: sample(), mode: "patch" });
      const client: Record<string, unknown> = { name: "Grace Hopper" };
      client.itself = client;

      expect(() => patch.set("invoice.client", client as never)).toThrow(CircularPatchValue);
    });

    it("refuses a longer way round, not only a direct self reference", () => {
      const patch = new FormStore<Invoice>({ defaults: sample(), mode: "patch" });
      const client: Record<string, unknown> = { name: "Grace Hopper" };
      client.address = { city: "Lima", client };

      expect(() => patch.set("invoice.client", client as never)).toThrow(CircularPatchValue);
    });

    /**
     * The same object under two keys is a shape that ends, not a loop: only an
     * object the descent is currently inside of makes it one.
     */
    it("accepts the same object reached twice by different keys", () => {
      const patch = new FormStore<Invoice>({ defaults: sample(), mode: "patch" });
      const shared = { city: "Lima" };

      expect(() => patch.set("invoice.client", { billing: shared, shipping: shared } as never)).not.toThrow();
      expect((patch.values.invoice.client as Record<string, unknown>).billing).toEqual({ city: "Lima" });
      expect((patch.values.invoice.client as Record<string, unknown>).shipping).toEqual({ city: "Lima" });
    });
  });

  /**
   * Reaching a path opens whatever it passes through, so refusing one halfway
   * would leave a branch reshaped for a registration that never happened.
   */
  describe("one place, one value", () => {
    type Two = { billing: { city: string }; shipping: { city: string } };

    it("keeps two places apart when they were handed in as one", () => {
      const address = { city: "Lima" };
      const born = new FormStore<Two>({ defaults: { billing: address, shipping: address } });

      born.register("billing.city");
      born.register("shipping.city");
      born.set("billing.city", "Cusco");

      expect(born.values.billing.city).toBe("Cusco");
      expect(born.values.shipping.city).toBe("Lima");
      expect(hasFlag(born.getState("shipping.city")?.flags ?? 0, StateFlag.Dirty)).toBe(false);
    });

    it("keeps two rows apart when the same one was handed in twice", () => {
      const row = { city: "Lima" };
      const born = new FormStore<{ rows: { city: string }[] }>({ defaults: { rows: [row, row] } });

      born.register("rows.0.city");
      born.register("rows.1.city");
      born.set("rows.0.city", "Cusco");

      expect(born.values.rows[1].city).toBe("Lima");
    });

    it("keeps two places apart when a write hands one object to both", () => {
      const born = new FormStore<Two>({ defaults: { billing: { city: "x" }, shipping: { city: "x" } } });

      born.register("billing.city");
      born.register("shipping.city");

      const address = { city: "Lima" };

      born.set("billing", address);
      born.set("shipping", address);
      born.set("billing.city", "Cusco");

      expect(born.values.billing.city).toBe("Cusco");
      expect(born.values.shipping.city).toBe("Lima");
    });

    it("keeps its own copy of what a write hands it", () => {
      const born = new FormStore<Two>({ defaults: { billing: { city: "x" }, shipping: { city: "x" } } });
      const address = { city: "Lima" };

      born.register("billing.city");
      born.set("billing", address);

      expect(born.values.billing).not.toBe(address);
      expect(born.values.billing.city).toBe("Lima");
    });

    it("refuses a write that points back at itself", () => {
      const born = new FormStore<Two>({ defaults: { billing: { city: "x" }, shipping: { city: "x" } } });
      const looping: Record<string, unknown> = { city: "Lima" };
      looping.itself = looping;

      expect(() => born.set("billing", looping as never)).toThrow(CircularValue);
    });

    it("leaves a field write alone, which is where the typing happens", () => {
      const born = new FormStore<Two>({ defaults: { billing: { city: "x" }, shipping: { city: "x" } } });

      born.register("billing.city");
      born.set("billing.city", "Lima");

      expect(born.values.billing.city).toBe("Lima");
    });

    it("refuses a value that points back at itself", () => {
      const client: Record<string, unknown> = { name: "Ada" };
      client.itself = client;

      expect(() => new FormStore({ defaults: { client } } as never)).toThrow(CircularValue);
    });
  });

  describe("what the form is born from", () => {
    it("starts at its defaults when nothing else is said", () => {
      const born = new FormStore<Invoice>({ defaults: sample() });

      born.register("invoice.client.name");

      expect(born.values.invoice.client.name).toBe("Ada Lovelace");
      expect(hasFlag(born.getState("invoice.client.name")?.flags ?? 0, StateFlag.Dirty)).toBe(false);
    });

    it("starts wherever it is told to, which is not always its base", () => {
      const draft = sample();
      draft.invoice.client.name = "Grace Hopper";

      const born = new FormStore<Invoice>({ defaults: sample(), values: draft });

      born.register("invoice.client.name");

      expect(born.values.invoice.client.name).toBe("Grace Hopper");
      expect(born.defaults.invoice.client.name).toBe("Ada Lovelace");
      expect(hasFlag(born.getState("invoice.client.name")?.flags ?? 0, StateFlag.Dirty)).toBe(true);
    });

    it("keeps its own tree, so what it was handed is never written into", () => {
      const mine = sample();
      const born = new FormStore<Invoice>({ defaults: mine });

      born.register("invoice.client.name");
      born.set("invoice.client.name", "Grace Hopper");

      expect(mine.invoice.client.name).toBe("Ada Lovelace");
      expect(born.values.invoice).not.toBe(mine.invoice);
    });

    it("keeps the base out of reach of a write, whichever way it was born", () => {
      const mine = sample();
      const born = new FormStore<Invoice>({ defaults: mine, values: mine });

      born.register("invoice.client.name");
      born.set("invoice.client.name", "Grace Hopper");

      expect(born.defaults.invoice.client.name).toBe("Ada Lovelace");
      expect(mine.invoice.client.name).toBe("Ada Lovelace");
    });

    it("still shares what only compares as itself", () => {
      const attachment = new File(["x"], "invoice.pdf");
      const born = new FormStore<{ attachment: File }>({ defaults: { attachment } });

      expect(born.values.attachment).toBe(attachment);
      expect(born.defaults.attachment).toBe(attachment);
    });
  });

  describe("defaults handed in by the caller", () => {
    type Model = { client: { name: string } };

    it("does not move when a field is written through a branch they came sharing", () => {
      const client = { name: "Ada" };
      const shared = new FormStore<Model>({ values: { client }, defaults: { client } });

      shared.register("client.name");
      shared.set("client.name", "Grace Hopper");

      expect(shared.values.client.name).toBe("Grace Hopper");
      expect(shared.defaults.client.name).toBe("Ada");
    });

    it("does not move when the very same object is handed in as both", () => {
      const data: Model = { client: { name: "Ada" } };
      const same = new FormStore<Model>({ values: data, defaults: data });

      same.register("client.name");
      same.set("client.name", "Grace Hopper");

      expect(same.defaults.client.name).toBe("Ada");
    });

    it("does not move when they were separated only at the top", () => {
      const data: Model = { client: { name: "Ada" } };
      const spread = new FormStore<Model>({ values: { ...data }, defaults: { ...data } });

      spread.register("client.name");
      spread.set("client.name", "Grace Hopper");

      expect(spread.defaults.client.name).toBe("Ada");
    });

    it("leaves the field dirty, which is what a base that stayed put means", () => {
      const data: Model = { client: { name: "Ada" } };
      const same = new FormStore<Model>({ values: data, defaults: data });

      same.register("client.name");
      same.set("client.name", "Grace Hopper");

      expect(hasFlag(same.getState("client.name")?.flags ?? 0, StateFlag.Dirty)).toBe(true);
    });

    it("still shares what only compares as itself", () => {
      const attachment = new File(["x"], "invoice.pdf");
      const withFile = new FormStore<{ attachment: File }>({ defaults: { attachment } });

      expect(withFile.defaults.attachment).toBe(attachment);
    });
  });

  describe("a date that names no instant", () => {
    it("is not dirty against the base it was born with", () => {
      const dated = new FormStore<{ when: Date }>({ defaults: { when: new Date("nope") } });

      dated.register("when");

      expect(hasFlag(dated.getState("when")?.flags ?? 0, StateFlag.Dirty)).toBe(false);
    });

    it("is dirty once a real instant replaces it", () => {
      const dated = new FormStore<{ when: Date }>({ defaults: { when: new Date("nope") } });

      dated.register("when");
      dated.set("when", new Date(0));

      expect(hasFlag(dated.getState("when")?.flags ?? 0, StateFlag.Dirty)).toBe(true);
    });
  });

  describe("a path that goes inside a single value", () => {
    class Money {
      constructor(
        readonly amount: number,
        readonly currency: string,
      ) {}
    }

    it("refuses to register inside a date", () => {
      const dated = new FormStore<{ when: Date }>({ defaults: { when: new Date(0) } });

      dated.register("when");

      expect(() => dated.register("when.getTime" as never)).toThrow(PathInsideValue);
    });

    it("refuses to register inside an instance the form cannot take apart", () => {
      const priced = new FormStore<{ total: Money }>({ defaults: { total: new Money(10, "PEN") } });

      expect(() => priced.register("total.amount" as never)).toThrow(PathInsideValue);
    });

    it("refuses whichever way the branch is reached", () => {
      const bagged = new FormStore<{ bag: Map<string, number> }>({ defaults: { bag: new Map() } });

      bagged.register("bag" as never);

      expect(() => bagged.register("bag.k" as never)).toThrow(PathInsideValue);
      expect(() => bagged.register("bag.k.deeper" as never)).toThrow(PathInsideValue);
    });

    it("refuses a write that would have created the branch on its way in", () => {
      const bagged = new FormStore<{ bag: Map<string, number> }>({ defaults: { bag: new Map() } });

      expect(() => bagged.set("bag.k" as never, 99 as never)).toThrow(PathInsideValue);
      expect(Object.keys(bagged.values.bag)).toEqual([]);
    });

    it("leaves the value it refused to reach into untouched", () => {
      const bag = new Map<string, number>();
      const bagged = new FormStore<{ bag: Map<string, number> }>({ values: { bag }, defaults: { bag } });

      expect(() => bagged.set("bag.k" as never, 99 as never)).toThrow(PathInsideValue);
      expect(bagged.values.bag).toBe(bag);
      expect(bagged.defaults.bag).toBe(bag);
    });

    it("still registers into a branch that is not there yet", () => {
      const empty = new FormStore<Invoice>({ defaults: {} as Invoice });

      expect(() => empty.register("invoice.client.name")).not.toThrow();
    });

    it("still registers under a value that is only a leaf for now", () => {
      const leafy = new FormStore<{ invoice: { client: { name: string } } }>({
        defaults: { invoice: { client: "Ada" as never } },
      });

      expect(() => leafy.register("invoice.client.name")).not.toThrow();
    });

    it("says which part of the path it could not go into", () => {
      const bagged = new FormStore<{ bag: Map<string, number> }>({ defaults: { bag: new Map() } });

      expect(() => bagged.register("bag.k" as never)).toThrow(/bag/);
    });
  });

  describe("a registration that is refused", () => {
    const withField = () => {
      const empty = new FormStore<Invoice>({ defaults: {} as Invoice });

      empty.register("invoice.client");

      return empty;
    };

    it("leaves the branch it passed through as it found it, on an invalid segment", () => {
      const empty = withField();

      expect(() => empty.register("invoice.client.__proto__" as never)).toThrow(InvalidPathSegment);

      expect(empty.getState("invoice.client")?.kind).toBe(StateKind.Field);
    });

    it("leaves it alone on an index no array could ever hold", () => {
      const empty = withField();

      expect(() => empty.register("invoice.client.99999999999999999999" as never)).toThrow(InvalidArrayIndex);

      expect(empty.getState("invoice.client")?.kind).toBe(StateKind.Field);
    });

    it("says nothing happened, not even to whoever watches the shape", () => {
      const empty = withField();

      expect(() => empty.set("invoice.client.__proto__" as never, "x" as never)).toThrow(InvalidPathSegment);

      expect(empty.getState("invoice.client")?.kind).toBe(StateKind.Field);
    });
  });

  describe("prototype pollution", () => {
    /**
     * `JSON.parse` does produce `__proto__` as an own key, so a patch built
     * from a server response is a real way to reach this.
     */
    it("refuses a __proto__ key carried by a patch", () => {
      const patch = new FormStore<Invoice>({ defaults: sample(), mode: "patch" });
      const hostile = JSON.parse('{"__proto__": {"polluted": "yes"}}');

      expect(() => patch.set("invoice.client", hostile as never)).toThrow(InvalidPathSegment);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("refuses __proto__ as a path segment", () => {
      expect(() => store.set("invoice.__proto__.polluted" as never, "yes" as never)).toThrow(InvalidPathSegment);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("refuses __proto__ when registering", () => {
      expect(() => store.register("invoice.__proto__.polluted" as never)).toThrow(InvalidPathSegment);
    });

    it("leaves a whole value carrying __proto__ inert, since nothing walks into it", () => {
      const hostile = JSON.parse('{"__proto__": {"pollutedWhole": "yes"}}');

      store.set("invoice.client", hostile as never);

      expect(({} as Record<string, unknown>).pollutedWhole).toBeUndefined();
    });
  });

  describe("guards", () => {
    it("finds nothing for a path that was never registered", () => {
      expect(store.getState("invoice.client.name")).toBeUndefined();
    });

    it("keeps its own defaults untouched by a write to values", () => {
      const withDefaults = new FormStore<Invoice>({ values: sample(), defaults: sample() });

      withDefaults.set("invoice.client.name", "Grace Hopper");

      expect(withDefaults.defaults.invoice.client.name).toBe("Ada Lovelace");
    });
  });
});
