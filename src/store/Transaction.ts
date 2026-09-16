/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { ArrayPath, FormValues, Path, PathValue } from "../path";
import type { ArrayItem, DeepPartial } from "../types";
import { MissingArrayPosition, NotAnArrayEntry } from "./path/errors";
import type { PathIndex } from "./path/PathIndex";
import {
  type PathIndexArrayEntry,
  type PathIndexChildEntry,
  type PathIndexEntry,
  type PathIndexFieldEntry,
  type PathIndexObjectEntry,
  type PathIndexRootEntry,
  PathKind,
  type RegisterableKind,
} from "./path/types";
import type { StateAssessor } from "./state/StateAssessor";
import type { StateGraph } from "./state/StateGraph";
import type { StateEntry } from "./state/types";
import { isolate } from "./value/isolate";
import type { PathValueClassifier } from "./value/PathValueClassifier";
import type { ValueEntry, ValueStore } from "./value/ValueStore";
import type { ValueWrite } from "./value/ValueWrite";

/**
 * One transaction, which is all this exists for: it is born knowing which one
 * it is, gathers what its writes reach, and tells them on commit.
 *
 * Until it commits nobody outside can tell anything happened, which is the same
 * isolation a database gives: the writes have landed, and the form still reads
 * as it did. Nothing it holds outlives the operation, so two transactions are
 * two of these and never one that has to be reset — a write arriving while
 * another is being committed, from a listener writing back, is simply the next.
 */
export class Transaction<TValues extends FormValues> {
  readonly #number: number;
  readonly #index: PathIndex<TValues>;
  readonly #value: ValueStore<TValues>;
  readonly #state: StateGraph;
  readonly #assessor: StateAssessor;
  readonly #classifier: PathValueClassifier;
  readonly #policy: ValueWrite;
  readonly #waiting: Set<() => void>[] = [];

  constructor(
    ordinal: number,
    index: PathIndex<TValues>,
    value: ValueStore<TValues>,
    state: StateGraph,
    assessor: StateAssessor,
    classifier: PathValueClassifier,
    policy: ValueWrite,
  ) {
    this.#number = ordinal;
    this.#index = index;
    this.#value = value;
    this.#state = state;
    this.#assessor = assessor;
    this.#classifier = classifier;
    this.#policy = policy;
  }

  /**
   * One named location, with everything it drags along. How many places the
   * value actually lands on is the policy's to decide: the same value falls on
   * one or on the several it carries, depending on how the form was built.
   *
   * Nobody is told here: while this runs the form is half made, and will be
   * again if more writes follow.
   */
  write<TPath extends Path<TValues>>(path: TPath, value: PathValue<TValues, TPath>): this {
    const entry = this.#index.resolve(path) ?? this.#claim(path, this.#classifier.classify(value));
    const written = this.#policy.write(entry, value);

    for (const at of written) {
      this.#climb(at);
    }

    for (const at of written) {
      this.#reconcile(at);
    }

    return this;
  }

  /**
   * The positions of a list, moved on both halves of the form at once.
   *
   * The shape carries the identity of an item and the value carries what it
   * holds, so an operation that moved one and not the other would leave every
   * position after it answering for its neighbour.
   *
   * The shape goes first, because it is the one that can refuse: a position it
   * does not have is an operation that never happened, and a value already
   * moved for it would be a form holding what nobody can address.
   *
   * Past the positions it has there is no entry to move, so the shape is left
   * alone rather than made to learn what nobody asked it: a position nobody
   * named holds no identity that shifting could preserve.
   */
  insert<TPath extends ArrayPath<TValues> & Path<TValues>>(
    path: TPath,
    index: number,
    value: ArrayItem<TValues, TPath>,
  ): this {
    const array = this.#list(path);
    const kind = this.#classifier.classify(value);
    const held = this.#held(array);

    this.#assertPosition(index, held);

    if (index <= array.children.length) {
      this.#index.insert(array.id, index, kind);
    }

    this.#value.insert(array, index, kind === PathKind.Field ? value : isolate(value, this.#classifier));

    return this.#settle(array);
  }

  remove<TPath extends ArrayPath<TValues> & Path<TValues>>(path: TPath, index: number): this {
    const array = this.#list(path);

    this.#assertPosition(index, this.#held(array) - 1);

    if (index < array.children.length) {
      this.#index.remove(array.id, index);
    }

    this.#value.remove(array, index);

    return this.#settle(array);
  }

  move<TPath extends ArrayPath<TValues> & Path<TValues>>(path: TPath, from: number, to: number): this {
    const array = this.#list(path);
    const last = this.#held(array) - 1;

    this.#assertPosition(from, last);
    this.#assertPosition(to, last);

    if (this.#addressable(array, from, to)) {
      this.#index.move(array.id, from, to);
    }

    this.#value.move(array, from, to);

    return this.#settle(array);
  }

  swap<TPath extends ArrayPath<TValues> & Path<TValues>>(path: TPath, left: number, right: number): this {
    const array = this.#list(path);
    const last = this.#held(array) - 1;

    this.#assertPosition(left, last);
    this.#assertPosition(right, last);

    if (this.#addressable(array, left, right)) {
      this.#index.swap(array.id, left, right);
    }

    this.#value.swap(array, left, right);

    return this.#settle(array);
  }

  /**
   * What a list owes everyone once its positions stopped meaning what they
   * meant.
   *
   * Nothing here was written and nothing changed shape: the same items are in
   * the same list, in another order, and one that arrived came whole rather
   * than typed into. So every position is measured against its base again,
   * every list says how long it turned out to be, and nobody is said to have
   * been anywhere.
   */
  #settle(array: PathIndexArrayEntry): this {
    this.#climb(array);

    this.#value.reconcile(array, (at, value, defaultValue) => {
      if (at.kind === PathKind.Field) {
        return this.#assess(at, value, defaultValue);
      }

      if (at.kind === PathKind.Array) {
        this.#measure(at, Transaction.#itemsOf(value).length, Transaction.#itemsOf(defaultValue).length);
      }
    });

    return this;
  }

  /**
   * Whether the shape can name both ends of a reorder.
   *
   * One end it has is an item whose state has to arrive at the other end, so the
   * shape is made to reach that far. Neither end it has is two positions nobody
   * named, and there is no identity for the move to carry.
   */
  #addressable(array: PathIndexArrayEntry, one: number, other: number): boolean {
    const known = array.children.length;

    if (Math.min(one, other) >= known) {
      return false;
    }

    const reach = Math.max(one, other);

    if (reach >= known) {
      const items = this.#value.read(array);

      this.#index.ensureItem(
        array.id,
        reach,
        this.#classifier.classify(Array.isArray(items) ? items[reach] : undefined),
      );
    }

    return true;
  }

  /**
   * How many positions a list has, which only the value can answer: the shape
   * holds the ones somebody named, and a caller counts the ones it can see.
   */
  #held(array: PathIndexArrayEntry): number {
    const items = this.#value.read(array);

    return Array.isArray(items) ? items.length : 0;
  }

  #assertPosition(index: number, limit: number): void {
    if (!Number.isInteger(index) || index < 0 || index > limit) {
      throw new MissingArrayPosition(index, Math.max(limit, 0));
    }
  }

  #list<TPath extends ArrayPath<TValues> & Path<TValues>>(path: TPath): PathIndexArrayEntry {
    const entry = this.#index.resolve(path) ?? this.#claim(path, PathKind.Array);

    if (entry.kind !== PathKind.Array) {
      throw new NotAnArrayEntry(entry.id);
    }

    return entry;
  }

  reset(base?: DeepPartial<TValues>): this {
    this.#value.rebase(base);

    const root = this.#index.root();

    this.#value.reconcile(root, (at, value, defaultValue) => {
      if (at.kind === PathKind.Field) {
        return this.#clear(at);
      }

      if (at.kind === PathKind.Array) {
        return this.#array(at, value, defaultValue);
      }

      this.#object(at, value);
    });

    this.#stir();

    return this;
  }

  /** A field a reset reached is the field it was born as. */
  #clear(field: PathIndexFieldEntry): void {
    if (!this.#state.has(field.id)) {
      return;
    }

    for (const moved of this.#state.clear(this.#state.field(field.id))) {
      this.#reach(moved);
    }
  }

  /**
   * Everyone watching a value, because the tree they were watching is not the
   * one the form holds now. There is no climb to cut short: nothing was spared.
   */
  #stir(): void {
    const root = this.#value.root();

    this.#value.stale(root);
    this.#reach(root);

    for (const inside of this.#value.descendantsOf(root.id)) {
      this.#value.stale(inside);
      this.#reach(inside);
    }
  }

  /**
   * The set of listeners is walked as it stands: one that leaves while this
   * runs may still be reached, and one that arrives will be. It is the same
   * rule the event emitter follows.
   */
  commit(): void {
    for (const listeners of this.#waiting) {
      for (const listener of listeners) {
        listener();
      }
    }
  }

  /**
   * Everyone whose value moved, innermost first and the root last.
   *
   * A climb that arrives at a location already reached stops there, because
   * everything above it was reached on the way. Writing anything but a field
   * replaces the container everything below is reached through, so those are
   * reached too — as a list and not a path, which is why no one of them says
   * anything about the others.
   */
  #climb(entry: PathIndexEntry): void {
    if (entry.kind !== PathKind.Field) {
      for (const inside of this.#value.descendantsOf(entry.id)) {
        this.#value.stale(inside);
        this.#reach(inside);
      }
    }

    for (let watcher: ValueEntry | null = this.#value.originOf(entry.id); watcher; watcher = watcher.parent) {
      if (watcher.mark === this.#number) {
        return;
      }

      this.#value.stale(watcher);
      this.#reach(watcher);
    }
  }

  /**
   * Brings the shape and the observed state back in step with the value that
   * just arrived.
   *
   * A field answers for itself. An array is told before the walk goes on,
   * because how many positions it has is the value's to decide and the ones
   * that outlived the value have to be gone before anything looks for them.
   */
  #reconcile(entry: PathIndexEntry): void {
    this.#value.reconcile(entry, (at, value, defaultValue) => {
      if (at.kind === PathKind.Field) {
        return this.#field(at, value, defaultValue);
      }

      if (at.kind === PathKind.Array) {
        return this.#array(at, value, defaultValue);
      }

      this.#object(at, value);
    });
  }

  /**
   * Brings what a location is composed of back in step with what it holds, the
   * same way an array's positions are: a name the value carries is a location
   * the form can address, whether or not anybody asked for it first.
   */
  #object(object: PathIndexRootEntry | PathIndexObjectEntry, held: unknown): void {
    if (!this.#classifier.isContainer(held) || Array.isArray(held)) {
      return;
    }

    for (const key of Object.keys(held)) {
      this.#index.ensureChild(object, key, this.#classifier.classify(held[key]));
    }
  }

  /**
   * A field a write reached has state, whether or not anybody asked for it:
   * setting a value is saying the location is the form's, and a form that
   * answers clean about a value it just took is answering about half of itself.
   *
   * One the write left as it found it is not reached at all, so it claims
   * nothing: nothing moved there, and a location the form was already holding
   * correctly has nothing to say.
   *
   * It is claimed once and lives as long as the location does. Nobody hands that
   * claim back, because nobody made it on their own behalf — the form made it,
   * and only the shape losing the location ends it.
   *
   * It is born clean and assessed right after, so what its arrival moves is
   * reported the same way any other move is.
   *
   * A location a write reached has been written, and that is all being touched
   * ever meant. Nothing here asks who was holding the keyboard: a form is
   * handed the values it starts with, and one handed them later is being
   * written to, whoever asked for it.
   */
  #field(field: PathIndexFieldEntry, value: unknown, defaultValue: unknown): void {
    if (!this.#state.has(field.id)) {
      this.#state.register(field.id);
    }

    this.#assess(field, value, defaultValue);

    for (const moved of this.#state.touch(this.#state.field(field.id))) {
      this.#reach(moved);
    }
  }

  /** What comparing a location against its base implies, for a location that has state. */
  #assess(field: PathIndexFieldEntry, value: unknown, defaultValue: unknown): void {
    if (!this.#state.has(field.id)) {
      return;
    }

    const verdict = this.#assessor.assess(value, defaultValue);

    for (const moved of this.#state.assessed(this.#state.field(field.id), verdict)) {
      this.#reach(moved);
    }
  }

  #array(array: PathIndexArrayEntry, value: unknown, defaultValue: unknown): void {
    const items = Transaction.#itemsOf(value);
    const expected = Transaction.#itemsOf(defaultValue).length;

    this.#index.truncate(array.id, items.length);

    const kept = array.children.length;

    for (let position = 0; position < items.length; position++) {
      const kind = this.#classifier.classify(items[position]);

      if (position >= kept) {
        this.#index.append(array.id, kind);
        continue;
      }

      if (array.children[position].kind !== kind) {
        this.#index.replace(array.id, position, kind);
      }
    }

    this.#measure(array, items.length, expected);
  }

  /** How long a list turned out to be, for one whose positions are already in step. */
  #measure(array: PathIndexArrayEntry, length: number, expected: number): void {
    if (!this.#state.has(array.id)) {
      return;
    }

    for (const moved of this.#state.measured(array.id, length, expected)) {
      this.#reach(moved);
    }
  }

  /** Reaches a path in the index, having made sure the value lets it through. */
  #claim<TPath extends Path<TValues>>(path: TPath, kind: RegisterableKind): PathIndexChildEntry {
    return this.#index.ensure(path, kind, this.#value.observe(this.#index.segmentsOf(path)));
  }

  /**
   * Stamps the transaction on a location and keeps whoever waits on it.
   *
   * The stamp is never cleared: the next transaction counts one higher, so every
   * mark left behind stops matching at once.
   */
  #reach(node: ValueEntry | StateEntry): void {
    if (node.mark === this.#number) {
      return;
    }

    node.mark = this.#number;

    if (node.listeners) {
      this.#waiting.push(node.listeners);
    }
  }

  static #itemsOf(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
  }
}
