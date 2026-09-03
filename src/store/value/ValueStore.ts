/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues } from "../../path";
import { ObservationChain } from "../observation/ObservationChain";
import type { EntryId, EntryTree, PathIndexEntry } from "../path/types";
import { FormValue } from "./FormValue";

/** A `ChainNode`, spelled out because a type alias cannot reference itself. */
export type ValueEntry = {
  readonly id: EntryId;
  parent: ValueEntry | null;
};

/**
 * The value domain of a form: what it holds, and who has to hear about a write.
 *
 * A write always does both — change the value and tell its watchers — so the two
 * live in one place instead of being wired together by whoever calls this.
 */
export class ValueStore<TValues extends FormValues = FormValues> {
  readonly #value: FormValue<TValues>;
  readonly #chain: ObservationChain<ValueEntry>;

  constructor(tree: EntryTree, values: TValues, defaults: TValues = values) {
    this.#value = new FormValue(values, defaults);
    this.#chain = new ObservationChain<ValueEntry>(tree, { id: tree.root().id, parent: null });
  }

  get value(): TValues {
    return this.#value.value;
  }

  get defaults(): TValues {
    return this.#value.defaults;
  }

  read(entry: PathIndexEntry): unknown {
    return this.#value.read(entry);
  }

  default(entry: PathIndexEntry): unknown {
    return this.#value.default(entry);
  }

  replace(values: TValues): void {
    this.#value.replace(values);
  }

  clear(): void {
    this.#value.clear();
  }

  root(): ValueEntry {
    return this.#chain.root();
  }

  find(id: EntryId): ValueEntry | undefined {
    return this.#chain.find(id);
  }

  entry(id: EntryId): ValueEntry {
    return this.#chain.node(id);
  }

  has(id: EntryId): boolean {
    return this.#chain.has(id);
  }

  /** A field joins whether or not anybody watches it, so a write starts at it. */
  register(id: EntryId): ValueEntry {
    return this.#chain.join({ id, parent: null });
  }

  unregister(id: EntryId): void {
    this.#chain.leave(id);
  }

  materialize(id: EntryId): ValueEntry {
    return this.#chain.insert({ id, parent: null }).node;
  }

  dematerialize(id: EntryId): void {
    this.#chain.remove(id);
  }

  /**
   * Writes, then hands over everyone that has to hear about it, starting at the
   * nearest watcher on or above the entry. A value can be written at any height,
   * and a node nobody watches is not on the chain, so the start is resolved
   * rather than assumed.
   *
   * It visits rather than collects: this runs on every write and the answer is
   * never empty.
   */
  write(entry: PathIndexEntry, value: unknown, visit: (watcher: ValueEntry) => void): void {
    this.#value.write(entry, value);

    let watcher: ValueEntry | null = this.#chain.originOf(entry.id);

    while (watcher) {
      visit(watcher);
      watcher = watcher.parent;
    }
  }
}
