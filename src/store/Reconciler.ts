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
 * A field answers for itself. An object hands the question down to each of its
 * children, on the assumption that a key still names the same place it always
 * did. An array gets no such assumption — position was never identity here — so
 * its old items are discarded whole, with whatever they held, and its new ones
 * are born fresh, exactly as anything registering for the first time would be.
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

    const next = this.#assessor.assess(this.#value.read(field), this.#value.default(field));

    this.#state.update(this.#state.field(field.id), next);
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
    const items = this.#index.childrenOf(array.id).length;

    for (let i = 0; i < items; i++) {
      this.#index.remove(array.id, 0);
    }

    for (const itemValue of Reconciler.#itemsOf(this.#value.read(array))) {
      this.#index.append(array.id, this.#classifier.classify(itemValue));
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
