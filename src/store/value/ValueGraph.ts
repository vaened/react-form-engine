/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { ObservationChain } from "../observation/ObservationChain";
import type { EntryId, EntryTree } from "../path/types";

/** A `ChainNode`, spelled out because a type alias cannot reference itself. */
export type ValueEntry = {
  readonly id: EntryId;
  parent: ValueEntry | null;
};

/**
 * Who is watching which value, and how a write reaches them.
 *
 * It holds no values. Given the location that was written, it answers who has
 * to be told.
 *
 * The walk never stops early: a value that changed below an ancestor changed
 * for that ancestor too, whatever else is going on.
 */
export class ValueGraph {
  readonly #chain: ObservationChain<ValueEntry>;

  constructor(tree: EntryTree) {
    this.#chain = new ObservationChain<ValueEntry>(tree, { id: tree.root().id, parent: null });
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
    const existing = this.#chain.find(id);

    if (existing) {
      return existing;
    }

    const entry: ValueEntry = { id, parent: null };

    this.#chain.join(entry);

    return entry;
  }

  unregister(id: EntryId): void {
    this.#chain.leave(id);
  }

  materialize(id: EntryId): ValueEntry {
    const existing = this.#chain.find(id);

    if (existing) {
      return existing;
    }

    const node: ValueEntry = { id, parent: null };

    this.#chain.insert(node);

    return node;
  }

  dematerialize(id: EntryId): void {
    this.#chain.remove(id);
  }

  /**
   * Hands over everyone that has to hear about a write, starting at the nearest
   * watcher on or above it. A value can be written at any height, and a node
   * nobody watches is not on the chain, so the start is resolved rather than
   * assumed.
   *
   * It visits rather than collects: this runs on every write and the answer is
   * never empty.
   */
  report(id: EntryId, visit: (entry: ValueEntry) => void): void {
    let entry: ValueEntry | null = this.#chain.originOf(id);

    while (entry) {
      visit(entry);
      entry = entry.parent;
    }
  }
}
