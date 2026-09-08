/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ArrayStateAggregate } from "./ArrayStateAggregate";
import { hasFlag, StateFlag } from "./StateFlag";

const { Dirty, Touched, Invalid, Validating } = StateFlag;

describe("ArrayStateAggregate", () => {
  let aggregate: ArrayStateAggregate;

  beforeEach(() => {
    aggregate = new ArrayStateAggregate();
  });

  describe("what it holds against what its base held", () => {
    it("starts out holding as much as its base, so nothing is dirty until measured", () => {
      expect(aggregate.length).toBe(0);
      expect(aggregate.expected).toBe(0);
      expect(aggregate.isDirty).toBe(false);
    });

    it("is dirty on its own once the two counts disagree", () => {
      aggregate.measured(1, 3);

      expect(aggregate.isDirty).toBe(true);
    });

    it("does not care which of the two is larger", () => {
      aggregate.measured(3, 1);

      expect(aggregate.isDirty).toBe(true);
    });

    it("is clean while they agree, however many items that is", () => {
      aggregate.measured(7, 7);

      expect(aggregate.isDirty).toBe(false);
    });

    it("goes back to clean when a later count matches again", () => {
      aggregate.measured(1, 3);
      aggregate.measured(3, 3);

      expect(aggregate.isDirty).toBe(false);
    });

    it("reports through the flags the chain travels on, not only through the question", () => {
      aggregate.measured(1, 3);

      expect(hasFlag(aggregate.flags, Dirty)).toBe(true);

      aggregate.measured(3, 3);

      expect(hasFlag(aggregate.flags, Dirty)).toBe(false);
    });

    it("says nothing about the flags no count can speak for", () => {
      aggregate.measured(1, 3);

      expect(hasFlag(aggregate.flags, Touched)).toBe(false);
      expect(hasFlag(aggregate.flags, Invalid)).toBe(false);
      expect(hasFlag(aggregate.flags, Validating)).toBe(false);
    });
  });

  describe("alongside what its children report", () => {
    it("stays dirty on a matching count while a child carries it", () => {
      aggregate.add(Dirty);
      aggregate.measured(3, 3);

      expect(aggregate.isDirty).toBe(true);
      expect(hasFlag(aggregate.flags, Dirty)).toBe(true);
    });

    it("stays dirty on its own count after the last child that carried it stops", () => {
      aggregate.measured(1, 3);
      aggregate.add(Dirty);
      aggregate.fold(Dirty, 0);

      expect(aggregate.dirty).toBe(0);
      expect(aggregate.isDirty).toBe(true);
    });

    it("keeps counting children the way any node does", () => {
      aggregate.measured(3, 3);
      aggregate.add(Touched | Invalid);

      expect(aggregate.touched).toBe(1);
      expect(aggregate.invalid).toBe(1);
      expect(hasFlag(aggregate.flags, Touched)).toBe(true);
      expect(hasFlag(aggregate.flags, Invalid)).toBe(true);
    });

    it("leaves its own count out of the children it counts", () => {
      aggregate.measured(1, 3);

      expect(aggregate.dirty).toBe(0);
      expect(aggregate.isUnderflowed()).toBe(false);
    });
  });
});
