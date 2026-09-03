/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues } from "../../path";
import { SingleEntryCache } from "../../SingleEntryCache";
import { type PathIndexEntry, type PathIndexStructuralEntry, PathKind } from "../path/types";
import { InvalidRootValue } from "./errors";
import type { ValueContainer } from "./types";

/**
 * The live value of a form, plus the defaults it is compared against.
 *
 * An entry carries the key and its parent carries the container, so nothing
 * here splits a path or walks from the root.
 */
export class FormValue<TValues extends FormValues = FormValues> {
  readonly #defaults: TValues;
  readonly #containers = new SingleEntryCache<PathIndexEntry, ValueContainer>();

  #root: TValues;

  constructor(values: TValues, defaults: TValues = values) {
    FormValue.#assertRoot(values);
    FormValue.#assertRoot(defaults);

    this.#root = values;
    this.#defaults = defaults;
  }

  get root(): TValues {
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

    return container === undefined ? undefined : FormValue.#at(container, FormValue.#keyOf(entry));
  }

  /** Reads the base value an entry is compared against to decide whether it is dirty. */
  readDefault(entry: PathIndexEntry): unknown {
    if (!entry.parent) {
      return this.#defaults;
    }

    const container = this.#reach(entry.parent, this.#defaults);

    return container === undefined ? undefined : FormValue.#at(container, FormValue.#keyOf(entry));
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

    FormValue.#assign(container, FormValue.#keyOf(entry), value);
  }

  /**
   * For a value that changed without going through `write`. Neither writes nor
   * array operations need it: a descent leaves the slot holding the container
   * it just reached, and reordering keeps the item objects themselves.
   */
  clear(): void {
    this.#containers.clear();
  }

  replaceRoot(values: TValues): void {
    FormValue.#assertRoot(values);

    this.#root = values;
    this.clear();
  }

  /** Walks down to an entry's container, stopping at the first missing step. */
  #reach(entry: PathIndexStructuralEntry, from: TValues): ValueContainer | undefined {
    if (!entry.parent) {
      return from;
    }

    const cached = from === this.#root ? this.#containers.get(entry) : undefined;

    if (cached) {
      return cached;
    }

    const parent = this.#reach(entry.parent, from);

    if (parent === undefined) {
      return undefined;
    }

    const current = FormValue.#at(parent, FormValue.#keyOf(entry));

    if (!FormValue.#isContainer(current)) {
      return undefined;
    }

    if (from === this.#root) {
      this.#containers.set(entry, current);
    }

    return current;
  }

  /** Walks down to an entry's container, creating every step that is missing. */
  #build(entry: PathIndexStructuralEntry): ValueContainer {
    if (!entry.parent) {
      return this.#root;
    }

    const cached = this.#containers.get(entry);

    if (cached) {
      return cached;
    }

    const parent = this.#build(entry.parent);
    const key = FormValue.#keyOf(entry);
    const current = FormValue.#at(parent, key);

    const container = FormValue.#isContainer(current) ? current : FormValue.#empty(entry);

    if (container !== current) {
      FormValue.#assign(parent, key, container);
    }

    this.#containers.set(entry, container);

    return container;
  }

  /** How an entry is named by its parent. */
  static #keyOf(entry: PathIndexEntry): string | number {
    if (entry.segment !== null) {
      return entry.segment;
    }

    if (!entry.parent || entry.parent.kind !== PathKind.Array) {
      throw new InvalidRootValue();
    }

    return entry.parent.children.indexOf(entry as never);
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

  static #isContainer(value: unknown): value is ValueContainer {
    return typeof value === "object" && value !== null;
  }

  static #assertRoot(value: unknown): void {
    if (!FormValue.#isContainer(value) || Array.isArray(value)) {
      throw new InvalidRootValue();
    }
  }
}
