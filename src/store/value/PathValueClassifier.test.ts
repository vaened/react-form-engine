/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import { PathKind } from "../path/types";
import { PathValueClassifier } from "./PathValueClassifier";
import type { Scalar } from "./Scalar";

type Money = { currency: string; amount: number };

const money = (currency: string, amount: number): Money => ({ currency, amount });

const moneyScalar: Scalar<Money> = {
  matches: (value): value is Money =>
    typeof value === "object" && value !== null && "currency" in value && "amount" in value,
  equals: (left, right) => left.currency === right.currency && left.amount === right.amount,
};

describe("PathValueClassifier", () => {
  let classifier: PathValueClassifier;

  beforeEach(() => {
    classifier = new PathValueClassifier();
  });

  describe("classifying", () => {
    it("takes every primitive for a field", () => {
      for (const value of ["", "Ada", 0, 7, true, false, 10n, Symbol("x"), undefined]) {
        expect(classifier.classify(value)).toBe(PathKind.Field);
      }
    });

    it("takes null for a field, not for an empty object", () => {
      expect(classifier.classify(null)).toBe(PathKind.Field);
    });

    it("takes a plain object for something to be taken apart", () => {
      expect(classifier.classify({ name: "Ada" })).toBe(PathKind.Object);
      expect(classifier.classify({})).toBe(PathKind.Object);
    });

    it("takes an array for an array, empty or not", () => {
      expect(classifier.classify([1, 2])).toBe(PathKind.Array);
      expect(classifier.classify([])).toBe(PathKind.Array);
    });

    it("stops at anything it has no way to walk into", () => {
      class Money {
        constructor(
          readonly amount: number,
          readonly currency: string,
        ) {}
      }

      for (const value of [new Map([["k", 1]]), new Set([1]), /abc/g, new Uint8Array([1]), new Money(10, "PEN")]) {
        expect(classifier.classify(value)).toBe(PathKind.Field);
      }
    });

    it("takes an object with no prototype apart, because it is still a plain record", () => {
      const bare = Object.create(null);
      bare.name = "Ada";

      expect(classifier.classify(bare)).toBe(PathKind.Object);
    });

    it("stops at a date instead of taking it apart", () => {
      expect(classifier.classify(new Date())).toBe(PathKind.Field);
    });

    it("stops at whatever a given scalar claims", () => {
      const scoped = new PathValueClassifier([moneyScalar]);

      expect(classifier.classify(money("PEN", 10))).toBe(PathKind.Object);
      expect(scoped.classify(money("PEN", 10))).toBe(PathKind.Field);
    });

    it("lets a scalar claim an array before the array rule sees it", () => {
      const point: Scalar<[number, number]> = {
        matches: (value): value is [number, number] => Array.isArray(value) && value.length === 2,
        equals: (left, right) => left[0] === right[0] && left[1] === right[1],
      };

      expect(new PathValueClassifier([point]).classify([1, 2])).toBe(PathKind.Field);
    });
  });

  describe("comparing", () => {
    it("settles primitives on identity", () => {
      expect(classifier.equals("Ada", "Ada")).toBe(true);
      expect(classifier.equals("Ada", "Grace")).toBe(false);
      expect(classifier.equals(0, 0)).toBe(true);
      expect(classifier.equals(null, null)).toBe(true);
      expect(classifier.equals(null, undefined)).toBe(false);
    });

    it("tells two dates apart by their instant, not by their identity", () => {
      const instant = 1_764_000_000_000;

      expect(classifier.equals(new Date(instant), new Date(instant))).toBe(true);
      expect(classifier.equals(new Date(instant), new Date(instant + 1))).toBe(false);
    });

    it("holds two dates that name no instant equal, so neither is dirty against the other", () => {
      expect(classifier.equals(new Date("nope"), new Date("also nope"))).toBe(true);
    });

    it("still tells one that names no instant from one that does", () => {
      expect(classifier.equals(new Date("nope"), new Date(0))).toBe(false);
      expect(classifier.equals(new Date(0), new Date("nope"))).toBe(false);
    });

    it("uses the comparison the scalar brought", () => {
      const scoped = new PathValueClassifier([moneyScalar]);

      expect(scoped.equals(money("PEN", 10), money("PEN", 10))).toBe(true);
      expect(scoped.equals(money("PEN", 10), money("USD", 10))).toBe(false);
      expect(scoped.equals(money("PEN", 10), money("PEN", 11))).toBe(false);
    });

    it("falls back to identity for an object nobody claimed", () => {
      expect(classifier.equals({ name: "Ada" }, { name: "Ada" })).toBe(false);
      expect(classifier.equals(money("PEN", 10), money("PEN", 10))).toBe(false);
    });

    it("never sends a value to a scalar that could not have claimed it", () => {
      const scoped = new PathValueClassifier([moneyScalar]);

      expect(scoped.equals(money("PEN", 10), null)).toBe(false);
      expect(scoped.equals(null, money("PEN", 10))).toBe(false);
      expect(scoped.equals(money("PEN", 10), "PEN 10")).toBe(false);
    });

    it("holds the same value equal to itself whatever it is", () => {
      const same = money("PEN", 10);

      expect(classifier.equals(same, same)).toBe(true);
    });
  });

  describe("resolving a scalar once", () => {
    it("hands back the one that claims a value", () => {
      const scoped = new PathValueClassifier([moneyScalar]);

      expect(scoped.for(money("PEN", 10))).toBe(moneyScalar);
    });

    it("hands back nothing for a value no scalar claims", () => {
      expect(classifier.for({ name: "Ada" })).toBeUndefined();
      expect(classifier.for([1, 2])).toBeUndefined();
    });

    it("hands back nothing for something that is not composite, without asking anyone", () => {
      let asked = 0;

      const counting: Scalar<never> = {
        matches: (_value): _value is never => {
          asked += 1;
          return false;
        },
        equals: () => false,
      };

      const scoped = new PathValueClassifier([counting]);

      expect(scoped.for("Ada")).toBeUndefined();
      expect(scoped.equals("Ada", "Grace")).toBe(false);
      expect(asked).toBe(0);
    });
  });

  describe("precedence", () => {
    it("offers a value to the given scalars before the built-in ones", () => {
      const byDay: Scalar<Date> = {
        matches: (value): value is Date => value instanceof Date,
        equals: (left, right) => left.toDateString() === right.toDateString(),
      };

      const scoped = new PathValueClassifier([byDay]);
      const morning = new Date("2026-08-28T08:00:00.000Z");
      const evening = new Date("2026-08-28T20:00:00.000Z");

      expect(scoped.equals(morning, evening)).toBe(true);
      expect(classifier.equals(morning, evening)).toBe(false);
    });

    it("keeps the first of two that claim the same value", () => {
      const first: Scalar<Money> = { ...moneyScalar, equals: () => true };
      const second: Scalar<Money> = { ...moneyScalar, equals: () => false };
      const scoped = new PathValueClassifier([first, second]);

      expect(scoped.for(money("PEN", 10))).toBe(first);
      expect(scoped.equals(money("PEN", 10), money("USD", 99))).toBe(true);
    });
  });
});
