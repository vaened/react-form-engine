/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { EntryId, EntryTree } from "../path/types";
import { RootHasNoParent, RootObservationRequired, UnknownObservation } from "./errors";

/** Shared so that watching an already watched node does not allocate to say so. */
const NOTHING_CLAIMED: readonly never[] = Object.freeze([]);

/**
 * `parent` is not the structural parent: it is the nearest ancestor on the
 * chain, so a field can point straight at the root with five levels in between.
 *
 * It has its own type parameter because not every node can be one. In the state
 * a field never holds children, so only a node may sit above anybody.
 */
export type ChainNode<TParent> = {
  readonly id: EntryId;
  parent: TParent | null;
};

export type ChainInsertion<TNode> = {
  /** The node on the chain, which is the existing one when it was already there. */
  readonly node: TNode;
  /** Empty when it was already there, since nothing changed hands. */
  readonly claimed: readonly TNode[];
};

export type ChainRemoval<TNode, TParent> = {
  /** Already detached: its `parent` is null. */
  readonly node: TNode;
  /** Who the removed node reported to, and who its children report to now. */
  readonly parent: TParent;
  /** Already relinked to `parent`. */
  readonly adopted: readonly TNode[];
};

/**
 * Who is being watched, and who each of them reports to.
 *
 * It never walks the chain. What travels up the links belongs to whoever owns
 * it: the state folds counters and stops when they stabilize, the value carries
 * a fact and never stops.
 *
 * It holds the tree because its one question — who above me is watching — needs
 * both halves. Shape does not know who watches; membership does not know who is
 * above.
 *
 * Membership is the watched nodes plus the root. Leaves join as well, but as a
 * cache rather than a rule: nothing walks through a leaf, so keeping one costs
 * nobody a hop and spares every write the climb. An interior node is not free
 * that way, since everything below it would pay, so it joins only when watched
 * and its climbs happen when they are needed.
 */
export class ObservationChain<TNode extends ChainNode<TParent>, TParent extends TNode = TNode> {
  readonly #nodes = new Map<EntryId, TNode>();
  readonly #claims = new Map<EntryId, number>();
  readonly #tree: EntryTree;
  readonly #root: TParent;

  constructor(tree: EntryTree, root: TParent) {
    this.#tree = tree;
    this.#root = root;
    this.#nodes.set(root.id, root);
    this.#claims.set(root.id, 1);
  }

  /** Always on the chain, so every climb and every walk has an answer. */
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
   * Where a walk from this location starts.
   *
   * A member answers for itself, which is every field and every watched node.
   * Anything else — a write onto a node nobody watches — climbs to the nearest
   * one above.
   */
  originOf(id: EntryId): TNode {
    return this.#nodes.get(id) ?? this.#above(id);
  }

  /** The same climb as `originOf`, skipping the location itself. */
  parentOf(id: EntryId): TParent {
    return this.#above(id);
  }

  /**
   * The members that pass under a node when it starts being watched.
   *
   * A descendant already reporting to something closer belongs to that one, so
   * only those still reporting to `parent` change hands.
   */
  claimableUnder(id: EntryId, parent: TParent): TNode[] {
    const { nodes, fields } = this.#tree.descendantsOf(id);
    const claimable: TNode[] = [];

    this.#gather(nodes, parent, claimable);
    this.#gather(fields, parent, claimable);

    return claimable;
  }

  /**
   * Puts a node on the chain, or counts one more watcher on the one already
   * there. It hands back whichever of the two is on the chain now.
   */
  join(node: TNode): TNode {
    const existing = this.#nodes.get(node.id);

    if (existing) {
      this.#claims.set(node.id, this.#claimsOn(node.id) + 1);

      return existing;
    }

    node.parent = this.#above(node.id);

    this.#nodes.set(node.id, node);
    this.#claims.set(node.id, 1);

    return node;
  }

  /**
   * The same as `join` for a node that takes children on, handing back what it
   * claimed for owners that keep counters over the chain.
   */
  insert(node: TParent): ChainInsertion<TNode> {
    const existing = this.#nodes.get(node.id);

    if (existing) {
      this.#claims.set(node.id, this.#claimsOn(node.id) + 1);

      return { node: existing, claimed: NOTHING_CLAIMED };
    }

    const parent = this.#above(node.id);
    const claimed = this.claimableUnder(node.id, parent);

    node.parent = parent;

    for (const child of claimed) {
      child.parent = node;
    }

    this.#nodes.set(node.id, node);
    this.#claims.set(node.id, 1);

    return { node, claimed };
  }

  /**
   * Gives up one watcher, and takes the node off the chain once it was the
   * last. Its children go to whoever it reported to.
   *
   * Nothing comes back while somebody else is still watching, so an owner that
   * keeps counters knows not to discount anything yet.
   */
  remove(id: EntryId): ChainRemoval<TNode, TParent> | undefined {
    const node = this.node(id);
    const parent = node.parent;

    if (!parent) {
      throw new RootObservationRequired();
    }

    if (!this.#release(id)) {
      return undefined;
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
   * Swaps what occupies `id` for a node of a different shape, re-pointing
   * every child that reported to the one it replaces.
   *
   * Some owners need a location to become a different kind of thing — a field
   * promoted into a node once something registers beneath it — and a kind
   * that changes is not the same operation as a value that changes: nothing
   * else on the chain knows how to reshape one variant into another. Handing
   * in the real thing it becomes and relinking around it needs no reshaping
   * at all.
   */
  replace(id: EntryId, next: TParent): TParent {
    const previous = this.node(id);

    next.parent = previous.parent;

    this.#nodes.set(id, next);

    for (const child of this.#nodes.values()) {
      if (child.parent === previous) {
        child.parent = next;
      }
    }

    previous.parent = null;

    return next;
  }

  /**
   * Gives up one watcher on a leaf, and takes it off the chain once it was the
   * last.
   *
   * Detaching it makes anything arriving through a reference somebody kept
   * inert, instead of reaching a chain it already left.
   */
  leave(id: EntryId): TNode | undefined {
    const node = this.#nodes.get(id);

    if (!node || node === this.#root || !this.#release(id)) {
      return undefined;
    }

    this.#nodes.delete(id);
    node.parent = null;

    return node;
  }

  /**
   * The climb, and the only place shape and membership meet.
   *
   * The cast holds because `ancestorsOf` yields the root, objects and arrays and
   * never a field, so whatever is found up there can hold children.
   */
  #above(id: EntryId): TParent {
    for (const ancestor of this.#tree.ancestorsOf(id)) {
      const found = this.#nodes.get(ancestor.id);

      if (found) {
        return found as TParent;
      }
    }

    throw new RootHasNoParent();
  }

  #claimsOn(id: EntryId): number {
    return this.#claims.get(id) ?? 0;
  }

  /** Whether that was the last watcher, in which case the node may go. */
  #release(id: EntryId): boolean {
    const left = this.#claimsOn(id) - 1;

    if (left > 0) {
      this.#claims.set(id, left);

      return false;
    }

    this.#claims.delete(id);

    return true;
  }

  #gather(candidates: readonly { readonly id: EntryId }[], parent: TParent, into: TNode[]): void {
    for (const candidate of candidates) {
      const member = this.#nodes.get(candidate.id);

      if (member && member.parent === parent) {
        into.push(member);
      }
    }
  }
}
