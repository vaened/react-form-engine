/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { describe, expect, it } from "vitest";
import { PathValueClassifier } from "../value/PathValueClassifier";
import type { Scalar } from "../value/Scalar";
import { StateAssessor } from "./StateAssessor";

const sameDay: Scalar<Date> = {
  matches: (value): value is Date => value instanceof Date,
  equals: (left, right) => left.toDateString() === right.toDateString(),
};

describe("StateAssessor", () => {
  const assessor = new StateAssessor(new PathValueClassifier());

  it("resolves nothing when the value matches the default", () => {
    expect(assessor.assess("Ada Lovelace", "Ada Lovelace")).toBe(false);
  });

  it("resolves dirty when the value differs from the default", () => {
    expect(assessor.assess("Grace Hopper", "Ada Lovelace")).toBe(true);
  });

  it("treats two absent values as matching", () => {
    expect(assessor.assess(undefined, undefined)).toBe(false);
  });

  it("is dirty when the value is absent but the default is not", () => {
    expect(assessor.assess(undefined, "Ada Lovelace")).toBe(true);
  });

  it("answers with a value, so a form's worth of clean fields allocates nothing", () => {
    expect(assessor.assess("Ada", "Ada")).toBe(assessor.assess("Grace", "Grace"));
  });

  it("defers to a given scalar's own comparison instead of comparing by reference", () => {
    const withScalar = new StateAssessor(new PathValueClassifier([sameDay]));

    const morning = new Date("2026-01-01T08:00:00.000Z");
    const evening = new Date("2026-01-01T20:00:00.000Z");

    expect(withScalar.assess(morning, evening)).toBe(false);
  });

  it("says only whether the value moved, which is all a value alone can imply", () => {
    expect(typeof assessor.assess("Grace Hopper", "Ada Lovelace")).toBe("boolean");
  });
});
