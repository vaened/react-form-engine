/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues } from "../path";
import type { PathIndex } from "./path/PathIndex";
import {
  type EntryId,
  type PathIndexArrayEntry,
  type PathIndexEntry,
  type PathIndexFieldEntry,
  PathKind,
} from "./path/types";
import type { StateAssessor } from "./state/StateAssessor";
import type { StateGraph } from "./state/StateGraph";
import type { PathValueClassifier } from "./value/PathValueClassifier";
import type { ValueStore } from "./value/ValueStore";

/**
 * Brings a location's observed state back in step with a value it just received.
 *
 * A field answers for itself, and everything else hands the question down: a
 * name reaches the location it always reached, so what was watching there is
 * still watching there and only has to read again.
 *
 * An array is the one that has to be told first, because how many positions it
 * has is the value's to decide. It gains the ones the value brought, loses the
 * ones the value stopped reaching, and rebuilds any whose item is no longer the
 * kind of thing it was.
 */
export class Reconciler<TValues extends FormValues = FormValues> {
  readonly #index: PathIndex<TValues>;
  readonly #state: StateGraph;
  readonly #value: ValueStore<TValues>;
  readonly #classifier: PathValueClassifier;
  readonly #assessor: StateAssessor;

  constructor(
    index: PathIndex<TValues>,
    state: StateGraph,
    value: ValueStore<TValues>,
    classifier: PathValueClassifier,
    assessor: StateAssessor,
  ) {
    this.#index = index;
    this.#state = state;
    this.#value = value;
    this.#classifier = classifier;
    this.#assessor = assessor;

    index.on("discarded", (entries) => this.#discarded(entries));
  }

  reconcile(entry: PathIndexEntry): void {
    this.#index.reconcile(
      entry.id,
      (field) => this.#field(field),
      (array) => this.#array(array),
    );
  }

  #field(field: PathIndexFieldEntry): void {
    if (!this.#state.has(field.id)) {
      return;
    }

    const dirty = this.#assessor.assess(this.#value.read(field), this.#value.default(field));

    this.#state.assessed(this.#state.field(field.id), dirty);
  }

  /** Every watcher a discarded location ever claimed has to let go, not just one. */
  #discarded(entries: readonly PathIndexEntry[]): void {
    for (const entry of entries) {
      if (entry.kind === PathKind.Field) {
        this.#unregister(entry.id);
      } else {
        this.#dematerialize(entry.id);
      }
    }
  }

  #array(array: PathIndexArrayEntry): void {
    const items = Reconciler.#itemsOf(this.#value.read(array));
    const expected = Reconciler.#itemsOf(this.#value.default(array)).length;

    this.#index.truncate(array.id, items.length);

    const kept = array.children.length;

    for (let position = 0; position < items.length; position++) {
      const kind = this.#classifier.classify(items[position]);

      if (position >= kept) {
        this.#index.append(array.id, kind);
        continue;
      }

      if (array.children[position].kind !== kind) {
        this.#index.replace(array.id, position, kind);
      }
    }

    if (this.#state.has(array.id)) {
      this.#state.measured(array.id, items.length, expected);
    }
  }

  /** Every watcher this location ever claimed has to let go, not just one. */
  #unregister(id: EntryId): void {
    while (this.#state.has(id)) {
      this.#state.unregister(id);
    }

    while (this.#value.has(id)) {
      this.#value.unregister(id);
    }
  }

  /** Every watcher this location ever claimed has to let go, not just one. */
  #dematerialize(id: EntryId): void {
    while (this.#state.has(id)) {
      this.#state.dematerialize(id);
    }

    while (this.#value.has(id)) {
      this.#value.dematerialize(id);
    }
  }

  static #itemsOf(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
  }
}
