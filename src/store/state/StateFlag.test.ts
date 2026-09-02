/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { describe, expect, it } from "vitest";
import { hasFlag, StateFlag, setFlag } from "./StateFlag";

const { Dirty, Touched, Invalid, Validating } = StateFlag;

const FLAGS = [
  { name: "dirty", flag: Dirty },
  { name: "touched", flag: Touched },
  { name: "invalid", flag: Invalid },
  { name: "validating", flag: Validating },
] as const;

const ALL = Dirty | Touched | Invalid | Validating;

describe("StateFlag", () => {
  it("gives every flag its own bit", () => {
    const bits = FLAGS.map((entry) => entry.flag);

    expect(new Set(bits).size).toBe(bits.length);
    expect(bits.reduce((mask, flag) => mask | flag, 0)).toBe(ALL);
  });

  describe.each(FLAGS)("$name", ({ flag }) => {
    const others = FLAGS.filter((candidate) => candidate.flag !== flag);

    it("is set on its own without disturbing the others", () => {
      const flags = setFlag(0, flag, true);

      expect(hasFlag(flags, flag)).toBe(true);

      for (const other of others) {
        expect(hasFlag(flags, other.flag)).toBe(false);
      }
    });

    it("is cleared on its own without disturbing the others", () => {
      const flags = setFlag(ALL, flag, false);

      expect(hasFlag(flags, flag)).toBe(false);

      for (const other of others) {
        expect(hasFlag(flags, other.flag)).toBe(true);
      }
    });
  });

  describe("hasFlag", () => {
    it("reports every flag of a mask built from several", () => {
      const flags = Dirty | Validating;

      expect(hasFlag(flags, Dirty)).toBe(true);
      expect(hasFlag(flags, Validating)).toBe(true);
      expect(hasFlag(flags, Touched)).toBe(false);
      expect(hasFlag(flags, Invalid)).toBe(false);
    });

    it("requires every bit of a composite flag to be present", () => {
      expect(hasFlag(ALL, Dirty | Touched)).toBe(true);
      expect(hasFlag(Dirty, Dirty | Touched)).toBe(false);
    });

    it("finds nothing in an empty mask", () => {
      for (const { flag } of FLAGS) {
        expect(hasFlag(0, flag)).toBe(false);
      }
    });
  });

  describe("setFlag", () => {
    it("is idempotent", () => {
      const once = setFlag(0, Dirty, true);

      expect(setFlag(once, Dirty, true)).toBe(once);
      expect(setFlag(0, Dirty, false)).toBe(0);
    });

    it("round trips back to where it started", () => {
      expect(setFlag(setFlag(Touched, Dirty, true), Dirty, false)).toBe(Touched);
    });
  });
});
