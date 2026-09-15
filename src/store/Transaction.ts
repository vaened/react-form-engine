/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, Path, PathValue } from "../path";
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
    this.#index.reconcile(
      entry.id,
      (field) => this.#field(field),
      (array) => this.#array(array),
      (object) => this.#object(object),
    );
  }

  /**
   * Brings what a location is composed of back in step with what it holds, the
   * same way an array's positions are: a name the value carries is a location
   * the form can address, whether or not anybody asked for it first.
   */
  #object(object: PathIndexRootEntry | PathIndexObjectEntry): void {
    const held = this.#value.read(object);

    if (!this.#classifier.isContainer(held) || Array.isArray(held)) {
      return;
    }

    for (const key of Object.keys(held)) {
      this.#index.ensureChild(object, key, this.#classifier.classify(held[key]));
    }
  }

  #field(field: PathIndexFieldEntry): void {
    if (!this.#state.has(field.id)) {
      return;
    }

    const dirty = this.#assessor.assess(this.#value.read(field), this.#value.default(field));

    for (const moved of this.#state.assessed(this.#state.field(field.id), dirty)) {
      this.#reach(moved);
    }
  }

  #array(array: PathIndexArrayEntry): void {
    const items = Transaction.#itemsOf(this.#value.read(array));
    const expected = Transaction.#itemsOf(this.#value.default(array)).length;

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

    if (!this.#state.has(array.id)) {
      return;
    }

    for (const moved of this.#state.measured(array.id, items.length, expected)) {
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
