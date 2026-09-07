/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { describe, expect, it } from "vitest";
import { StateAggregate } from "./StateAggregate";
import { hasFlag, StateFlag, setFlag } from "./StateFlag";

const { Dirty, Touched, Invalid, Validating } = StateFlag;

/**
 * `fold`, `add`, `derive` and `isUnderflowed` are four parallel lines each.
 * Exercising the flags together would hide a line that reads the wrong counter,
 * so every one of them is driven flag by flag.
 */
const FLAGS = [
  { name: "dirty", flag: Dirty, counter: "dirty" },
  { name: "touched", flag: Touched, counter: "touched" },
  { name: "invalid", flag: Invalid, counter: "invalid" },
  { name: "validating", flag: Validating, counter: "validating" },
] as const satisfies readonly {
  name: string;
  flag: StateFlag;
  counter: "dirty" | "touched" | "invalid" | "validating";
}[];

const ALL = Dirty | Touched | Invalid | Validating;

const counters = (aggregate: StateAggregate) => ({
  dirty: aggregate.dirty,
  touched: aggregate.touched,
  invalid: aggregate.invalid,
  validating: aggregate.validating,
});

describe("StateAggregate", () => {
  describe("a fresh one", () => {
    it("starts every counter at zero and derives no flags", () => {
      const aggregate = new StateAggregate();

      expect(counters(aggregate)).toEqual({ dirty: 0, touched: 0, invalid: 0, validating: 0 });
      expect(aggregate.flags).toBe(0);
      expect(aggregate.isUnderflowed()).toBe(false);
    });

    it("belongs to one node only, so two are never the same object", () => {
      const first = new StateAggregate();
      const second = new StateAggregate();

      first.add(ALL);

      expect(second.flags).toBe(0);
    });
  });

  describe.each(FLAGS)("$name in isolation", ({ flag, counter }) => {
    const others = FLAGS.filter((candidate) => candidate.counter !== counter);

    it("is the only counter that grows when a child gains it", () => {
      const aggregate = new StateAggregate();

      aggregate.fold(0, flag);

      expect(aggregate[counter]).toBe(1);

      for (const other of others) {
        expect(aggregate[other.counter]).toBe(0);
      }
    });

    it("is the only counter that shrinks when a child loses it", () => {
      const aggregate = new StateAggregate();

      aggregate.add(ALL);
      aggregate.fold(ALL, setFlag(ALL, flag, false));

      expect(aggregate[counter]).toBe(0);

      for (const other of others) {
        expect(aggregate[other.counter]).toBe(1);
      }
    });

    it("is the only counter that add fills", () => {
      const aggregate = new StateAggregate();

      aggregate.add(flag);

      expect(aggregate[counter]).toBe(1);

      for (const other of others) {
        expect(aggregate[other.counter]).toBe(0);
      }
    });

    it("is the only flag its counter produces", () => {
      const aggregate = new StateAggregate();

      aggregate.add(flag);

      expect(aggregate.flags).toBe(flag);
    });

    it("is the only flag missing when every other counter is up", () => {
      const aggregate = new StateAggregate();

      aggregate.add(ALL);
      aggregate.fold(flag, 0);

      expect(aggregate.flags).toBe(setFlag(ALL, flag, false));
    });

    it("reports an underflow on its own counter", () => {
      const aggregate = new StateAggregate();

      aggregate.fold(flag, 0);

      expect(aggregate.isUnderflowed()).toBe(true);
    });
  });

  describe("fold", () => {
    it("changes the aggregate in place, because it belongs to a single node", () => {
      const aggregate = new StateAggregate();
      const returned = aggregate.fold(0, Dirty);

      expect(returned).toBeUndefined();
      expect(aggregate.dirty).toBe(1);
    });

    it("does nothing when the child did not change", () => {
      const aggregate = new StateAggregate();

      aggregate.add(Dirty | Touched);
      aggregate.fold(Dirty | Touched, Dirty | Touched);

      expect(counters(aggregate)).toEqual({ dirty: 1, touched: 1, invalid: 0, validating: 0 });
    });

    it("moves several counters in one change", () => {
      const aggregate = new StateAggregate();

      aggregate.add(Dirty | Touched);
      aggregate.fold(Dirty | Touched, Invalid);

      expect(counters(aggregate)).toEqual({ dirty: 0, touched: 0, invalid: 1, validating: 0 });
    });

    it("keeps counting past one, so a second contributor does not hide the first", () => {
      const aggregate = new StateAggregate();

      aggregate.fold(0, Touched);
      aggregate.fold(0, Touched);

      expect(aggregate.touched).toBe(2);
      expect(hasFlag(aggregate.flags, Touched)).toBe(true);

      aggregate.fold(Touched, 0);

      expect(aggregate.touched).toBe(1);
      expect(hasFlag(aggregate.flags, Touched)).toBe(true);

      aggregate.fold(Touched, 0);

      expect(hasFlag(aggregate.flags, Touched)).toBe(false);
    });
  });

  describe("add", () => {
    it("accumulates across contributors", () => {
      const aggregate = new StateAggregate();

      aggregate.add(Dirty);
      aggregate.add(Dirty | Touched);

      expect(counters(aggregate)).toEqual({ dirty: 2, touched: 1, invalid: 0, validating: 0 });
    });

    it("does nothing for a contributor with no flags", () => {
      const aggregate = new StateAggregate();

      aggregate.add(ALL);
      aggregate.add(0);

      expect(counters(aggregate)).toEqual({ dirty: 1, touched: 1, invalid: 1, validating: 1 });
    });
  });

  describe("derive", () => {
    it("produces every flag when every counter is positive", () => {
      const aggregate = new StateAggregate();

      aggregate.add(ALL);
      aggregate.add(Touched | Invalid | Validating);
      aggregate.add(Invalid | Validating);
      aggregate.add(Validating);

      expect(counters(aggregate)).toEqual({ dirty: 1, touched: 2, invalid: 3, validating: 4 });
      expect(aggregate.flags).toBe(ALL);
    });

    it("does not change while a count stays above zero", () => {
      const many = new StateAggregate();
      const one = new StateAggregate();

      many.add(Dirty);
      many.add(Dirty);
      many.add(Dirty);
      one.add(Dirty);

      expect(many.dirty).toBe(3);
      expect(many.flags).toBe(one.flags);
    });

    it("treats an underflowed counter as absent rather than present", () => {
      const aggregate = new StateAggregate();

      aggregate.fold(Dirty, 0);
      aggregate.fold(Dirty, 0);

      expect(aggregate.dirty).toBe(-2);
      expect(aggregate.flags).toBe(0);
    });
  });

  describe("isUnderflowed", () => {
    it("accepts counters at zero or above", () => {
      const aggregate = new StateAggregate();

      aggregate.add(Dirty | Invalid | Validating);
      aggregate.add(Dirty | Invalid);
      aggregate.add(Dirty);
      aggregate.add(Dirty);

      expect(counters(aggregate)).toEqual({ dirty: 4, touched: 0, invalid: 2, validating: 1 });
      expect(aggregate.isUnderflowed()).toBe(false);
    });

    it("appears when a delta is lost", () => {
      const aggregate = new StateAggregate();

      aggregate.fold(Touched, 0);

      expect(aggregate.touched).toBe(-1);
      expect(aggregate.isUnderflowed()).toBe(true);
    });
  });
});
