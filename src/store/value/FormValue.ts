/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues } from "../../path";
import { SingleEntryCache } from "../../SingleEntryCache";
import {
  type EntryTree,
  type PathIndexArrayEntry,
  type PathIndexEntry,
  type PathIndexStructuralEntry,
  PathKind,
  type PathStep,
  type StepsOf,
} from "../path/types";
import { InvalidRootValue, PathInsideValue } from "./errors";
import { PathValueClassifier } from "./PathValueClassifier";
import type { ValueContainer } from "./types";

/** What a walk hands over at every location it stops on. */
type Reached = (at: PathIndexEntry, value: unknown, defaultValue: unknown) => void;

/**
 * The live value of a form, plus the defaults it is compared against.
 *
 * An entry carries the key and its parent carries the container, so a descent
 * driven by one never splits a path or walks from the root.
 */
export class FormValue<THeld extends FormValues = FormValues> {
  readonly #tree: EntryTree;
  readonly #classifier: PathValueClassifier;
  #defaults: THeld;
  readonly #container = new SingleEntryCache<PathIndexEntry, ValueContainer>();

  #root: THeld;

  constructor(tree: EntryTree, classifier: PathValueClassifier, values: THeld, defaults: THeld) {
    this.#classifier = classifier;
    this.#tree = tree;

    this.#assertRoot(values);
    this.#assertRoot(defaults);

    this.#root = values;
    this.#defaults = defaults;
  }

  /**
   * What lives at every name of a run of them, for a caller holding no entry
   * yet.
   *
   * A step past where the value stops says nothing, which is what leaves the
   * path string to decide. So does one holding nothing: an absent location is
   * not a field, it is a location nobody has answered for yet.
   *
   * A location the form holds as one value is the one thing it refuses to go
   * into: its parts are not properties, so there is nothing underneath to
   * reach.
   */
  observe<TSegments extends readonly string[]>(segments: TSegments): StepsOf<TSegments> {
    const steps: PathStep[] = [];

    let container: ValueContainer = this.#root;

    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      const value = FormValue.#at(container, segment);

      if (this.#classifier.isContainer(value)) {
        steps.push({ segment, observed: Array.isArray(value) ? PathKind.Array : PathKind.Object });
        container = value;
        continue;
      }

      if (value === undefined || value === null) {
        steps.push({ segment });
        break;
      }

      steps.push({ segment, observed: PathKind.Field });

      if (index < segments.length - 1 && PathValueClassifier.isComposite(value)) {
        throw new PathInsideValue(segments.join("."), segments.slice(0, index + 1).join("."));
      }

      break;
    }

    while (steps.length < segments.length) {
      steps.push({ segment: segments[steps.length] });
    }

    // A tuple cannot be built by pushing: neither a loop nor `map` keeps a
    // position, so the one step per segment this makes is stated rather than
    // shown.
    return steps as StepsOf<TSegments>;
  }

  /**
   * What lives at a run of names, for a caller holding no entry yet.
   *
   * It answers absent for a name the value stops before, which is the same
   * answer a location holding nothing gives: a form is everything it can hold,
   * less whatever nobody filled in, and neither side of that is worth telling
   * apart from outside.
   *
   * It goes no further than `observe` would: a location the form holds as one
   * value has no parts to reach into.
   */
  at(segments: readonly string[]): unknown {
    let held: unknown = this.#root;

    for (const segment of segments) {
      if (!this.#classifier.isContainer(held)) {
        return undefined;
      }

      held = FormValue.#at(held, segment);
    }

    return held;
  }

  get value(): THeld {
    return this.#root;
  }

  get defaults(): THeld {
    return this.#defaults;
  }

  /** Reads without creating anything: a path that is not navigable is `undefined`. */
  read(entry: PathIndexEntry): unknown {
    if (!entry.parent) {
      return this.#root;
    }

    const container = this.#reach(entry.parent, this.#root);

    return container === undefined ? undefined : FormValue.#at(container, this.#keyOf(entry));
  }

  /** Reads the base value an entry is compared against to decide whether it is dirty. */
  default(entry: PathIndexEntry): unknown {
    if (!entry.parent) {
      return this.#defaults;
    }

    const container = this.#reach(entry.parent, this.#defaults);

    return container === undefined ? undefined : FormValue.#at(container, this.#keyOf(entry));
  }

  /**
   * Every location under one, each with what it holds and what it is measured
   * against, innermost last.
   *
   * The walk carries the containers down rather than looking each location up
   * from the root: it is already standing where the next one lives, and asking
   * again would be undoing the step it just took.
   *
   * A location is answered for before the ones under it, because what it is
   * composed of is its own to decide — a list says how many positions it has,
   * and only then is there anything in them to reach.
   */
  reconcile(entry: PathIndexEntry, each: Reached): void {
    this.#descend(entry, this.read(entry), this.default(entry), each);
  }

  #descend(at: PathIndexEntry, value: unknown, defaultValue: unknown, each: Reached): void {
    each(at, value, defaultValue);

    if (at.kind === PathKind.Field) {
      return;
    }

    const children = this.#tree.childrenOf(at.id);
    // Asked once for the level rather than once for each of its children, and
    // asked of the classifier so that a shape the form holds whole is not read
    // for parts it does not have.
    const held = this.#classifier.isContainer(value) ? value : undefined;
    const measured = this.#classifier.isContainer(defaultValue) ? defaultValue : undefined;

    for (let position = 0; position < children.length; position++) {
      const child = children[position];
      const key = child.segment ?? position;

      this.#descend(child, held && FormValue.#at(held, key), measured && FormValue.#at(measured, key), each);
    }
  }

  /**
   * Writes, creating whatever containers the destination needs. A missing
   * container is never a special case, however it came to be missing.
   *
   * It answers whether anything actually moved, which is what lets a caller
   * leave alone what a write that landed on its own value never touched. Only a
   * field is compared: a container is reached through and what lives inside
   * answers for itself, one field at a time.
   */
  write(entry: PathIndexEntry, value: unknown): boolean {
    if (!entry.parent) {
      throw new InvalidRootValue();
    }

    const container = this.#build(entry.parent);
    const key = this.#keyOf(entry);

    if (entry.kind === PathKind.Field && this.#classifier.equals(FormValue.#at(container, key), value)) {
      return false;
    }

    FormValue.#assign(container, key, value);

    // Writing a field replaces a leaf nobody descends through, but writing a
    // node replaces the very container this and everything under it is reached
    // by, and the descent that would notice is the one being remembered.
    if (entry.kind !== PathKind.Field) {
      this.clear();
    }

    return true;
  }

  insert(array: PathIndexArrayEntry, index: number, value: unknown): void {
    this.#items(array).splice(index, 0, value);
  }

  remove(array: PathIndexArrayEntry, index: number): void {
    this.#items(array).splice(index, 1);
  }

  move(array: PathIndexArrayEntry, from: number, to: number): void {
    const items = this.#items(array);
    const [held] = items.splice(from, 1);

    items.splice(to, 0, held);
  }

  swap(array: PathIndexArrayEntry, left: number, right: number): void {
    const items = this.#items(array);

    [items[left], items[right]] = [items[right], items[left]];
  }

  /**
   * A location the shape calls a list is given one when the value stopped being
   * one, rather than reordering whatever it turned into: what the form was
   * asked to hold is what says how it is addressed.
   */
  #items(array: PathIndexArrayEntry): unknown[] {
    const held = this.#build(array);

    if (Array.isArray(held)) {
      return held;
    }

    const items: unknown[] = [];

    FormValue.#assign(this.#build(array.parent), this.#keyOf(array), items);
    this.#container.set(array, items);

    return items;
  }

  /**
   * For a value that changed without going through `write`. Neither writes nor
   * array operations need it: a descent leaves the slot holding the container
   * it just reached, and reordering keeps the item objects themselves.
   */
  clear(): void {
    this.#container.clear();
  }

  /**
   * A form born again: what it holds and what it is measured against, both at
   * once.
   *
   * They arrive as two values and not one because the form writes into what it
   * holds, and a base that moved with it would be no base at all.
   */
  rebase(values: THeld, defaults: THeld): void {
    this.#assertRoot(values);
    this.#assertRoot(defaults);

    this.#root = values;
    this.#defaults = defaults;
    this.clear();
  }

  replace(values: THeld): void {
    this.#assertRoot(values);

    this.#root = values;
    this.clear();
  }

  /** Walks down to an entry's container, stopping at the first missing step. */
  #reach(entry: PathIndexStructuralEntry, from: THeld): ValueContainer | undefined {
    if (!entry.parent) {
      return from;
    }

    const cached = from === this.#root ? this.#container.get(entry) : undefined;

    if (cached) {
      return cached;
    }

    const parent = this.#reach(entry.parent, from);

    if (parent === undefined) {
      return undefined;
    }

    const current = FormValue.#at(parent, this.#keyOf(entry));

    if (!this.#classifier.isContainer(current)) {
      return undefined;
    }

    if (from === this.#root) {
      this.#container.set(entry, current);
    }

    return current;
  }

  /** Walks down to an entry's container, creating every step that is missing. */
  #build(entry: PathIndexStructuralEntry): ValueContainer {
    if (!entry.parent) {
      return this.#root;
    }

    const cached = this.#container.get(entry);

    if (cached) {
      return cached;
    }

    const parent = this.#build(entry.parent);
    const key = this.#keyOf(entry);
    const current = FormValue.#at(parent, key);

    const container = this.#classifier.isContainer(current) ? current : FormValue.#empty(entry);

    if (container !== current) {
      FormValue.#assign(parent, key, container);
    }

    this.#container.set(entry, container);

    return container;
  }

  /** How an entry is named by its parent. */
  #keyOf(entry: PathIndexEntry): string | number {
    return entry.segment ?? this.#tree.positionOf(entry.id);
  }

  static #empty(entry: PathIndexEntry): ValueContainer {
    return entry.kind === PathKind.Array ? [] : {};
  }

  static #at(container: ValueContainer, key: string | number): unknown {
    return (container as Record<string | number, unknown>)[key];
  }

  static #assign(container: ValueContainer, key: string | number, value: unknown): void {
    (container as Record<string | number, unknown>)[key] = value;
  }

  #assertRoot(value: unknown): void {
    if (this.#classifier.classify(value) !== PathKind.Object) {
      throw new InvalidRootValue();
    }
  }
}
