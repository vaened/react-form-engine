/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { CircularValue } from "./errors";
import type { PathValueClassifier } from "./PathValueClassifier";

const PROTOTYPE_KEY = "__proto__";

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
 * A place reached twice gets its own copy each time. The form addresses a value
 * by where it sits, so two places holding one object are two names for one
 * slot: writing either would write both, and only the one asked for would be
 * told. Copying gives each place back what the shape said it had.
 */
export const isolate = <TValue>(value: TValue, classifier: PathValueClassifier): TValue => {
  return copy(value, classifier, new Set<object>(), []) as TValue;
};

/**
 * `descending` is what is currently being walked through, not what has been
 * seen: a place reached twice side by side is two places, while one reached
 * again on the way down is the same place, and copying it would never end.
 */
const copy = (value: unknown, classifier: PathValueClassifier, descending: Set<object>, trail: string[]): unknown => {
  if (!classifier.isContainer(value)) {
    const scalar = classifier.for(value);

    return scalar?.isolate ? scalar.isolate(value) : value;
  }

  if (descending.has(value)) {
    throw new CircularValue(trail.join("."));
  }

  descending.add(value);

  const made = Array.isArray(value)
    ? copyItems(value, classifier, descending, trail)
    : copyProperties(value, classifier, descending, trail);

  descending.delete(value);

  return made;
};

const copyItems = (
  value: readonly unknown[],
  classifier: PathValueClassifier,
  descending: Set<object>,
  trail: string[],
): unknown[] => {
  const items: unknown[] = [];

  for (let index = 0; index < value.length; index++) {
    trail.push(String(index));
    items.push(copy(value[index], classifier, descending, trail));
    trail.pop();
  }

  return items;
};

const copyProperties = (
  value: object,
  classifier: PathValueClassifier,
  descending: Set<object>,
  trail: string[],
): Record<string, unknown> => {
  const properties: Record<string, unknown> = Object.create(Object.getPrototypeOf(value));

  for (const key in value) {
    // Assigning `__proto__` replaces the prototype of the copy instead of
    // naming a property on it, which would leave the base a shape no path can
    // reach and the engine no longer reads as a record. A path cannot name it
    // either, so there is nothing on the other side to keep it for.
    if (key === PROTOTYPE_KEY || !Object.hasOwn(value, key)) {
      continue;
    }

    trail.push(key);
    properties[key] = copy((value as Record<string, unknown>)[key], classifier, descending, trail);
    trail.pop();
  }

  return properties;
};
