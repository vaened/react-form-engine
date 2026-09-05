/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { PathValueClassifier } from "./PathValueClassifier";

/**
 * A copy of a value that no later write can reach.
 *
 * Only what the form writes into is copied: writing assigns into whatever holds
 * a value, so two trees that share nothing they can be written into cannot
 * disturb each other. What the form treats as a single value is left alone,
 * because copying it is at best pointless and at worst a lie — a cloned `File`
 * is no longer the same file, and stops comparing as one.
 *
 * A scalar that can be changed in place says so by bringing its own `isolate`.
 *
 * The same object reached twice comes back as the same copy, which keeps a
 * shape that points at itself from being followed forever.
 */
export const isolate = <TValue>(value: TValue, classifier: PathValueClassifier): TValue => {
  return copy(value, classifier, new Map<object, unknown>()) as TValue;
};

const copy = (value: unknown, classifier: PathValueClassifier, made: Map<object, unknown>): unknown => {
  const scalar = classifier.for(value);

  if (scalar) {
    return scalar.isolate ? scalar.isolate(value) : value;
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const already = made.get(value);

  if (already !== undefined) {
    return already;
  }

  if (Array.isArray(value)) {
    const items: unknown[] = [];

    made.set(value, items);

    for (const item of value) {
      items.push(copy(item, classifier, made));
    }

    return items;
  }

  const entries = Object.entries(value);

  // What a `Map` or a `RegExp` holds does not live in properties anybody can
  // read, so copying one produces an empty shell of the right shape. Nothing
  // readable means nothing copyable, and sharing beats quietly emptying it.
  if (entries.length === 0 && !isPlain(value)) {
    return value;
  }

  const properties: Record<string, unknown> = Object.create(Object.getPrototypeOf(value));

  made.set(value, properties);

  for (const [key, held] of entries) {
    properties[key] = copy(held, classifier, made);
  }

  return properties;
};

const isPlain = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};
