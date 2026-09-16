/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { Path } from "../path";
import { FormWriting } from "./FormWriting";
import { type Invoice, InvoiceStructure, sampleInvoice } from "./observation/__fixtures__/invoice";
import type { EntryId } from "./path/types";
import { PathKind } from "./path/types";
import { StateAssessor } from "./state/StateAssessor";
import { StateGraph } from "./state/StateGraph";
import { FullWrite } from "./value/FullWrite";
import { PathValueClassifier } from "./value/PathValueClassifier";
import { ValueStore } from "./value/ValueStore";

const classifier = new PathValueClassifier();

describe("Transaction", () => {
  let form: InvoiceStructure;
  let value: ValueStore<Invoice>;
  let writing: FormWriting<Invoice>;
  let state: StateGraph;

  /** The public name of a location, so a read goes through the door a caller would use. */
  const at = (id: EntryId) => form.index.describe(id) as Path<Invoice>;

  beforeEach(() => {
    form = new InvoiceStructure();
    value = new ValueStore<Invoice>(form.index, classifier, sampleInvoice(), sampleInvoice());
    state = new StateGraph(form.index);
    writing = new FormWriting(
      form.index,
      value,
      state,
      new StateAssessor(classifier),
      classifier,
      new FullWrite(value, classifier),
    );
  });

  /** Every location the fixture names, so nothing on the chain goes unheard. */
  const everywhere = (): readonly EntryId[] => [
    form.root,
    form.client,
    form.email,
    form.name,
    form.addresses,
    form.address0,
    form.city0,
    form.reference0,
    form.address1,
    form.city1,
    form.details,
  ];

  /**
   * Everyone actually told about a write, in the order they were told.
   *
   * It listens on every location rather than asking who would be reached: what
   * a transaction reports is only observable by waiting for it.
   */
  const told = (id: EntryId, written: unknown = "unused") => {
    const heard: EntryId[] = [];
    const leaving = everywhere()
      .map((candidate) => {
        const node = value.find(candidate);

        return node && value.subscribe(node, () => heard.push(candidate));
      })
      .filter((leave) => leave !== undefined);

    writing.set(form.index.describe(id) as never, written as never);

    for (const leave of leaving) {
      leave();
    }

    return heard;
  };

  const named = (id: EntryId, written?: unknown) => told(id, written).map((entry) => form.index.describe(entry));

  describe("who is told about a write", () => {
    it("names the written location first and the root last", () => {
      value.register(form.city0);
      value.materialize(form.address0);

      expect(told(form.city0)).toEqual([form.city0, form.address0, form.root]);
    });

    it("never stops early, unlike the state", () => {
      value.register(form.city0);
      value.materialize(form.address0);
      value.materialize(form.client);

      expect(told(form.city0)).toEqual([form.city0, form.address0, form.client, form.root]);
    });

    it("reaches the root in one hop when no node is watched", () => {
      value.register(form.city0);

      expect(told(form.city0)).toEqual([form.city0, form.root]);
    });

    it("can start from a watched node rather than a field", () => {
      value.register(form.city0);
      value.materialize(form.address0);

      expect(named(form.address0, { city: "Arequipa" })).toEqual([
        "invoice.client.addresses.0.city",
        "invoice.client.addresses.0",
        "",
      ]);
    });

    it("reaches the root when not even an ancestor is watched", () => {
      expect(told(form.city0)).toEqual([form.root]);
    });

    it("reaches a watched ancestor when the array itself is not watched", () => {
      value.materialize(form.client);

      expect(told(form.city0)).toEqual([form.client, form.root]);
    });

    it("tells a watcher of the array about a write inside one of its items", () => {
      value.materialize(form.addresses);

      expect(told(form.city0)).toEqual([form.addresses, form.root]);
    });

    it("stops telling one that stopped watching", () => {
      value.register(form.city0);
      value.materialize(form.address0);

      value.dematerialize(form.address0);

      expect(told(form.city0)).toEqual([form.city0, form.root]);
    });

    it("keeps telling a node while a second watcher is still there", () => {
      value.register(form.city0);
      value.materialize(form.address0);
      value.materialize(form.address0);

      value.dematerialize(form.address0);

      expect(told(form.city0)).toEqual([form.city0, form.address0, form.root]);
    });
  });

  describe("writing a node reaches what is under it", () => {
    it("tells a registered field below, whose own value the write changed", () => {
      value.register(form.city0);
      value.materialize(form.address0);

      expect(told(form.address0, { city: "Arequipa" })).toEqual([form.city0, form.address0, form.root]);
    });

    /** Below is a list and not a path, so the nodes come before the fields. */
    it("reaches an object as readily as an array, at any depth", () => {
      value.register(form.city0);
      value.materialize(form.addresses);

      expect(told(form.client, sampleInvoice().invoice.client)).toEqual([form.addresses, form.city0, form.root]);
    });

    it("does not walk down for a field, which has nothing under it", () => {
      value.register(form.city0);
      value.materialize(form.address0);

      expect(told(form.city0)).toEqual([form.city0, form.address0, form.root]);
    });
  });

  /** One change is one telling, however many locations the caller spread it over. */
  describe("several locations as one transaction", () => {
    it("tells a shared ancestor once, not once per location", () => {
      value.register(form.city0);
      value.register(form.reference0);
      value.materialize(form.address0);

      const heard: EntryId[] = [];
      const leave = value.subscribe(value.entry(form.address0), () => heard.push(form.address0));

      writing.assign({
        "invoice.client.addresses.0.city": "Arequipa",
        "invoice.client.addresses.0.reference": "Al costado",
      } as never);

      leave();

      expect(heard).toEqual([form.address0]);
    });

    it("tells it again on the next transaction", () => {
      value.materialize(form.address0);

      const heard: EntryId[] = [];
      const leave = value.subscribe(value.entry(form.address0), () => heard.push(form.address0));

      writing.set("invoice.client.addresses.0.city" as never, "Arequipa" as never);
      writing.set("invoice.client.addresses.0.reference" as never, "Al costado" as never);

      leave();

      expect(heard).toEqual([form.address0, form.address0]);
    });
  });

  describe("the state is told too", () => {
    it("tells whoever waits on how a field stands once it turns dirty", () => {
      const field = state.register(form.city0);
      const heard: string[] = [];

      value.register(form.city0);
      state.subscribe(field, () => heard.push("city"));

      writing.set("invoice.client.addresses.0.city" as never, "Arequipa" as never);

      expect(heard).toEqual(["city"]);
    });

    it("says nothing to the state when the write leaves it where it was", () => {
      const field = state.register(form.city0);
      const heard: string[] = [];

      value.register(form.city0);
      writing.set("invoice.client.addresses.0.city" as never, "Arequipa" as never);
      state.subscribe(field, () => heard.push("city"));

      writing.set("invoice.client.addresses.0.city" as never, "Arequipa" as never);

      expect(heard).toEqual([]);
    });
  });

  /** A location two writes reached by different ways is still one change. */
  describe("reached twice by different ways", () => {
    it("tells it once when a node write and a write below it share a descendant", () => {
      value.materialize(form.address0);

      const heard: string[] = [];
      const leave = value.subscribe(value.entry(form.address0), () => heard.push("address"));

      writing.assign({
        "invoice.client": sampleInvoice().invoice.client,
        "invoice.client.addresses": sampleInvoice().invoice.client.addresses,
      } as never);

      leave();

      expect(heard).toEqual(["address"]);
    });
  });

  /** The same rule as the event emitter: the set is walked as it stands. */
  describe("committing while the listeners change", () => {
    it("still reaches one that leaves while the others are being told", () => {
      value.materialize(form.address0);

      const heard: string[] = [];
      const node = value.entry(form.address0);
      const leave = value.subscribe(node, () => heard.push("leaving"));

      value.subscribe(node, () => {
        leave();
        heard.push("second");
      });

      writing.set("invoice.client.addresses.0.city" as never, "Arequipa" as never);

      expect(heard).toEqual(["leaving", "second"]);

      heard.length = 0;
      writing.set("invoice.client.addresses.0.city" as never, "Trujillo" as never);

      expect(heard).toEqual(["second"]);
    });

    it("tells nobody about a location nobody waits on", () => {
      value.materialize(form.address0);

      expect(() => writing.set("invoice.client.addresses.0.city" as never, "Arequipa" as never)).not.toThrow();
    });
  });

  /** A value landing on what it already held did not move, so nothing moved. */
  describe("a write that changes nothing", () => {
    it("tells nobody", () => {
      value.register(form.city0);
      value.materialize(form.address0);

      expect(told(form.city0, "Lima")).toEqual([]);
    });

    it("leaves the reader holding the very same reference", () => {
      value.materialize(form.address0);

      const before = value.snapshot(at(form.address0));

      writing.set("invoice.client.addresses.0.city" as never, "Lima" as never);

      expect(value.snapshot(at(form.address0))).toBe(before);
    });

    /** Only a field is asked: a node handed the very object it already holds is
     * still copied in, or the form would keep two names for one slot. */
    it("still copies a node handed the object it already holds", () => {
      const held = value.value.invoice?.client;

      writing.set("invoice.client" as never, held as never);

      expect(value.value.invoice?.client).not.toBe(held);
      expect(value.value.invoice?.client).toEqual(held);
    });

    it("still tells everyone when the value actually moved", () => {
      value.register(form.city0);
      value.materialize(form.address0);

      expect(told(form.city0, "Arequipa")).toEqual([form.city0, form.address0, form.root]);
    });

    it("tells nobody about the one that stayed and everyone about the one that moved", () => {
      value.register(form.city0);
      value.register(form.reference0);
      value.materialize(form.address0);

      const heard: EntryId[] = [];
      const leave = value.subscribe(value.entry(form.address0), () => heard.push(form.address0));

      writing.assign({
        "invoice.client.addresses.0.city": "Lima",
        "invoice.client.addresses.0.reference": "Al costado",
      } as never);

      leave();

      expect(heard).toEqual([form.address0]);
    });
  });

  describe("what a reader is handed afterwards", () => {
    it("changes reference once something below it is written", () => {
      value.materialize(form.client);

      const before = value.snapshot(at(form.client));

      writing.set("invoice.client.addresses.0.city" as never, "Arequipa" as never);

      expect(value.snapshot(at(form.client))).not.toBe(before);
    });

    it("changes reference for any write anywhere, since the root is always on the chain", () => {
      const before = value.snapshot();

      writing.set("invoice.client.addresses.0.city" as never, "Arequipa" as never);

      expect(value.snapshot()).not.toBe(before);
    });

    it("changes every materialized ancestor's reference in one write, and nobody else's", () => {
      value.materialize(form.client);
      value.materialize(form.details);

      const client = value.snapshot(at(form.client));
      const details = value.snapshot(at(form.details));

      writing.set("invoice.client.addresses.0.city" as never, "Arequipa" as never);

      expect(value.snapshot(at(form.client))).not.toBe(client);
      expect(value.snapshot(at(form.details))).toBe(details);
    });

    it("gives a materialized descendant a new reference", () => {
      value.materialize(form.client);
      value.materialize(form.address0);

      const before = value.snapshot(at(form.address0));

      writing.set("invoice.client" as never, sampleInvoice().invoice.client as never);

      expect(value.snapshot(at(form.address0))).not.toBe(before);
    });

    it("hands it the value the form now holds, not the tree it just left", () => {
      value.materialize(form.address0);

      writing.set("invoice.client.addresses.0.city" as never, "Arequipa" as never);

      expect(value.snapshot(at(form.address0))).toEqual({ city: "Arequipa", reference: "Frente al parque principal" });
    });

    it("reads a field straight from the live value, uncached", () => {
      expect(value.snapshot(at(form.city0))).toBe("Lima");

      writing.set("invoice.client.addresses.0.city" as never, "Chorrillos" as never);

      expect(value.snapshot(at(form.city0))).toBe("Chorrillos");
    });
  });

  /**
   * A write brings names the form did not have, and the shape takes them on the
   * same way an array takes on positions: what the value carries is a location
   * the form can address, asked for or not.
   */
  describe("what a write leaves the shape knowing", () => {
    /** What the index holds under a location, said the way a reader would ask. */
    const under = (id: EntryId): string[] =>
      form.index
        .childrenOf(id)
        .map((child) => `${child.segment ?? form.index.positionOf(child.id)}:${PathKind[child.kind]}`);

    it("takes on every name a whole write brought, not only the ones asked for", () => {
      expect(under(form.client).sort()).toEqual(["addresses:Array", "email:Field", "name:Field"]);

      writing.set("invoice.client", sampleInvoice().invoice.client as never);

      expect(under(form.client).sort()).toEqual([
        "addresses:Array",
        "documentNumber:Field",
        "email:Field",
        "name:Field",
        "phones:Array",
      ]);
    });

    it("reaches inside every position a list brought", () => {
      writing.set("invoice.client.addresses", [
        { city: "Cusco", reference: "a" },
        { city: "Piura", reference: "b" },
      ] as never);

      const items = form.index.childrenOf(form.addresses);

      expect(items).toHaveLength(2);
      expect(under(items[0].id).sort()).toEqual(["city:Field", "reference:Field"]);
      expect(under(items[1].id).sort()).toEqual(["city:Field", "reference:Field"]);
    });

    it("says nothing new about a list of values that hold nothing inside", () => {
      writing.set("invoice.client.phones" as never, ["+51 1", "+51 2"] as never);

      const items = form.index.childrenOf(form.index.resolve("invoice.client.phones")?.id as never);

      expect(items.map((item) => PathKind[item.kind])).toEqual(["Field", "Field"]);
      expect(under(items[0].id)).toEqual([]);
    });

    /**
     * A location the shape already opened can still be handed a value the form
     * was told to hold whole, and there is nothing inside one of those to name.
     */
    it("takes on nothing from a value the form holds whole", () => {
      const holding = new PathValueClassifier([
        {
          matches: (value: unknown): value is never => typeof value === "object" && value !== null && "city" in value,
          equals: () => false,
        } as never,
      ]);
      const index = new InvoiceStructure();
      const value = new ValueStore<Invoice>(index.index, holding, sampleInvoice(), sampleInvoice());
      const held = new FormWriting(
        index.index,
        value,
        new StateGraph(index.index),
        new StateAssessor(holding),
        holding,
        new FullWrite(value, holding),
      );

      const before = index.index.childrenOf(index.client).map((child) => child.segment);

      held.set("invoice.client", { city: "Cusco" } as never);

      expect(index.index.childrenOf(index.client).map((child) => child.segment)).toEqual(before);
    });

    it("keeps what was already there rather than building it again", () => {
      const before = form.index.entry(form.city0);

      writing.set("invoice.client.addresses", [{ city: "Cusco", reference: "x" }] as never);

      expect(form.index.entry(form.city0)).toBe(before);
    });

    it("takes on nothing new when the write landed on one name", () => {
      const before = under(form.client).sort();

      writing.set("invoice.client.name", "Grace Hopper" as never);

      expect(under(form.client).sort()).toEqual(before);
    });
  });
});
