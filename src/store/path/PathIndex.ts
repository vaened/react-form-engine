/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { Path as FormPath, FormValues } from "../../path";
import type { PathId, PathIdentifier } from "../state/PathRegistry";
import {
  InvalidArrayIndex,
  InvalidPathSegment,
  MissingArrayPosition,
  NotAnArrayEntry,
  PathKindConflict,
  UnknownChildPath,
  UnknownEntryId,
  UnknownPathId,
} from "./errors";
import {
  type EntryId,
  type PathDescendants,
  type PathIndexArrayEntry,
  type PathIndexChildEntry,
  type PathIndexEntry,
  type PathIndexFieldEntry,
  type PathIndexObjectEntry,
  type PathIndexRootEntry,
  type PathIndexStructuralEntry,
  PathKind,
  type RegisterableKind,
  type Route,
  type RouteStep,
} from "./types";

const INDEX_SEGMENT = /^\d+$/;

/**
 * Canonical structural representation of a form value.
 *
 * Holds no values. It answers where a location is, who its parent is and who
 * its children are, and it keeps that answer correct while array items move.
 *
 * Two structures live here:
 *
 * - `#entries`, keyed by a structural `EntryId` that is minted once and never
 *   reused. The tree itself lives inside the entries as `parent`/`children`
 *   object references, so navigation never consults this map.
 * - `#routes`, keyed by the public `PathId`. A route is the parsed path: an
 *   anchor plus the steps left after the first positional segment.
 *
 * Positions exist in exactly one place, the `children` array of an array entry.
 * That is what lets `move`, `insert`, `remove` and `swap` run without rewriting
 * a single route and without reassigning a single entry id.
 */
export class PathIndex<TValues extends FormValues = FormValues> {
  readonly #paths: PathIdentifier<FormPath<TValues>>;
  readonly #root: PathIndexRootEntry;
  readonly #entries = new Map<EntryId, PathIndexEntry>();
  readonly #routes = new Map<PathId<FormPath<TValues>>, Route>();

  #nextEntryId = 0;

  constructor(paths: PathIdentifier<FormPath<TValues>>) {
    this.#paths = paths;
    this.#root = {
      id: this.#mint(),
      segment: null,
      kind: PathKind.Root,
      parent: null,
      children: new Map(),
    };

    this.#entries.set(this.#root.id, this.#root);
  }

  root(): PathIndexRootEntry {
    return this.#root;
  }

  /**
   * Ensures the whole branch of `path` exists and remembers how to reach it.
   *
   * Cold path: this is where the string is split, the branch is walked and the
   * route is built. It runs once per public path.
   */
  register(path: FormPath<TValues>, kind: RegisterableKind): PathIndexChildEntry {
    const pathId = this.#paths.register(path);
    const known = this.#routes.get(pathId);
    const reachable = known && this.#reachable(known);

    if (reachable) {
      this.#assertKind(reachable, path, kind);

      // A registered path always has at least one segment, so it never lands on root.
      return reachable as PathIndexChildEntry;
    }

    // Either the path is new, or its route outlived the entries it used to
    // reach. Routes survive structural operations on purpose, so registering
    // again has to rebuild the branch instead of trusting the old one.
    const segments = path.split(".");
    const steps: RouteStep[] = [];

    let current: PathIndexEntry = this.#root;
    let anchor: PathIndexEntry = this.#root;
    let leaf: PathIndexChildEntry | null = null;

    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      const last = index === segments.length - 1;
      const childKind = last ? kind : PathIndex.#infer(segments[index + 1]);

      let child: PathIndexChildEntry;

      if (current.kind === PathKind.Array) {
        const position = PathIndex.#toIndex(path, segment);

        child = this.#ensureItem(current, position, childKind, path);
        steps.push({ at: position });
      } else if (current.kind === PathKind.Field) {
        throw new PathKindConflict(path, current.kind, PathKind.Object);
      } else {
        PathIndex.#assertValidSegment(segment);

        child = this.#ensureChild(current, segment, childKind, path);

        if (steps.length > 0) {
          steps.push({ key: segment });
        }
      }

      if (steps.length === 0) {
        anchor = child;
      }

      current = child;
      leaf = child;
    }

    if (!leaf) {
      throw new InvalidPathSegment(path);
    }

    this.#routes.set(pathId, { anchor, steps });

    return leaf;
  }

  /**
   * Resolves a registered public path id to the entry that currently occupies
   * it. This is the hot path: no split, no walk from root, no search.
   */
  locate(pathId: PathId<FormPath<TValues>>): PathIndexEntry {
    const route = this.#routes.get(pathId);

    if (!route) {
      throw new UnknownPathId(pathId as number);
    }

    return this.#follow(route);
  }

  resolve(path: FormPath<TValues>): PathIndexEntry | undefined {
    const pathId = this.#paths.resolve(path);

    if (pathId === undefined || !this.#routes.has(pathId)) {
      return undefined;
    }

    return this.locate(pathId);
  }

  find(id: EntryId): PathIndexEntry | undefined {
    return this.#entries.get(id);
  }

  entry(id: EntryId): PathIndexEntry {
    const entry = this.#entries.get(id);

    if (!entry) {
      throw new UnknownEntryId(id as number);
    }

    return entry;
  }

  contains(id: EntryId): boolean {
    return this.#entries.has(id);
  }

  parentOf(id: EntryId): PathIndexStructuralEntry | null {
    return this.entry(id).parent;
  }

  childrenOf(id: EntryId): PathIndexChildEntry[] {
    return [...PathIndex.#children(this.entry(id))];
  }

  ancestorsOf(id: EntryId): PathIndexStructuralEntry[] {
    const ancestors: PathIndexStructuralEntry[] = [];

    let current = this.entry(id).parent;

    while (current) {
      ancestors.push(current);
      current = current.parent;
    }

    return ancestors;
  }

  descendantsOf(id: EntryId): PathDescendants {
    const nodes: (PathIndexObjectEntry | PathIndexArrayEntry)[] = [];
    const fields: PathIndexFieldEntry[] = [];

    const visit = (entry: PathIndexEntry): void => {
      for (const child of PathIndex.#children(entry)) {
        if (child.kind === PathKind.Field) {
          fields.push(child);
          continue;
        }

        nodes.push(child);
        visit(child);
      }
    };

    visit(this.entry(id));

    return { nodes, fields };
  }

  /**
   * Rebuilds the public path of an entry.
   *
   * Cold path only. Each array level costs an `indexOf` over its children,
   * because position is derived from the order and is not stored on the item.
   */
  describe(id: EntryId): string {
    const segments: string[] = [];

    let current: PathIndexEntry = this.entry(id);

    while (current.parent) {
      const parent: PathIndexStructuralEntry = current.parent;

      if (parent.kind === PathKind.Array) {
        const position = parent.children.indexOf(current as PathIndexChildEntry);

        if (position < 0) {
          throw new UnknownEntryId(current.id as number);
        }

        segments.push(String(position));
      } else {
        if (current.segment === null) {
          throw new UnknownEntryId(current.id as number);
        }

        segments.push(current.segment);
      }

      current = parent;
    }

    return segments.reverse().join(".");
  }

  /**
   * Declares a new occurrence at `index` and shifts the ones after it.
   *
   * The value alone cannot express this: an array that grew by one looks the
   * same whether an item was inserted, renamed or wholly replaced. Only the
   * operation carries the intent, which is what lets the shifted items keep
   * their identity.
   *
   * The item is born childless, like any other {@link PathIndexChildEntry} the
   * index creates for a position. See `#create`.
   */
  insert(arrayId: EntryId, index: number, kind: RegisterableKind): PathIndexChildEntry {
    const array = this.#array(arrayId);

    if (index < 0 || index > array.children.length) {
      throw new MissingArrayPosition(index, array.children.length);
    }

    const item = this.#create(array, null, kind);

    array.children.splice(index, 0, item);

    return item;
  }

  append(arrayId: EntryId, kind: RegisterableKind): PathIndexChildEntry {
    return this.insert(arrayId, this.#array(arrayId).children.length, kind);
  }

  remove(arrayId: EntryId, index: number): void {
    const array = this.#array(arrayId);

    PathIndex.#assertPosition(array, index);

    const [removed] = array.children.splice(index, 1);

    this.#forget(removed);
  }

  move(arrayId: EntryId, from: number, to: number): void {
    const array = this.#array(arrayId);

    PathIndex.#assertPosition(array, from);
    PathIndex.#assertPosition(array, to);

    const [item] = array.children.splice(from, 1);

    array.children.splice(to, 0, item);
  }

  swap(arrayId: EntryId, left: number, right: number): void {
    const array = this.#array(arrayId);

    PathIndex.#assertPosition(array, left);
    PathIndex.#assertPosition(array, right);

    const { children } = array;

    [children[left], children[right]] = [children[right], children[left]];
  }

  /**
   * Follows a route without throwing when the structure moved underneath it.
   *
   * A route outlives the entries it reaches: remove destroys items, while the
   * route keeps describing the position it always described. It also checks the
   * anchor is still alive, because removing an item destroys the arrays nested
   * inside it and a route anchored there would otherwise follow a dead entry.
   */
  #reachable(route: Route): PathIndexEntry | undefined {
    if (!this.#entries.has(route.anchor.id)) {
      return undefined;
    }

    try {
      return this.#follow(route);
    } catch (error) {
      if (
        error instanceof MissingArrayPosition ||
        error instanceof UnknownChildPath ||
        error instanceof NotAnArrayEntry
      ) {
        return undefined;
      }

      throw error;
    }
  }

  #follow(route: Route): PathIndexEntry {
    let current: PathIndexEntry = route.anchor;

    for (const step of route.steps) {
      if ("at" in step) {
        if (current.kind !== PathKind.Array) {
          throw new NotAnArrayEntry(current.id as number);
        }

        const next = current.children[step.at];

        if (!next) {
          throw new MissingArrayPosition(step.at, current.children.length);
        }

        current = next;
        continue;
      }

      if (current.kind === PathKind.Field || current.kind === PathKind.Array) {
        throw new UnknownChildPath(this.describe(current.id), step.key);
      }

      const next = current.children.get(step.key);

      if (!next) {
        throw new UnknownChildPath(this.describe(current.id), step.key);
      }

      current = next;
    }

    return current;
  }

  #ensureChild(
    parent: PathIndexRootEntry | PathIndexObjectEntry,
    segment: string,
    kind: RegisterableKind,
    path: string,
  ): PathIndexChildEntry {
    const existing = parent.children.get(segment);

    if (existing) {
      this.#assertKind(existing, path, kind);

      return existing;
    }

    const child = this.#create(parent, segment, kind);

    parent.children.set(segment, child);

    return child;
  }

  /**
   * Returns the item at `index`, creating it and every position before it.
   *
   * Registration is independent of the value, so a path may claim any position
   * without the ones before it being in use. An ordered list cannot hold gaps,
   * so those positions become real entries rather than JavaScript holes. Items
   * of an array share a kind, so they take the kind the caller asked for.
   */
  #ensureItem(array: PathIndexArrayEntry, index: number, kind: RegisterableKind, path: string): PathIndexChildEntry {
    const { children } = array;

    if (index < children.length) {
      const existing = children[index];

      this.#assertKind(existing, path, kind);

      return existing;
    }

    while (children.length <= index) {
      children.push(this.#create(array, null, kind));
    }

    return children[index];
  }

  /**
   * Mints an occurrence: an identity, and nothing looked at inside it yet.
   *
   * Every entry is born childless, whether it came from a registration, from a
   * position filled to keep an ordered list contiguous, or from an insert. The
   * identity is the payload; children appear only when something registers a
   * path under it, and an occurrence nobody ever looks into stays childless for
   * good without that being an incomplete state.
   */
  #create(parent: PathIndexStructuralEntry, segment: string | null, kind: RegisterableKind): PathIndexChildEntry {
    const id = this.#mint();

    const entry: PathIndexChildEntry =
      kind === PathKind.Field
        ? { id, segment, kind, parent }
        : kind === PathKind.Array
          ? { id, segment, kind, parent, children: [] }
          : { id, segment, kind, parent, children: new Map() };

    this.#entries.set(id, entry);

    return entry;
  }

  #forget(entry: PathIndexEntry): void {
    this.#entries.delete(entry.id);

    for (const child of PathIndex.#children(entry)) {
      this.#forget(child);
    }
  }

  #array(id: EntryId): PathIndexArrayEntry {
    const entry = this.entry(id);

    if (entry.kind !== PathKind.Array) {
      throw new NotAnArrayEntry(id as number);
    }

    return entry;
  }

  #assertKind(entry: PathIndexEntry, path: string, expected: PathKind): void {
    if (entry.kind !== expected) {
      throw new PathKindConflict(path, entry.kind, expected);
    }
  }

  #mint(): EntryId {
    const id = this.#nextEntryId as EntryId;

    this.#nextEntryId += 1;

    return id;
  }

  static #children(entry: PathIndexEntry): Iterable<PathIndexChildEntry> {
    if (entry.kind === PathKind.Field) {
      return [];
    }

    return entry.kind === PathKind.Array ? entry.children : entry.children.values();
  }

  static #assertPosition(array: PathIndexArrayEntry, index: number): void {
    if (index < 0 || index >= array.children.length) {
      throw new MissingArrayPosition(index, array.children.length);
    }
  }

  static #assertValidSegment(segment: string): void {
    if (!segment || segment.trim() !== segment || segment.includes(".")) {
      throw new InvalidPathSegment(segment);
    }
  }

  static #toIndex(path: string, segment: string): number {
    if (!INDEX_SEGMENT.test(segment)) {
      throw new InvalidArrayIndex(path, segment);
    }

    const index = Number(segment);

    // Registering a position fills every position before it, so an index that
    // cannot be represented exactly would fill forever.
    if (!Number.isSafeInteger(index)) {
      throw new InvalidArrayIndex(path, segment);
    }

    return index;
  }

  /**
   * A path string is the only information available at registration time, so an
   * intermediate segment is treated as an array when the segment that follows
   * it is numeric. An object whose keys are digits would be misread here.
   */
  static #infer(next: string): PathKind.Array | PathKind.Object {
    return INDEX_SEGMENT.test(next) ? PathKind.Array : PathKind.Object;
  }
}
