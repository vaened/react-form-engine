/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

/**
 * Teaches the engine to treat a shape as a single value.
 *
 * Without one of these, an object is taken apart: every property it holds
 * becomes a location of its own. A scalar says the opposite — do not look
 * inside, and here is how to tell two of them apart.
 *
 * `matches` decides whether a value is one of these at all, and `equals`
 * answers the only question the engine ever asks about a value it does not
 * look into: did it change.
 *
 * `isolate` is for a value that can be changed in place. The base a form
 * compares against must not change with it, so a scalar that can be mutated
 * says here how to make a copy of itself. Leaving it out means the value is
 * shared, which is what an unchangeable one wants: a `File` compares as the
 * same file only while it stays the same object.
 */
export interface Scalar<T = unknown> {
  matches(value: unknown): value is T;
  equals(left: T, right: T): boolean;
  isolate?(value: T): T;
}

export const dateScalar: Scalar<Date> = {
  matches: (value): value is Date => value instanceof Date,
  // Two dates that name no instant are the same nothing, but `NaN` compares
  // equal to no value at all, so a form born on one would start out dirty
  // against the base it was copied from.
  equals: (left, right) => Object.is(left.getTime(), right.getTime()),
  isolate: (value) => new Date(value.getTime()),
};

export const NATIVE_SCALARS: readonly Scalar[] = [dateScalar];
