/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { ObservationChain } from "../observation/ObservationChain";
import type { EntryId, EntryTree, ObservableStructure } from "../path/types";
import { StateAggregateUnderflow, StateKindConflict } from "./errors";
import { FieldState } from "./FieldState";
import { StateAggregate } from "./StateAggregate";
import { type FieldStateInput, type StateEntry, type StateFieldEntry, StateKind, type StateNodeEntry } from "./types";

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

  constructor(tree: EntryTree & ObservableStructure) {
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
  register(id: EntryId, initial: FieldStateInput = {}): StateFieldEntry {
    const occupant = this.#chain.find(id);

    if (occupant) {
      const field = StateGraph.#asField(occupant);

      this.#chain.join(field);

      return field;
    }

    const field: StateFieldEntry = {
      id,
      kind: StateKind.Field,
      parent: null,
      state: new FieldState(initial.flags, initial.errors),
    };

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
   * Errors are only touched when the caller brings them, so typing allocates
   * nothing; an empty collection is how they are cleared. Whether they moved is
   * decided by reference, never by content: this has no way to know what a
   * caller's error shape means, so it trusts the reference it was handed, the
   * same way a value write trusts the reference it receives.
   *
   * Flags and errors landing on the same reference reach nobody above, which is
   * what keeps typing into an already touched field from waking the root.
   */
  update(field: StateFieldEntry, next: FieldStateInput): readonly StateEntry[] {
    const previousFlags = field.state.flags;
    const previousErrors = field.state.errors;

    field.state.flags = next.flags ?? 0;

    if (next.errors !== undefined) {
      field.state.errors = next.errors;
    }

    if (field.state.flags === previousFlags) {
      return field.state.errors === previousErrors ? NOTHING_MOVED : [field];
    }

    return this.#propagate(field.parent, previousFlags, field.state.flags, [field]);
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

    const node: StateNodeEntry = { id, kind: StateKind.Node, parent: null, state: new StateAggregate() };

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

    if (!entry || entry.kind === StateKind.Node) {
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

    return this.#chain.replace(field.id, {
      id: field.id,
      kind: StateKind.Node,
      parent: null,
      state: new StateAggregate(),
    });
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
