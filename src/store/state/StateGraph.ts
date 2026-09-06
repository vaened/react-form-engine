/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { ObservationChain } from "../observation/ObservationChain";
import type { EntryId, EntryTree, ObservableStructure } from "../path/types";
import { StateAggregateUnderflow, StateKindConflict } from "./errors";
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
      flags: 0,
      aggregate: new StateAggregate(),
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
   */
  register(id: EntryId, initial: FieldStateInput = {}): StateFieldEntry {
    const field: StateFieldEntry = {
      id,
      kind: StateKind.Field,
      parent: null,
      flags: initial.flags ?? 0,
      errors: initial.errors ?? NO_ERRORS,
    };

    const joined = this.#chain.join(field);

    if (joined !== field) {
      return StateGraph.#asField(joined);
    }

    this.#propagate(field.parent, 0, field.flags);

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

    return this.#propagate(parent, field.flags, 0);
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
    const previousFlags = field.flags;
    const previousErrors = field.errors;

    field.flags = next.flags ?? 0;

    if (next.errors !== undefined) {
      field.errors = next.errors;
    }

    if (field.flags === previousFlags) {
      return field.errors === previousErrors ? NOTHING_MOVED : [field];
    }

    return this.#propagate(field.parent, previousFlags, field.flags, [field]);
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
    const node: StateNodeEntry = {
      id,
      kind: StateKind.Node,
      parent: null,
      flags: 0,
      aggregate: new StateAggregate(),
    };

    const parent = this.#chain.parentOf(id);
    const held = parent.flags;
    const inserted = this.#chain.insert(node);

    if (inserted.node !== node) {
      return StateGraph.#asNode(inserted.node);
    }

    for (const child of inserted.claimed) {
      node.aggregate.add(child.flags);
      this.#contribute(parent, child.flags, 0);
    }

    node.flags = node.aggregate.derive();

    this.#contribute(parent, 0, node.flags);
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
    const held = parent.flags;

    this.#contribute(parent, node.flags, 0);

    for (const child of removal.adopted) {
      this.#contribute(parent, 0, child.flags);
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
   * A counter below zero means a delta was lost here. That has to be loud
   * rather than leave a form quietly claiming less than it holds.
   */
  #contribute(node: StateNodeEntry, previous: number, current: number): void {
    node.aggregate.fold(previous, current);

    if (node.aggregate.isUnderflowed()) {
      throw new StateAggregateUnderflow(node.id as number);
    }

    node.flags = node.aggregate.derive();
  }

  /**
   * Reports a node upward after several contributors changed in one go.
   *
   * The comparison is against the flags held before the whole operation, not
   * against each intermediate step.
   */
  #settle(node: StateNodeEntry, held: number): void {
    if (node.flags !== held) {
      this.#propagate(node.parent, held, node.flags);
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
      const held = parent.flags;

      this.#contribute(parent, field.flags, 0);
      this.#settle(parent, held);
    }

    return this.#chain.replace(field.id, {
      id: field.id,
      kind: StateKind.Node,
      parent: null,
      flags: 0,
      aggregate: new StateAggregate(),
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
