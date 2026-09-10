/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues } from "../../path";
import type { PathIndex } from "../path/PathIndex";
import { type PathIndexEntry, PathKind } from "../path/types";
import { CircularPatchValue } from "./errors";
import type { PathValueClassifier } from "./PathValueClassifier";
import type { ValueStore } from "./ValueStore";
import type { ValueWrite } from "./ValueWrite";

/**
 * Only what the value carries lands, and only where it carries it.
 *
 * A key that is not there was never meant to be written, so nothing under it is
 * visited: its value, its state and the identity of its items stay as they
 * were. A key that is there lands as it came, `null` and `undefined` included,
 * because they are values a caller may mean.
 */
export class PatchWrite<TValues extends FormValues = FormValues> implements ValueWrite {
  readonly #index: PathIndex<TValues>;
  readonly #value: ValueStore<TValues>;
  readonly #classifier: PathValueClassifier;

  constructor(index: PathIndex<TValues>, value: ValueStore<TValues>, classifier: PathValueClassifier) {
    this.#index = index;
    this.#value = value;
    this.#classifier = classifier;
  }

  write(entry: PathIndexEntry, value: unknown): readonly PathIndexEntry[] {
    const written: PathIndexEntry[] = [];

    this.#descend(entry, value, written, undefined);

    return written;
  }

  /**
   * Descent stops wherever a whole value belongs: at a location that is not an
   * object, and at anything the classifier answers for on its own, such as a
   * date, which is an object nobody means to be walked into.
   */
  #descend(
    at: PathIndexEntry,
    incoming: unknown,
    written: PathIndexEntry[],
    descending: Set<object> | undefined,
  ): void {
    if (
      at.kind !== PathKind.Object ||
      !PatchWrite.#keyed(incoming) ||
      this.#classifier.classify(incoming) !== PathKind.Object
    ) {
      this.#value.write(at, incoming, () => {});
      written.push(at);

      return;
    }

    // Only a descent can loop, and a leaf write never descends, so the set that
    // remembers the way down is not built until there is a way down.
    const inside = descending ?? new Set<object>();

    if (inside.has(incoming)) {
      throw new CircularPatchValue(this.#index.describe(at.id));
    }

    inside.add(incoming);

    for (const key of Object.keys(incoming)) {
      const child = this.#index.ensureChild(at, key, this.#classifier.classify(incoming[key]));

      this.#descend(child, incoming[key], written, inside);
    }

    inside.delete(incoming);
  }

  static #keyed(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
