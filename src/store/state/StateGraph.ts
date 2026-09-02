/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { EntryId } from "../path/types";
import {
  DetachedStateParent,
  DuplicatedStateChild,
  RootStateRequired,
  StateAggregateUnderflow,
  StateKindConflict,
  UnexpectedStateParent,
  UnknownStateEntry,
} from "./errors";
import { StateAggregate } from "./StateAggregate";
import { type FieldStateInput, type StateEntry, type StateFieldEntry, StateKind, type StateNodeEntry } from "./types";

/** Shared so that registering a form's worth of fields does not leave one empty array each. */
const NO_ERRORS: readonly unknown[] = Object.freeze([]);

/** Shared so that a keystroke that moves nothing does not allocate to say so. */
const NOTHING_MOVED: readonly StateEntry[] = Object.freeze([]);

/**
 * The reactive state of a form.
 *
 * State is born in fields and only in fields. A node owns nothing of its own:
 * its flags are derived from counters that its reactive children keep up to
 * date, so reading a node never walks its subtree.
 *
 * The graph is the edges, not the map. Every entry holds a direct reference to
 * its nearest materialized ancestor, so propagating upward follows pointers and
 * never resolves a path or looks a parent up. Structural nodes that nobody
 * observes are not in the chain at all: with only the root materialized, every
 * field reports straight to it.
 *
 * Finding which descendants belong to a node is structural work, so the store
 * resolves it and hands the result in. This class never sees the index.
 */
export class StateGraph {
  readonly #entries = new Map<EntryId, StateEntry>();
  readonly #root: StateNodeEntry;

  constructor(rootId: EntryId) {
    this.#root = {
      id: rootId,
      kind: StateKind.Node,
      parent: null,
      flags: 0,
      aggregate: new StateAggregate(),
    };

    this.#entries.set(rootId, this.#root);
  }

  /** Always materialized, so a form can always answer for itself as a whole. */
  root(): StateNodeEntry {
    return this.#root;
  }

  find(id: EntryId): StateEntry | undefined {
    return this.#entries.get(id);
  }

  entry(id: EntryId): StateEntry {
    const entry = this.#entries.get(id);

    if (!entry) {
      throw new UnknownStateEntry(id as number);
    }

    return entry;
  }

  has(id: EntryId): boolean {
    return this.#entries.has(id);
  }

  /**
   * Gives a registered field its own state.
   *
   * Registering twice returns what is already there, so a field that remounts
   * keeps the flags and errors it had.
   */
  register(id: EntryId, parent: StateNodeEntry, initial: FieldStateInput = {}): StateFieldEntry {
    const existing = this.#entries.get(id);

    if (existing) {
      return StateGraph.#asField(existing);
    }

    this.#assertLive(parent);

    const field: StateFieldEntry = {
      id,
      kind: StateKind.Field,
      parent,
      flags: initial.flags ?? 0,
      errors: initial.errors ?? NO_ERRORS,
    };

    this.#entries.set(id, field);
    this.#propagate(parent, 0, field.flags);

    return field;
  }

  /**
   * Takes a field's state away and discounts it from everyone above.
   *
   * The field is detached on the way out, so an update arriving through a
   * reference somebody kept is inert instead of counting a contributor that was
   * already discounted.
   */
  unregister(id: EntryId): readonly StateEntry[] {
    const existing = this.#entries.get(id);

    if (!existing) {
      return NOTHING_MOVED;
    }

    const field = StateGraph.#asField(existing);
    const parent = field.parent;

    this.#entries.delete(id);
    field.parent = null;

    return this.#propagate(parent, field.flags, 0);
  }

  /**
   * The hot path: a field's own state changed.
   *
   * It takes the field itself rather than its id, because whoever is writing
   * already holds it and looking up what you have in hand is work for nothing.
   *
   * Errors are only touched when the caller brings them, so typing does not
   * allocate. Passing an empty collection is how they are cleared.
   *
   * Nothing happens above when the flags land on the same value, which is what
   * keeps typing into an already touched field from reaching the root. That is
   * also why nothing comes back in that case: there is nobody to tell.
   */
  update(field: StateFieldEntry, next: FieldStateInput): readonly StateEntry[] {
    const previous = field.flags;

    field.flags = next.flags ?? 0;

    if (next.errors !== undefined) {
      field.errors = next.errors;
    }

    if (field.flags === previous) {
      return NOTHING_MOVED;
    }

    return this.#propagate(field.parent, previous, field.flags, [field]);
  }

  /** Resolves a field by id for callers that do not hold it, such as an imperative set. */
  field(id: EntryId): StateFieldEntry {
    return StateGraph.#asField(this.entry(id));
  }

  /**
   * Starts deriving state for a node, taking over the children that used to
   * report further up.
   *
   * The subtle part is the parent: it counted each of those children as its own
   * contributor and from now on it counts the new node once, so their weight
   * has to be taken off before the node's is added.
   */
  materialize(id: EntryId, parent: StateNodeEntry, children: readonly StateEntry[]): StateNodeEntry {
    const existing = this.#entries.get(id);

    if (existing) {
      return StateGraph.#asNode(existing);
    }

    this.#assertLive(parent);

    // Checked before anything moves, so a rejected list leaves the graph as it
    // was instead of half migrated.
    const seen = new Set<EntryId>();

    for (const child of children) {
      if (child.parent !== parent) {
        throw new UnexpectedStateParent(child.id as number);
      }

      if (seen.has(child.id)) {
        throw new DuplicatedStateChild(child.id as number);
      }

      seen.add(child.id);
    }

    const node: StateNodeEntry = {
      id,
      kind: StateKind.Node,
      parent,
      flags: 0,
      aggregate: new StateAggregate(),
    };

    const held = parent.flags;

    for (const child of children) {
      child.parent = node;
      node.aggregate.add(child.flags);
      this.#contribute(parent, child.flags, 0);
    }

    node.flags = node.aggregate.derive();

    this.#entries.set(id, node);
    this.#contribute(parent, 0, node.flags);
    this.#settle(parent, held);

    return node;
  }

  /**
   * The mirror of `materialize`: the children go back to reporting upward.
   *
   * Unlike materializing, this one takes no list. Who reports to a node is
   * something the graph already knows — they are the entries pointing at it —
   * and asking the caller for them would mean a forgotten one leaves the form
   * claiming it is untouched while one of its fields is not. Reading it off the
   * registry costs a pass over the materialized state on a cold path and makes
   * that mistake impossible.
   */
  dematerialize(id: EntryId): void {
    const node = StateGraph.#asNode(this.entry(id));

    if (!node.parent) {
      throw new RootStateRequired();
    }

    const parent = node.parent;
    const held = parent.flags;

    this.#entries.delete(id);
    this.#contribute(parent, node.flags, 0);

    for (const child of this.#entries.values()) {
      if (child.parent !== node) {
        continue;
      }

      child.parent = parent;
      this.#contribute(parent, 0, child.flags);
    }

    this.#settle(parent, held);
  }

  /**
   * Walks up folding a change into every ancestor, and stops as soon as one of
   * them derives the same public flags it already had: from there upward
   * nothing can have changed either.
   *
   * What it hands back is everyone whose public state moved, which is the same
   * thing as everyone who has to be told. The cut is not only an optimization:
   * it is what draws the line between who changed and who did not.
   *
   * The collection is only created once there is something to put in it, so the
   * common keystroke — one that changes no flag at all — costs nothing.
   */
  #propagate(
    from: StateNodeEntry | null,
    previous: number,
    current: number,
    changed: StateEntry[] | null = null,
  ): readonly StateEntry[] {
    let node = from;
    let before = previous;
    let after = current;
    let moved = changed;

    while (node) {
      const held = node.flags;

      this.#contribute(node, before, after);

      if (node.flags === held) {
        break;
      }

      moved ??= [];
      moved.push(node);

      before = held;
      after = node.flags;
      node = node.parent;
    }

    return moved ?? NOTHING_MOVED;
  }

  /**
   * Folds one child's change into a node and recomputes its public flags.
   *
   * The underflow check is unreachable through the public API now that every
   * way of handing over children is validated first. It stays as the last
   * resort: a counter below zero means the arithmetic here lost a delta, and
   * that has to be loud rather than leave a form quietly claiming less than it
   * holds.
   */
  #contribute(node: StateNodeEntry, previous: number, current: number): void {
    node.aggregate.fold(previous, current);

    if (node.aggregate.isUnderflowed()) {
      throw new StateAggregateUnderflow(node.id as number);
    }

    node.flags = node.aggregate.derive();
  }

  /**
   * Reports a node upward after several contributors were swapped in one go.
   *
   * Materializing and dematerializing touch the same parent many times, so the
   * comparison has to be against the flags it held before the whole operation
   * rather than against each intermediate step.
   */
  #settle(node: StateNodeEntry, held: number): void {
    if (node.flags !== held) {
      this.#propagate(node.parent, held, node.flags);
    }
  }

  /** A node that is no longer in the registry cannot be given children. */
  #assertLive(node: StateNodeEntry): void {
    if (this.#entries.get(node.id) !== node) {
      throw new DetachedStateParent(node.id as number);
    }
  }

  static #asField(entry: StateEntry): StateFieldEntry {
    if (entry.kind !== StateKind.Field) {
      throw new StateKindConflict(entry.id as number, entry.kind, StateKind.Field);
    }

    return entry;
  }

  static #asNode(entry: StateEntry): StateNodeEntry {
    if (entry.kind !== StateKind.Node) {
      throw new StateKindConflict(entry.id as number, entry.kind, StateKind.Node);
    }

    return entry;
  }
}
