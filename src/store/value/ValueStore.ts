/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues } from "../../path";
import { ObservationChain } from "../observation/ObservationChain";
import { type EntryId, type EntryTree, type PathIndexEntry, PathKind } from "../path/types";
import { FormValue } from "./FormValue";
import type { PathValueClassifier } from "./PathValueClassifier";

const STALE = Symbol("stale");

/** A `ChainNode`, spelled out because a type alias cannot reference itself. */
export type ValueEntry = {
  readonly id: EntryId;
  parent: ValueEntry | null;
  snapshot: object | typeof STALE;
};

/**
 * The value domain of a form: what it holds, and who has to hear about a write.
 *
 * A write always does both — change the value and tell its watchers — so the two
 * live in one place instead of being wired together by whoever calls this.
 */
export class ValueStore<TValues extends FormValues = FormValues> {
  readonly #value: FormValue<TValues>;
  readonly #tree: EntryTree;
  readonly #chain: ObservationChain<ValueEntry>;

  constructor(tree: EntryTree, classifier: PathValueClassifier, values: TValues, defaults: TValues) {
    this.#value = new FormValue(tree, classifier, values, defaults);
    this.#tree = tree;
    this.#chain = new ObservationChain<ValueEntry>(tree, { id: tree.root().id, parent: null, snapshot: STALE });
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

  reach(segments: readonly string[]): unknown {
    return this.#value.reach(segments);
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
    return this.#chain.join({ id, parent: null, snapshot: STALE });
  }

  unregister(id: EntryId): void {
    this.#chain.leave(id);
  }

  materialize(id: EntryId): ValueEntry {
    return this.#chain.insert({ id, parent: null, snapshot: STALE }).node;
  }

  dematerialize(id: EntryId): void {
    this.#chain.remove(id);
  }

  /**
   * Writes, then hands over everyone that has to hear about it, innermost
   * first and the root last. A value can be written at any height, and a node
   * nobody watches is not on the chain, so the start above is resolved rather
   * than assumed.
   *
   * Writing anything but a field replaces the container everything below is
   * reached through, which leaves those watchers holding a subtree the form no
   * longer contains, so they are reached too.
   *
   * It visits rather than collects: this runs on every write and the answer is
   * never empty.
   */
  write(entry: PathIndexEntry, value: unknown, visit: (watcher: ValueEntry) => void): void {
    this.#value.write(entry, value);

    if (entry.kind !== PathKind.Field) {
      for (const inside of this.#chain.descendantsOf(entry.id)) {
        inside.snapshot = STALE;
        visit(inside);
      }
    }

    let watcher: ValueEntry | null = this.#chain.originOf(entry.id);

    while (watcher) {
      watcher.snapshot = STALE;
      visit(watcher);
      watcher = watcher.parent;
    }
  }

  /**
   * What a subscriber should compare with `Object.is` against what it read last.
   *
   * A field's value already compares correctly on its own — a scalar write
   * replaces the reference outright, and a primitive compares by value — so this
   * returns it straight from the live tree, uncached.
   *
   * A node is read from a materialized watcher instead, because writing mutates
   * the live tree in place and never replaces an ancestor container: the node
   * itself would otherwise keep the same reference forever. The shallow copy
   * gives it a new one exactly when something under it changed, while what it
   * copies is already correct — nothing below was cloned, only mutated.
   */
  snapshot(id: EntryId): unknown {
    const structural = this.#tree.entry(id);

    if (structural.kind === PathKind.Field) {
      return this.#value.read(structural);
    }

    const watcher = this.#chain.node(id);

    if (watcher.snapshot === STALE) {
      watcher.snapshot = ValueStore.#shallow(structural.kind, this.#value.read(structural));
    }

    return watcher.snapshot;
  }

  static #shallow(kind: PathKind, value: unknown): object {
    if (kind === PathKind.Array) {
      return Array.isArray(value) ? [...value] : [];
    }

    return typeof value === "object" && value !== null ? { ...value } : {};
  }
}
