/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { Unsubscribe } from "../../EventEmitter";
import type { FormValues } from "../../path";
import { type Notifiable, ObservationChain } from "../observation/ObservationChain";
import {
  type EntryId,
  type EntryTree,
  type ObservableStructure,
  type PathIndexEntry,
  PathKind,
  type StepsOf,
} from "../path/types";
import { FormValue } from "./FormValue";
import type { PathValueClassifier } from "./PathValueClassifier";

const STALE = Symbol("stale");

export interface ValueEntry extends Notifiable {
  readonly id: EntryId;
  parent: ValueEntry | null;
  snapshot: object | typeof STALE;
}

/**
 * The value of a form: what it holds, and who is watching each location.
 *
 * Who reports to whom belongs to the chain, and when they hear about it belongs
 * to whoever is doing the writing. What is left here is what a reader is handed,
 * which is the one thing about a value that is not simply read from the tree.
 */
export class ValueStore<TValues extends FormValues = FormValues> {
  readonly #value: FormValue<TValues>;
  readonly #tree: EntryTree;
  readonly #chain: ObservationChain<ValueEntry>;

  constructor(
    tree: EntryTree & ObservableStructure,
    classifier: PathValueClassifier,
    values: TValues,
    defaults: TValues,
  ) {
    this.#value = new FormValue(tree, classifier, values, defaults);
    this.#tree = tree;
    this.#chain = new ObservationChain<ValueEntry>(tree, { id: tree.root().id, parent: null, snapshot: STALE });

    tree.on("discarded", (entries) => this.#discarded(entries));
  }

  /**
   * A location the shape stopped having has nothing left to watch, so every
   * claim on it goes at once rather than one per watcher that ever asked.
   */
  #discarded(entries: readonly PathIndexEntry[]): void {
    for (const entry of entries) {
      this.#chain.forget(entry.id);
    }
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

  observe<TSegments extends readonly string[]>(segments: TSegments): StepsOf<TSegments> {
    return this.#value.observe(segments);
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

  subscribe(entry: ValueEntry, listener: () => void): Unsubscribe {
    return this.#chain.subscribe(entry, listener);
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

  /** Answers whether anything moved, so a write onto its own value reaches nobody. */
  write(entry: PathIndexEntry, value: unknown): boolean {
    return this.#value.write(entry, value);
  }

  /** What a reader would have to recalculate before being handed anything. */
  stale(entry: ValueEntry): void {
    entry.snapshot = STALE;
  }

  /** Where a walk from a location starts, which is itself when it is watched. */
  originOf(id: EntryId): ValueEntry {
    return this.#chain.originOf(id);
  }

  /** The ones on the chain inside a location, for a write that replaced them all. */
  descendantsOf(id: EntryId): readonly ValueEntry[] {
    return this.#chain.descendantsOf(id);
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
