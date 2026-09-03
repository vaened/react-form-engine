/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { EntryId } from "../path/types";
import {
  DetachedObservationParent,
  DuplicatedObservationChild,
  RootObservationRequired,
  UnexpectedObservationParent,
  UnknownObservation,
} from "./errors";

/**
 * What the chain needs a node to have, and nothing else.
 *
 * It is generic over the node itself rather than over a payload it carries, so
 * whoever owns the chain keeps its own fields flat. The state reads `flags`
 * straight off the entry on every keystroke, and one indirection there would be
 * paid on the hot path to save duplication on a cold one.
 *
 * `parent` is not the structural parent. It is the nearest place above that
 * somebody is watching, so a field points straight at the root while nothing in
 * between is being watched. It is its own parameter because not everything on
 * the chain can be one: in the state a field never has children, so only a node
 * can sit above anybody.
 */
export type ChainNode<TParent> = {
  readonly id: EntryId;
  parent: TParent | null;
};

/**
 * What changed hands when a node was taken off the chain.
 *
 * The state has to discount what left and count what moved, so it needs all
 * three; the value needs none of them and ignores this. It is a report of what
 * happened rather than a hook for one of the two, which is why it is a return
 * value and not a callback.
 */
export type ChainRemoval<TNode, TParent> = {
  /** The node that left, already detached. */
  readonly node: TNode;
  /** Who it reported to, and who its children report to from now on. */
  readonly parent: TParent;
  /** The children that changed hands, already relinked. */
  readonly adopted: readonly TNode[];
};

/**
 * Who is being watched, and who each of them reports to.
 *
 * The state and the value need exactly the same thing here: a set of watched
 * locations, a link from each to the nearest watched one above it, and the
 * relinking that happens when somebody starts or stops watching. What travels
 * up those links is not this class's business — it never walks the chain.
 *
 * Keeping the relinking in one place is not about repetition. The two mistakes
 * that corrupt a chain silently — taking over a child that reported elsewhere,
 * and losing one when a node leaves — both live there, so it is worth having
 * exactly one of it to guard and to test.
 */
export class ObservationChain<TNode extends ChainNode<TParent>, TParent extends TNode = TNode> {
  readonly #nodes = new Map<EntryId, TNode>();
  readonly #root: TParent;

  constructor(root: TParent) {
    this.#root = root;
    this.#nodes.set(root.id, root);
  }

  /** Always on the chain, so every walk has somewhere to end. */
  root(): TParent {
    return this.#root;
  }

  find(id: EntryId): TNode | undefined {
    return this.#nodes.get(id);
  }

  node(id: EntryId): TNode {
    const node = this.#nodes.get(id);

    if (!node) {
      throw new UnknownObservation(id as number);
    }

    return node;
  }

  has(id: EntryId): boolean {
    return this.#nodes.has(id);
  }

  /**
   * Puts a node on the chain without taking anything over.
   *
   * The node comes built from the caller because what it carries is the caller's
   * business; the link upward is this class's, so it is set here.
   */
  join(node: TNode, parent: TParent): void {
    this.#assertLive(parent);

    node.parent = parent;

    this.#nodes.set(node.id, node);
  }

  /**
   * Puts a node on the chain and moves the given children onto it.
   *
   * The children come from the caller because working out which of them belong
   * underneath is structural work, and structure is not something this class
   * knows anything about. What it does know is when that list is wrong.
   *
   * What goes in has to be a parent: it is taking children on, and in the state
   * that alone is what tells a node apart from a field.
   */
  insert(node: TParent, parent: TParent, children: readonly TNode[]): void {
    this.#assertLive(parent);
    ObservationChain.#assertTakeable(parent, children);

    node.parent = parent;

    for (const child of children) {
      child.parent = node;
    }

    this.#nodes.set(node.id, node);
  }

  /**
   * Takes a node off the chain and hands its children to whoever it reported to.
   *
   * It takes no list. Who reports to a node is something the chain already
   * knows, and asking the caller for it would mean a forgotten child keeps
   * reporting into something nobody can reach any more.
   *
   * It reports back everything that moved, because the caller that keeps
   * counters over the chain has to discount what left and count what changed
   * hands, and it has no other way to know which children those were.
   */
  remove(id: EntryId): ChainRemoval<TNode, TParent> {
    const node = this.node(id);
    const parent = node.parent;

    if (!parent) {
      throw new RootObservationRequired();
    }

    this.#nodes.delete(id);

    const adopted: TNode[] = [];

    for (const child of this.#nodes.values()) {
      if (child.parent !== node) {
        continue;
      }

      child.parent = parent;
      adopted.push(child);
    }

    node.parent = null;

    return { node, parent, adopted };
  }

  /**
   * Takes a node off the chain without handing anything over, for the leaves
   * that have nothing under them.
   *
   * Detaching it on the way out is what makes a change arriving through a
   * reference somebody kept inert, instead of reaching a chain it already left.
   */
  leave(id: EntryId): TNode | undefined {
    const node = this.#nodes.get(id);

    if (!node || node === this.#root) {
      return undefined;
    }

    this.#nodes.delete(id);
    node.parent = null;

    return node;
  }

  /** A node that is no longer on the chain cannot be given children. */
  #assertLive(node: TParent): void {
    if (this.#nodes.get(node.id) !== node) {
      throw new DetachedObservationParent(node.id as number);
    }
  }

  /**
   * Checked before anything moves, so a rejected list leaves the chain as it
   * was instead of half migrated.
   */
  static #assertTakeable<TNode extends ChainNode<TParent>, TParent extends TNode>(
    parent: TParent,
    children: readonly TNode[],
  ): void {
    const seen = new Set<EntryId>();

    for (const child of children) {
      if (child.parent !== parent) {
        throw new UnexpectedObservationParent(child.id as number);
      }

      if (seen.has(child.id)) {
        throw new DuplicatedObservationChild(child.id as number);
      }

      seen.add(child.id);
    }
  }
}
