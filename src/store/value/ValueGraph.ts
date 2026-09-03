/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { ObservationChain } from "../observation/ObservationChain";
import type { EntryId } from "../path/types";

/**
 * A location whose value somebody may be watching.
 *
 * It carries nothing beyond the link upward, which is the whole point: the
 * values live in `FormValue`, and this only answers who has to hear about a
 * write.
 */
export type ValueEntry = {
  readonly id: EntryId;
  /**
   * The nearest ancestor whose value somebody is watching, or `null` on the
   * root. Spelled out rather than written as `ChainNode<ValueEntry>`, which a
   * type alias cannot reference from itself; it is that shape all the same.
   */
  parent: ValueEntry | null;
};

/**
 * Who is watching which value, and how a write reaches them.
 *
 * It holds no values. Writing is somebody else's job; this only answers the
 * question that comes right after it: given the location that was written, who
 * has to be told.
 *
 * A node is here because somebody watches its value. That is what makes the
 * walk cheap — the chain is made of the ones that asked to be in it, and a form
 * where nobody watches a whole node costs a single hop.
 *
 * Unlike the state, this walk never stops early. A value that changed below an
 * ancestor changed for that ancestor too, whatever else is going on. That is the
 * only difference between the two graphs, and it is why the chain underneath
 * does not walk itself.
 */
export class ValueGraph {
  readonly #chain: ObservationChain<ValueEntry>;

  constructor(rootId: EntryId) {
    this.#chain = new ObservationChain<ValueEntry>({ id: rootId, parent: null });
  }

  /** Always present, so every walk has somewhere to end. */
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

  /**
   * Puts a registered field on the chain.
   *
   * Every field belongs here whether or not anybody watches it, because a write
   * needs somewhere to start walking from. Registering twice hands back what is
   * already there.
   */
  register(id: EntryId, parent: ValueEntry): ValueEntry {
    const existing = this.#chain.find(id);

    if (existing) {
      return existing;
    }

    const entry: ValueEntry = { id, parent: null };

    this.#chain.join(entry, parent);

    return entry;
  }

  unregister(id: EntryId): void {
    this.#chain.leave(id);
  }

  /**
   * Starts watching a node, taking over the children that used to report
   * further up.
   */
  materialize(id: EntryId, parent: ValueEntry, children: readonly ValueEntry[]): ValueEntry {
    const existing = this.#chain.find(id);

    if (existing) {
      return existing;
    }

    const node: ValueEntry = { id, parent: null };

    this.#chain.insert(node, parent, children);

    return node;
  }

  /** Stops watching a node and hands its children back to whoever it reported to. */
  dematerialize(id: EntryId): void {
    this.#chain.remove(id);
  }

  /**
   * Walks from a written location up to the root, handing over everyone that
   * has to hear about it, starting with the location itself.
   *
   * It takes the entry rather than an id, and not only because whoever writes a
   * field already holds it. An id would let a caller name a location that is not
   * on the chain — a structural change to an array nobody watches — and the walk
   * would quietly begin nowhere, leaving every ancestor that does watch unaware
   * that anything happened. Where to start is a structural question, and it has
   * to be answered before getting here.
   *
   * It takes a visitor rather than returning a collection because this runs on
   * every keystroke and the answer is never empty: the location that changed is
   * always in it.
   */
  report(from: ValueEntry, visit: (entry: ValueEntry) => void): void {
    let entry: ValueEntry | null = from;

    while (entry) {
      visit(entry);
      entry = entry.parent;
    }
  }
}
