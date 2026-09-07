/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { describe, expect, it } from "vitest";
import { PathKind } from "../path/types";
import { CircularValue } from "./errors";
import { isolate } from "./isolate";
import { PathValueClassifier } from "./PathValueClassifier";
import type { Scalar } from "./Scalar";

describe("isolate", () => {
  const classifier = new PathValueClassifier();

  describe("what it copies", () => {
    it("gives every object its own, so writing into one never reaches the other", () => {
      const values = { invoice: { client: { name: "Ada" } } };

      const base = isolate(values, classifier);
      values.invoice.client.name = "Grace Hopper";

      expect(base.invoice.client.name).toBe("Ada");
    });

    it("gives every array its own", () => {
      const values = { rows: [{ city: "Lima" }] };

      const base = isolate(values, classifier);
      values.rows.push({ city: "Cusco" });

      expect(base.rows).toHaveLength(1);
    });
  });

  describe("what it leaves alone", () => {
    /** A cloned File is no longer a File, so it stops comparing as the same one. */
    it("shares a File, which is the only way it keeps comparing as itself", () => {
      const file = new File(["x"], "invoice.pdf");

      const base = isolate({ attachment: file }, classifier);

      expect(base.attachment).toBe(file);
    });

    /** What a Map holds is not in properties anybody can read. */
    it("shares what it cannot read, instead of quietly emptying it", () => {
      const tags = new Map([["kind", "invoice"]]);
      const seen = new Set([1, 2, 3]);
      const pattern = /^invoice/;

      const base = isolate({ tags, seen, pattern }, classifier);

      expect(base.tags.size).toBe(1);
      expect(base.seen.size).toBe(3);
      expect(base.pattern.source).toBe("^invoice");
    });

    it("shares an instance rather than handing back a hollow one of the same shape", () => {
      class Money {
        #amount: number;
        readonly currency = "PEN";

        constructor(amount: number) {
          this.#amount = amount;
        }

        get amount() {
          return this.#amount;
        }
      }

      const total = new Money(10);
      const base = isolate({ total }, classifier);

      expect(base.total).toBe(total);
      expect(base.total.amount).toBe(10);
    });

    it("shares a pattern carrying its own properties, which copying would break", () => {
      const pattern: RegExp & { label?: string } = /^invoice/g;
      pattern.label = "code";

      const base = isolate({ pattern }, classifier);

      expect(base.pattern).toBe(pattern);
      expect(base.pattern.test("invoice-1")).toBe(true);
    });

    it("shares a typed array, whose indices read as properties but are not one", () => {
      const bytes = new Uint8Array([1, 2, 3]);
      const base = isolate({ bytes }, classifier);

      expect(base.bytes).toBe(bytes);
      expect(base.bytes.length).toBe(3);
    });

    it("still copies an empty object, which has nothing to read but plenty to write", () => {
      const empty = {};

      expect(isolate({ empty }, classifier).empty).not.toBe(empty);
    });

    it("shares a value it cannot copy, instead of refusing to build the base at all", () => {
      const onSave = () => {};

      expect(() => isolate({ onSave }, classifier)).not.toThrow();
      expect(isolate({ onSave }, classifier).onSave).toBe(onSave);
    });
  });

  describe("a key that is not a key", () => {
    /** `JSON.parse` is the one way an own `__proto__` reaches a form value. */
    it("leaves the copy a plain record, whatever the source carried", () => {
      const parsed = JSON.parse('{"invoice":{"__proto__":{"polluted":true},"series":"F001"}}');

      const base = isolate(parsed, classifier);

      expect(Object.getPrototypeOf(base.invoice)).toBe(Object.prototype);
      expect(base.invoice.series).toBe("F001");
    });

    it("keeps it out of the copy rather than assigning it, which would rewrite the prototype", () => {
      const parsed = JSON.parse('{"invoice":{"__proto__":{"polluted":true}}}');

      const base = isolate(parsed, classifier);

      expect(Object.hasOwn(base.invoice, "__proto__")).toBe(false);
      expect("polluted" in ({} as Record<string, unknown>)).toBe(false);
      expect(classifier.classify(base.invoice)).toBe(PathKind.Object);
    });
  });

  describe("a scalar that says how to copy itself", () => {
    it("copies a Date, which can be changed in place", () => {
      const when = new Date("2026-01-01T00:00:00.000Z");
      const untouched = when.getTime();

      const base = isolate({ when }, classifier);
      when.setUTCFullYear(2030);

      expect(base.when).not.toBe(when);
      expect(base.when.getTime()).toBe(untouched);
      expect(when.getTime()).not.toBe(untouched);
    });

    it("uses the copy a registered scalar brings", () => {
      class Money {
        constructor(public amount: number) {}
      }

      const money: Scalar<Money> = {
        matches: (value): value is Money => value instanceof Money,
        equals: (left, right) => left.amount === right.amount,
        isolate: (value) => new Money(value.amount),
      };

      const total = new Money(10);
      const base = isolate({ total }, new PathValueClassifier([money]));

      expect(base.total).not.toBe(total);
      expect(base.total).toBeInstanceOf(Money);
    });
  });

  describe("a place reached more than once", () => {
    it("gives each place its own, so writing one never reaches the other", () => {
      const address = { city: "Lima" };

      const base = isolate({ billing: address, shipping: address }, classifier);

      expect(base.billing).not.toBe(base.shipping);
      expect(base.billing).toEqual(base.shipping);
      expect(base.billing).not.toBe(address);
    });

    it("does the same for a place reached twice through a list", () => {
      const row = { city: "Lima" };

      const base = isolate({ rows: [row, row] }, classifier);

      expect(base.rows[0]).not.toBe(base.rows[1]);
      expect(base.rows[0]).toEqual({ city: "Lima" });
    });

    it("leaves alone what is reached twice but never written into", () => {
      const attachment = new File(["x"], "invoice.pdf");

      const base = isolate({ billing: attachment, shipping: attachment }, classifier);

      expect(base.billing).toBe(attachment);
      expect(base.shipping).toBe(attachment);
    });

    it("refuses a shape that points back at itself, which has no end to copy", () => {
      const client: Record<string, unknown> = { name: "Ada" };
      client.itself = client;

      expect(() => isolate({ client }, classifier)).toThrow(CircularValue);
    });

    it("says where the shape closed on itself", () => {
      const client: Record<string, unknown> = { name: "Ada" };
      client.itself = client;

      expect(() => isolate({ invoice: { client } }, classifier)).toThrow(/invoice\.client\.itself/);
    });

    it("does not take two places reaching one thing for a shape that closes", () => {
      const address = { city: "Lima" };

      expect(() => isolate({ billing: address, shipping: address }, classifier)).not.toThrow();
    });
  });
});
