/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { ObservationChain } from "../observation/ObservationChain";
import { type EntryId, type EntryTree, type ObservableStructure, PathKind } from "../path/types";
import { ArrayStateAggregate } from "./ArrayStateAggregate";
import { StateAggregateUnderflow, StateKindConflict } from "./errors";
import { FieldState } from "./FieldState";
import { StateAggregate } from "./StateAggregate";
import { type StateArrayEntry, type StateEntry, type StateFieldEntry, StateKind, type StateNodeEntry } from "./types";

/** Shared so that a keystroke that moves nothing does not allocate to say so. */
const NOTHING_MOVED: readonly StateEntry[] = Object.freeze([]);

/**
 * The reactive state of a form.
 *
 * State is born in fields and only in fields. A node owns nothing of its own:
 * its flags are derived from counters its reactive children keep up to date, so
 * reading a node never walks its subtree.
 *
 * Who reports to whom belongs to the chain. What is left here is the arithmetic:
 * folding a change into the counters above, and knowing where it stops
 * mattering.
 */
export class StateGraph {
  /** A field never holds children, so only a node may be a parent. */
  readonly #chain: ObservationChain<StateEntry, StateNodeEntry>;
  /** What a location is decides what can answer for it, and only the shape knows. */
  readonly #tree: EntryTree;

  constructor(tree: EntryTree & ObservableStructure) {
    this.#tree = tree;
    this.#chain = new ObservationChain<StateEntry, StateNodeEntry>(tree, {
      id: tree.root().id,
      kind: StateKind.Node,
      parent: null,
      state: new StateAggregate(),
    });

    tree.on("reopened", (id) => this.#reopened(id));
  }

  /** Always materialized, so a form can always answer for itself as a whole. */
  root(): StateNodeEntry {
    return this.#chain.root();
  }

  find(id: EntryId): StateEntry | undefined {
    return this.#chain.find(id);
  }

  entry(id: EntryId): StateEntry {
    return this.#chain.node(id);
  }

  has(id: EntryId): boolean {
    return this.#chain.has(id);
  }

  /**
   * Registering twice counts one more watcher and returns what is there, so a
   * second `Controller` on the same path keeps the state the first one had.
   *
   * Who is there is asked before joining, because joining counts a watcher and
   * refusing afterwards would count one that never arrived.
   */
  register(id: EntryId, initial: FieldState = new FieldState()): StateFieldEntry {
    const occupant = this.#chain.find(id);

    if (occupant) {
      const field = StateGraph.#asField(occupant);

      this.#chain.join(field);

      return field;
    }

    const field: StateFieldEntry = { id, kind: StateKind.Field, parent: null, state: initial };

    this.#chain.join(field);
    this.#propagate(field.parent, 0, field.state.flags);

    return field;
  }

  /**
   * Takes a field's state away and discounts it from everyone above.
   *
   * The field is detached on the way out, so a later update through a reference
   * somebody kept is inert rather than counting a discounted contributor.
   */
  unregister(id: EntryId): readonly StateEntry[] {
    const existing = this.#chain.find(id);

    if (!existing) {
      return NOTHING_MOVED;
    }

    const field = StateGraph.#asField(existing);
    const parent = field.parent;

    // Discounting a field somebody else still watches would take flags off a
    // contributor that has not gone anywhere.
    if (!this.#chain.leave(id)) {
      return NOTHING_MOVED;
    }

    return this.#propagate(parent, field.state.flags, 0);
  }

  /**
   * The hot path. It takes the field rather than its id because the writer
   * already holds it.
   *
   * A value can speak for one flag and no other, so this is the only one it
   * moves: what the user did and what a validation found are not its to undo.
   */
  assessed(field: StateFieldEntry, dirty: boolean): readonly StateEntry[] {
    const held = field.state.flags;

    field.state.assessed(dirty);

    return this.#moved(field, held, field.state.errors);
  }

  /**
   * Errors move by reference and never by content: this has no way to know
   * what a caller's error shape means, so it trusts the reference it was
   * handed, the same way a value write trusts the one it receives. An empty
   * collection is how they are cleared.
   */
  validated(field: StateFieldEntry, invalid: boolean, errors: readonly unknown[]): readonly StateEntry[] {
    const held = field.state.flags;
    const shown = field.state.errors;

    field.state.validated(invalid, errors);

    return this.#moved(field, held, shown);
  }

  touch(field: StateFieldEntry): readonly StateEntry[] {
    const held = field.state.flags;

    field.state.touch();

    return this.#moved(field, held, field.state.errors);
  }

  /**
   * How many items an array holds against how many its base holds.
   *
   * Every position both sides have is answered for by the fields sitting in
   * it, each against the same position of the base. The ones only one side has
   * are answered for here, because there is no field in them to ask.
   */
  measured(id: EntryId, length: number, expected: number): readonly StateEntry[] {
    const array = StateGraph.#asArray(this.entry(id));
    const held = array.state.flags;

    array.state.measured(length, expected);

    if (array.state.flags === held) {
      return NOTHING_MOVED;
    }

    return this.#propagate(array.parent, held, array.state.flags, [array]);
  }

  /**
   * Everyone whose public state moved, which is the same as everyone who has
   * to be told. Flags and errors landing on what they already were reach
   * nobody above, which is what keeps typing into an already touched field
   * from waking the root.
   */
  #moved(field: StateFieldEntry, heldFlags: number, shownErrors: readonly unknown[]): readonly StateEntry[] {
    if (field.state.flags === heldFlags) {
      return field.state.errors === shownErrors ? NOTHING_MOVED : [field];
    }

    return this.#propagate(field.parent, heldFlags, field.state.flags, [field]);
  }

  /** For callers that do not hold the field, such as an imperative set. */
  field(id: EntryId): StateFieldEntry {
    return StateGraph.#asField(this.entry(id));
  }

  /**
   * Starts deriving state for a node, taking over the children that reported
   * further up.
   *
   * The parent counted each of those children directly and from now on counts
   * the node once, so their weight comes off before the node's goes on.
   */
  materialize(id: EntryId): StateNodeEntry {
    const occupant = this.#chain.find(id);

    if (occupant) {
      const node = StateGraph.#asNode(occupant);

      this.#chain.insert(node);

      return node;
    }

    const node = this.#hold(id);

    const parent = this.#chain.parentOf(id);
    const held = parent.state.flags;
    const inserted = this.#chain.insert(node);

    for (const child of inserted.claimed) {
      node.state.add(child.state.flags);
      this.#contribute(parent, child.state.flags, 0);
    }

    this.#contribute(parent, 0, node.state.flags);
    this.#settle(parent, held);

    return node;
  }

  /**
   * A field owns state that a node cannot hold, so what it was keeping stopped
   * applying the moment the location took children on. Nothing happens for a
   * location nobody watches, which is most of them.
   */
  #reopened(id: EntryId): void {
    const entry = this.#chain.find(id);

    if (!entry || entry.kind !== StateKind.Field) {
      return;
    }

    this.#promote(entry);
  }

  /** The mirror of `materialize`: the children go back to reporting upward. */
  dematerialize(id: EntryId): void {
    // Checked before anything moves, so refusing a field leaves the chain intact.
    const node = StateGraph.#asNode(this.entry(id));
    const removal = this.#chain.remove(id);

    if (!removal) {
      return;
    }

    const parent = removal.parent;
    const held = parent.state.flags;

    this.#contribute(parent, node.state.flags, 0);

    for (const child of removal.adopted) {
      this.#contribute(parent, 0, child.state.flags);
    }

    this.#settle(parent, held);
  }

  /**
   * Folds a change into every ancestor and stops at the first one deriving the
   * flags it already had: above that, nothing changed either.
   *
   * What comes back is everyone whose public state moved, which is the same as
   * everyone who has to be told. The stop is not only an optimization, it draws
   * the line between who changed and who did not.
   *
   * The collection is built only once there is something to put in it.
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
      const held = node.state.flags;

      this.#contribute(node, before, after);

      if (node.state.flags === held) {
        break;
      }

      moved ??= [];
      moved.push(node);

      before = held;
      after = node.state.flags;
      node = node.parent;
    }

    return moved ?? NOTHING_MOVED;
  }

  /**
   * Folds one child's change into a node and recomputes its public flags.
   *
   * A counter below zero means a delta was lost here. That has to be loud
   * rather than leave a form quietly claiming less than it holds.
   */
  #contribute(node: StateNodeEntry, previous: number, current: number): void {
    node.state.fold(previous, current);

    if (node.state.isUnderflowed()) {
      throw new StateAggregateUnderflow(node.id as number);
    }
  }

  /**
   * Reports a node upward after several contributors changed in one go.
   *
   * The comparison is against the flags held before the whole operation, not
   * against each intermediate step.
   */
  #settle(node: StateNodeEntry, held: number): void {
    if (node.state.flags !== held) {
      this.#propagate(node.parent, held, node.state.flags);
    }
  }

  /**
   * A field promoted to a node owns nothing it used to. Touched has no single
   * child to inherit it. Invalid and validating described a direct validation
   * that a node cannot run. Dirty is left to be rederived once its fields
   * compare their own values against their own defaults.
   */
  #promote(field: StateFieldEntry): StateNodeEntry {
    const parent = field.parent;

    if (parent) {
      const held = parent.state.flags;

      this.#contribute(parent, field.state.flags, 0);
      this.#settle(parent, held);
    }

    return this.#chain.replace(field.id, this.#hold(field.id));
  }

  /** A location that holds others answers with whatever its kind can answer with. */
  #hold(id: EntryId): StateNodeEntry {
    return this.#tree.entry(id).kind === PathKind.Array
      ? { id, kind: StateKind.Array, parent: null, state: new ArrayStateAggregate() }
      : { id, kind: StateKind.Node, parent: null, state: new StateAggregate() };
  }

  static #asField(entry: StateEntry): StateFieldEntry {
    if (entry.kind !== StateKind.Field) {
      throw new StateKindConflict(entry.id as number, entry.kind, StateKind.Field);
    }

    return entry;
  }

  static #asNode(entry: StateEntry): StateNodeEntry {
    if (entry.kind === StateKind.Field) {
      throw new StateKindConflict(entry.id as number, entry.kind, StateKind.Node);
    }

    return entry;
  }

  static #asArray(entry: StateEntry): StateArrayEntry {
    if (entry.kind !== StateKind.Array) {
      throw new StateKindConflict(entry.id as number, entry.kind, StateKind.Array);
    }

    return entry;
  }
}
