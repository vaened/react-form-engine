/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues } from "../../path";
import { SingleEntryCache } from "../../SingleEntryCache";
import {
  type EntryTree,
  type PathIndexEntry,
  type PathIndexStructuralEntry,
  PathKind,
  type PathStep,
  type StepsOf,
} from "../path/types";
import { InvalidRootValue, PathInsideValue } from "./errors";
import { PathValueClassifier } from "./PathValueClassifier";
import type { ValueContainer } from "./types";

/**
 * The live value of a form, plus the defaults it is compared against.
 *
 * An entry carries the key and its parent carries the container, so a descent
 * driven by one never splits a path or walks from the root.
 */
export class FormValue<TValues extends FormValues = FormValues> {
  readonly #tree: EntryTree;
  readonly #classifier: PathValueClassifier;
  readonly #defaults: TValues;
  readonly #container = new SingleEntryCache<PathIndexEntry, ValueContainer>();

  #root: TValues;

  constructor(tree: EntryTree, classifier: PathValueClassifier, values: TValues, defaults: TValues) {
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

  get value(): TValues {
    return this.#root;
  }

  get defaults(): TValues {
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
   * Writes, creating whatever containers the destination needs. A missing
   * container is never a special case, however it came to be missing.
   */
  write(entry: PathIndexEntry, value: unknown): void {
    if (!entry.parent) {
      throw new InvalidRootValue();
    }

    const container = this.#build(entry.parent);

    FormValue.#assign(container, this.#keyOf(entry), value);

    // Writing a field replaces a leaf nobody descends through, but writing a
    // node replaces the very container this and everything under it is reached
    // by, and the descent that would notice is the one being remembered.
    if (entry.kind !== PathKind.Field) {
      this.clear();
    }
  }

  /**
   * For a value that changed without going through `write`. Neither writes nor
   * array operations need it: a descent leaves the slot holding the container
   * it just reached, and reordering keeps the item objects themselves.
   */
  clear(): void {
    this.#container.clear();
  }

  replace(values: TValues): void {
    this.#assertRoot(values);

    this.#root = values;
    this.clear();
  }

  /** Walks down to an entry's container, stopping at the first missing step. */
  #reach(entry: PathIndexStructuralEntry, from: TValues): ValueContainer | undefined {
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
