/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { Unsubscribe } from "../../EventEmitter";
import type { EntryId, EntryTree } from "../path/types";
import type { PathId } from "../state/PathRegistry";
import { RootHasNoParent, RootObservationRequired, UnknownObservation } from "./errors";

/** Shared so that watching an already watched node does not allocate to say so. */
const NOBODY_REPORTING: ReadonlySet<never> = Object.freeze(new Set<never>());
const NOTHING_CLAIMED: readonly never[] = Object.freeze([]);

/**
 * What a chain puts on a node, whichever chain it is.
 *
 * Both sit here rather than in a registry of their own because a climb already
 * holds the node it is standing on, and looking it up again by id would be
 * undoing work that was just done. Both are absent until they are earned, so a
 * node nobody reached and nobody listens to costs nothing.
 */
export interface Notifiable {
  listeners?: Set<() => void>;
  /**
   * The name every listener here arrived by, absent while nobody listens.
   *
   * A name answers for one location and a location answers to one name, so the
   * ones gathered here all came by the same: two names reaching the same node
   * would mean one of them stopped being answered when the shape moved, and
   * that is what a recomposition is for.
   */
  path?: PathId<string>;
  /**
   * The last transaction this was told about.
   *
   * It answers whether a climb has already been here without anybody keeping a
   * list: one that stops matching is one that is over, so the next makes every
   * mark stale at once by counting one higher.
   */
  mark?: number;
}

/**
 * `parent` is not the structural parent: it is the nearest ancestor on the
 * chain, so a field can point straight at the root with five levels in between.
 *
 * It has its own type parameter because not every node can be one. In the state
 * a field never holds children, so only a node may sit above anybody.
 */
export interface ChainNode<TParent> extends Notifiable {
  readonly id: EntryId;
  parent: TParent | null;
  /**
   * Who reports to this one, absent until somebody does.
   *
   * It sits beside the link it answers, because a relation kept at one end and
   * rebuilt at the other is a relation that can be left half undone.
   */
  reporting?: Set<ChainNode<TParent>>;
}

export interface ChainInsertion<TNode> {
  /** The node on the chain, which is the existing one when it was already there. */
  readonly node: TNode;
  /** Empty when it was already there, since nothing changed hands. */
  readonly claimed: readonly TNode[];
}

export interface ChainRemoval<TNode, TParent> {
  /** Already detached: its `parent` is null. */
  readonly node: TNode;
  /** Who the removed node reported to, and who its children report to now. */
  readonly parent: TParent;
  /** Already relinked to `parent`. */
  readonly adopted: readonly TNode[];
}

/**
 * Who is being watched, and who each of them reports to.
 *
 * It never walks the chain. What travels up the links, and where the walk
 * stops, belongs to whoever owns it: the state folds counters and stops when
 * they stabilize, the value stops wherever it has already been.
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
   * The descendants of a location that answer to `parent`, which are the ones
   * a node takes over when it starts being watched between the two.
   *
   * A descendant already reporting to something closer belongs to that one.
   */
  #reportingTo(id: EntryId, parent: TParent): TNode[] {
    const claimed: TNode[] = [];

    for (const child of (parent.reporting ?? NOBODY_REPORTING) as ReadonlySet<TNode>) {
      for (const ancestor of this.#tree.ancestorsOf(child.id)) {
        if (ancestor.id === id) {
          claimed.push(child);
          break;
        }
      }
    }

    return claimed;
  }

  /**
   * The ones on the chain inside a location, whoever each one reports to.
   *
   * A location on the chain is asked of the chain, where everything under it
   * reports to it or to something that does. One that is not on the chain has
   * nothing reporting to it, so the question goes to the shape: whoever watches
   * inside it is answering to an ancestor that has no idea it exists.
   */
  descendantsOf(id: EntryId): TNode[] {
    const descendants: TNode[] = [];

    const known = this.#nodes.get(id);

    if (known) {
      this.#below(known as TParent, descendants);

      return descendants;
    }

    const { nodes, fields } = this.#tree.descendantsOf(id);

    for (const candidates of [nodes, fields]) {
      for (const candidate of candidates) {
        const descendant = this.#nodes.get(candidate.id);

        if (descendant) {
          descendants.push(descendant);
        }
      }
    }

    return descendants;
  }

  #below(node: TParent, into: TNode[]): void {
    for (const child of (node.reporting ?? NOBODY_REPORTING) as ReadonlySet<TNode>) {
      into.push(child);
      this.#below(child as TParent, into);
    }
  }

  /**
   * Takes somebody waiting to hear about a node.
   *
   * It takes the node rather than its id so that waiting on one that is not on
   * the chain cannot be spelled: the only way to hold one is to have put it
   * there. Keeping it there is not this one's business either — whoever joined
   * it claimed it, and claims are given up the same way they were taken.
   *
   * When they are woken is not decided here: the work that moves a node reports
   * once it has finished, never while it is under way.
   */
  subscribe(node: TNode, listener: () => void, path: PathId<string>): Unsubscribe {
    const listeners = node.listeners ?? new Set<() => void>();

    node.listeners = listeners;
    node.path = path;
    listeners.add(listener);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        delete node.path;
      }
    };
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
    this.#reports(node);

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
    const claimed = this.#reportingTo(node.id, parent);

    node.parent = parent;

    this.#nodes.set(node.id, node);
    this.#claims.set(node.id, 1);
    this.#reports(node);

    for (const child of claimed) {
      this.#stopsReporting(child);
      child.parent = node;
      this.#reports(child);
    }

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

    return this.#release(id) ? this.#detach(node, parent) : undefined;
  }

  /**
   * Lets go of every claim at once, for a location the shape stopped having.
   *
   * However many asked to watch it, there is nothing left to watch: the answer
   * is not that they have to ask again, it is that the question is gone. An
   * owner that keeps counters over the chain is told what left, the same as any
   * other removal.
   */
  forget(id: EntryId): ChainRemoval<TNode, TParent> | undefined {
    const node = this.#nodes.get(id);

    if (!node?.parent) {
      return undefined;
    }

    this.#claims.delete(id);

    return this.#detach(node, node.parent);
  }

  /** Takes the node off the chain and hands its children to whoever it reported to. */
  #detach(node: TNode, parent: TParent): ChainRemoval<TNode, TParent> {
    this.#nodes.delete(node.id);
    this.#stopsReporting(node);

    const adopted = [...((node.reporting ?? NOBODY_REPORTING) as ReadonlySet<TNode>)];

    delete node.reporting;

    for (const child of adopted) {
      child.parent = parent;
      this.#reports(child);
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

    this.#stopsReporting(previous);
    this.#nodes.set(id, next);
    this.#reports(next);

    // What reported to the one being replaced reports to the one taking its
    // place: the location did not move, only what stands in it.
    if (previous.reporting) {
      next.reporting = previous.reporting;
      delete previous.reporting;
    }

    for (const child of (next.reporting ?? NOBODY_REPORTING) as ReadonlySet<TNode>) {
      child.parent = next;
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
    this.#stopsReporting(node);
    node.parent = null;

    return node;
  }

  /**
   * The climb, and the only place shape and membership meet.
   *
   * The cast holds because `ancestorsOf` yields the root, objects and arrays and
   * never a field, so whatever is found up there can hold children.
   */
  #reports(node: TNode): void {
    const above = node.parent;

    if (!above) {
      return;
    }

    const reporting = above.reporting ?? new Set<ChainNode<TParent>>();

    above.reporting = reporting;
    reporting.add(node);
  }

  #stopsReporting(node: TNode): void {
    node.parent?.reporting?.delete(node);
  }

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
}
