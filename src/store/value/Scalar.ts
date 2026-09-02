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
 */
export interface Scalar<T = unknown> {
  matches(value: unknown): value is T;
  equals(left: T, right: T): boolean;
}

export const dateScalar: Scalar<Date> = {
  matches: (value): value is Date => value instanceof Date,
  equals: (left, right) => left.getTime() === right.getTime(),
};

export const blobScalar: Scalar<Blob> = {
  matches: (value): value is Blob => typeof Blob !== "undefined" && value instanceof Blob,
  equals: (left, right) => left === right,
};

export const fileScalar: Scalar<File> = {
  matches: (value): value is File => typeof File !== "undefined" && value instanceof File,
  equals: (left, right) => left === right,
};

export const fileListScalar: Scalar<FileList> = {
  matches: (value): value is FileList => typeof FileList !== "undefined" && value instanceof FileList,
  equals: (left, right) => left === right,
};

export const NATIVE_SCALARS: readonly Scalar[] = [dateScalar, fileScalar, fileListScalar, blobScalar];
