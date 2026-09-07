/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { PathKind } from "../path/types";
import { NATIVE_SCALARS, type Scalar } from "./Scalar";
import type { ValueContainer } from "./types";

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
    if (!this.isContainer(value)) {
      return PathKind.Field;
    }

    return Array.isArray(value) ? PathKind.Array : PathKind.Object;
  }

  /**
   * Whether the engine may take this value apart.
   *
   * It says no for two unrelated reasons. A scalar claims the value, so
   * whatever shape it happens to have, it was declared to be one thing — a
   * record of two numbers may be a point. Or nothing claims it and it keeps
   * what it holds somewhere no property reaches, so reading its keys is not
   * reading it and the pieces would not add up to it again.
   *
   * A record and a list are what is left: everything they are is in their
   * properties, so the parts can be reached one by one and put back.
   */
  isContainer(value: unknown): value is ValueContainer {
    if (!PathValueClassifier.#isComposite(value)) {
      return false;
    }

    if (this.for(value)) {
      return false;
    }

    return Array.isArray(value) || PathValueClassifier.#isPlain(value);
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

  static #isComposite(value: unknown): value is object {
    return typeof value === "object" && value !== null;
  }

  static #isPlain(value: object): boolean {
    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
  }
}
