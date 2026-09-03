/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { PathKind } from "../path/types";
import { NATIVE_SCALARS, type Scalar } from "./Scalar";

/** What a value can turn out to be. Root is never the answer: it is not a value. */
export type ClassifiedKind = PathKind.Field | PathKind.Object | PathKind.Array;

/**
 * Reads a value and says what kind of location holds it.
 *
 * This is what stops a registration from taking a value apart forever: an
 * object is expanded into its parts unless a {@link Scalar} claims it.
 *
 * Given scalars are offered the value before the built-in ones, so treating a
 * `Date` as a day rather than an instant is a matter of passing one in.
 */
export class PathValueClassifier {
  readonly #scalars: readonly Scalar[];

  constructor(scalars: readonly Scalar[] = []) {
    this.#scalars = [...scalars, ...NATIVE_SCALARS];
  }

  classify(value: unknown): ClassifiedKind {
    if (!PathValueClassifier.#isComposite(value)) {
      return PathKind.Field;
    }

    if (this.for(value)) {
      return PathKind.Field;
    }

    return Array.isArray(value) ? PathKind.Array : PathKind.Object;
  }

  /**
   * Exposed so that a caller writing to one location repeatedly can resolve the
   * scalar once and keep it, instead of offering the value to every scalar.
   */
  for(value: unknown): Scalar | undefined {
    if (!PathValueClassifier.#isComposite(value)) {
      return undefined;
    }

    for (const scalar of this.#scalars) {
      if (scalar.matches(value)) {
        return scalar;
      }
    }

    return undefined;
  }

  /**
   * Two values reach a scalar's own comparison only when that scalar claims
   * both, so a `Money` and a `null` are never the same, whatever the user wrote.
   */
  equals(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) {
      return true;
    }

    const scalar = this.for(left);

    if (!scalar?.matches(right)) {
      return false;
    }

    return scalar.equals(left, right);
  }

  static #isComposite(value: unknown): boolean {
    return typeof value === "object" && value !== null;
  }
}
