/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import { type StateAggregate, StateFlag, StateTransition } from "./StateTransition";

const { Dirty, Touched, Invalid, Validating } = StateFlag;

/**
 * `apply`, `add`, `derive` and `isUnderflowed` are four parallel lines each.
 * Exercising the flags together would hide a line that reads the wrong counter,
 * so every one of them is driven flag by flag.
 */
const FLAGS = [
  { name: "dirty", flag: Dirty, counter: "dirty" },
  { name: "touched", flag: Touched, counter: "touched" },
  { name: "invalid", flag: Invalid, counter: "invalid" },
  { name: "validating", flag: Validating, counter: "validating" },
] as const satisfies readonly { name: string; flag: StateFlag; counter: keyof StateAggregate }[];

const ALL = Dirty | Touched | Invalid | Validating;

describe("StateTransition", () => {
  let transition: StateTransition;

  beforeEach(() => {
    transition = new StateTransition();
  });

  const counters = (aggregate: StateAggregate) => [
    aggregate.dirty,
    aggregate.touched,
    aggregate.invalid,
    aggregate.validating,
  ];

  describe.each(FLAGS)("$name in isolation", ({ flag, counter }) => {
    const others = FLAGS.filter((candidate) => candidate.counter !== counter);

    it("is the only counter that grows when a child gains it", () => {
      const aggregate = transition.apply(transition.empty(), 0, flag);

      expect(aggregate[counter]).toBe(1);
      for (const other of others) {
        expect(aggregate[other.counter]).toBe(0);
      }
    });

    it("is the only counter that shrinks when a child loses it", () => {
      const full = transition.add(transition.empty(), ALL);
      const aggregate = transition.apply(full, ALL, transition.setFlag(ALL, flag, false));

      expect(aggregate[counter]).toBe(0);
      for (const other of others) {
        expect(aggregate[other.counter]).toBe(1);
      }
    });

    it("is the only counter that add fills", () => {
      const aggregate = transition.add(transition.empty(), flag);

      expect(aggregate[counter]).toBe(1);
      for (const other of others) {
        expect(aggregate[other.counter]).toBe(0);
      }
    });

    it("is the only flag derive produces from its counter", () => {
      const flags = transition.derive({ ...transition.empty(), [counter]: 1 });

      expect(flags).toBe(flag);
    });

    it("is the only flag missing when derive sees every other counter", () => {
      const full = transition.empty();

      for (const candidate of FLAGS) {
        full[candidate.counter] = 1;
      }

      full[counter] = 0;

      const flags = transition.derive(full);

      expect(flags).toBe(transition.setFlag(ALL, flag, false));
    });

    it("reports an underflow on its own counter", () => {
      expect(transition.isUnderflowed({ ...transition.empty(), [counter]: -1 })).toBe(true);
    });

    it("survives a set and clear round trip without disturbing the others", () => {
      const set = transition.setFlag(0, flag, true);

      expect(transition.hasFlag(set, flag)).toBe(true);
      for (const other of others) {
        expect(transition.hasFlag(set, other.flag)).toBe(false);
      }

      const cleared = transition.setFlag(ALL, flag, false);

      expect(transition.hasFlag(cleared, flag)).toBe(false);
      for (const other of others) {
        expect(transition.hasFlag(cleared, other.flag)).toBe(true);
      }
    });
  });

  describe("bitmask", () => {
    it("reports every flag of a mask built from several", () => {
      const flags = Dirty | Validating;

      expect(transition.hasFlag(flags, Dirty)).toBe(true);
      expect(transition.hasFlag(flags, Validating)).toBe(true);
      expect(transition.hasFlag(flags, Touched)).toBe(false);
      expect(transition.hasFlag(flags, Invalid)).toBe(false);
    });

    it("requires every bit of a composite flag to be present", () => {
      expect(transition.hasFlag(ALL, Dirty | Touched)).toBe(true);
      expect(transition.hasFlag(Dirty, Dirty | Touched)).toBe(false);
    });

    it("is idempotent", () => {
      const once = transition.setFlag(0, Dirty, true);

      expect(transition.setFlag(once, Dirty, true)).toBe(once);
      expect(transition.setFlag(0, Dirty, false)).toBe(0);
    });
  });

  describe("apply", () => {
    it("does nothing when the child did not change", () => {
      const before = transition.add(transition.empty(), Dirty | Touched);

      expect(counters(transition.apply(before, Dirty | Touched, Dirty | Touched))).toEqual(counters(before));
    });

    it("moves several counters in one change", () => {
      const before = transition.add(transition.empty(), Dirty | Touched);
      const after = transition.apply(before, Dirty | Touched, Invalid);

      expect(after).toEqual({ dirty: 0, touched: 0, invalid: 1, validating: 0 });
    });

    it("keeps counting past one, so a second contributor does not hide the first", () => {
      let aggregate = transition.apply(transition.empty(), 0, Touched);

      aggregate = transition.apply(aggregate, 0, Touched);

      expect(aggregate.touched).toBe(2);
      expect(transition.hasFlag(transition.derive(aggregate), Touched)).toBe(true);

      aggregate = transition.apply(aggregate, Touched, 0);

      expect(aggregate.touched).toBe(1);
      expect(transition.hasFlag(transition.derive(aggregate), Touched)).toBe(true);
    });

    it("does not mutate the aggregate it receives", () => {
      const before = transition.empty();

      transition.apply(before, 0, ALL);

      expect(before).toEqual({ dirty: 0, touched: 0, invalid: 0, validating: 0 });
    });
  });

  describe("add", () => {
    it("accumulates across contributors", () => {
      let aggregate = transition.add(transition.empty(), Dirty);

      aggregate = transition.add(aggregate, Dirty | Touched);

      expect(aggregate).toEqual({ dirty: 2, touched: 1, invalid: 0, validating: 0 });
    });

    it("does nothing for a contributor with no flags", () => {
      const before = transition.add(transition.empty(), ALL);

      expect(transition.add(before, 0)).toEqual(before);
    });

    it("does not mutate the aggregate it receives", () => {
      const before = transition.empty();

      transition.add(before, ALL);

      expect(before).toEqual({ dirty: 0, touched: 0, invalid: 0, validating: 0 });
    });
  });

  describe("derive", () => {
    it("produces no flags for an empty aggregate", () => {
      expect(transition.derive(transition.empty())).toBe(0);
    });

    it("produces every flag when every counter is positive", () => {
      expect(transition.derive({ dirty: 1, touched: 2, invalid: 3, validating: 4 })).toBe(ALL);
    });

    it("does not change while a count stays above zero", () => {
      const three = transition.derive({ dirty: 3, touched: 0, invalid: 0, validating: 0 });
      const one = transition.derive({ dirty: 1, touched: 0, invalid: 0, validating: 0 });

      expect(three).toBe(one);
    });

    it("treats an underflowed counter as absent rather than present", () => {
      expect(transition.derive({ dirty: -2, touched: 0, invalid: 0, validating: 0 })).toBe(0);
    });
  });

  describe("empty", () => {
    it("starts every counter at zero", () => {
      expect(transition.empty()).toEqual({ dirty: 0, touched: 0, invalid: 0, validating: 0 });
    });

    it("hands out a new object every time, so nodes never share counters", () => {
      expect(transition.empty()).not.toBe(transition.empty());
    });
  });

  describe("underflow", () => {
    it("accepts an aggregate whose counters are all at zero or above", () => {
      expect(transition.isUnderflowed(transition.empty())).toBe(false);
      expect(transition.isUnderflowed({ dirty: 4, touched: 0, invalid: 2, validating: 1 })).toBe(false);
    });

    it("appears when a delta is lost", () => {
      const lost = transition.apply(transition.empty(), Touched, 0);

      expect(lost.touched).toBe(-1);
      expect(transition.isUnderflowed(lost)).toBe(true);
    });
  });
});
