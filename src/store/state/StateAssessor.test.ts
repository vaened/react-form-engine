/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { describe, expect, it } from "vitest";
import { PathValueClassifier } from "../value/PathValueClassifier";
import type { Scalar } from "../value/Scalar";
import { StateAssessor } from "./StateAssessor";
import { StateFlag } from "./StateFlag";

const sameDay: Scalar<Date> = {
  matches: (value): value is Date => value instanceof Date,
  equals: (left, right) => left.toDateString() === right.toDateString(),
};

describe("StateAssessor", () => {
  const assessor = new StateAssessor(new PathValueClassifier());

  it("resolves nothing when the value matches the default", () => {
    expect(assessor.assess("Ada Lovelace", "Ada Lovelace")).toEqual({});
  });

  it("resolves dirty when the value differs from the default", () => {
    expect(assessor.assess("Grace Hopper", "Ada Lovelace")).toEqual({ flags: StateFlag.Dirty });
  });

  it("treats two absent values as matching", () => {
    expect(assessor.assess(undefined, undefined)).toEqual({});
  });

  it("is dirty when the value is absent but the default is not", () => {
    expect(assessor.assess(undefined, "Ada Lovelace")).toEqual({ flags: StateFlag.Dirty });
  });

  it("hands every unchanged field the same empty collection, so nothing allocates", () => {
    expect(assessor.assess("Ada", "Ada")).toBe(assessor.assess("Grace", "Grace"));
  });

  it("defers to a given scalar's own comparison instead of comparing by reference", () => {
    const withScalar = new StateAssessor(new PathValueClassifier([sameDay]));

    const morning = new Date("2026-01-01T08:00:00.000Z");
    const evening = new Date("2026-01-01T20:00:00.000Z");

    expect(withScalar.assess(morning, evening)).toEqual({});
  });

  it("never touches touched, invalid or validating: a value alone cannot imply them", () => {
    const result = assessor.assess("Grace Hopper", "Ada Lovelace");

    expect(result).not.toHaveProperty("errors");
    expect(Object.keys(result)).toEqual(["flags"]);
  });
});
