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
  type EntryTree,
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
 * A structural entry seen from the one operation allowed to reshape one.
 *
 * `kind` reads as `readonly` everywhere else on purpose: what a location is
 * settles when it is claimed and nothing afterwards may quietly disagree. This
 * is the single exception, and naming it keeps the exception in one place.
 */
type OpenedEntry = PathIndexStructuralEntry & {
  kind: PathKind;
  children: Map<string, PathIndexChildEntry> | PathIndexChildEntry[];
};

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
export class PathIndex<TValues extends FormValues = FormValues> implements EntryTree {
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

  /** Ensures the whole branch of `path` exists and remembers how to reach it. */
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

      const holder = current.kind === PathKind.Field ? this.#open(current, segment) : current;

      let child: PathIndexChildEntry;

      if (holder.kind === PathKind.Array) {
        const position = PathIndex.#toIndex(path, segment);

        child = this.#ensureItem(holder, position, childKind, path, last);
        steps.push({ at: position });
      } else {
        PathIndex.#assertValidSegment(segment);

        child = this.#ensureChild(holder, segment, childKind, path, last);

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

  /** Resolves a path id to the entry that currently occupies it. */
  locate(pathId: PathId<FormPath<TValues>>): PathIndexEntry {
    const route = this.#routes.get(pathId);

    if (!route) {
      throw new UnknownPathId(pathId);
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
      throw new UnknownEntryId(id);
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
   * Walks down from `id`, stopping the instant a field or an array answers for
   * itself, and descending through anything else on the assumption that a key
   * still names the same location it always did.
   *
   * An array never gets that assumption: position is not identity, so nothing
   * below one can be reached this way. Only the array itself is reported.
   */
  reconcile(
    id: EntryId,
    onField: (entry: PathIndexFieldEntry) => void,
    onArray: (entry: PathIndexArrayEntry) => void,
  ): void {
    const entry = this.entry(id);

    if (entry.kind === PathKind.Field) {
      onField(entry);
      return;
    }

    if (entry.kind === PathKind.Array) {
      onArray(entry);
      return;
    }

    for (const child of PathIndex.#children(entry)) {
      this.reconcile(child.id, onField, onArray);
    }
  }

  /** Rebuilds the public path of an entry. */
  describe(id: EntryId): string {
    const segments: string[] = [];

    let current: PathIndexEntry = this.entry(id);

    while (current.parent) {
      const parent: PathIndexStructuralEntry = current.parent;

      if (parent.kind === PathKind.Array) {
        const position = parent.children.indexOf(current);

        if (position < 0) {
          throw new UnknownEntryId(current.id);
        }

        segments.push(String(position));
      } else {
        if (current.segment === null) {
          throw new UnknownEntryId(current.id);
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
          throw new NotAnArrayEntry(current.id);
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

  /**
   * A location is a field when nothing was known to live inside it. Registering
   * below it is newer and more specific information, so it stops being terminal.
   *
   * It is opened in place rather than replaced because routes hold it by
   * reference, which is why this is the one place that goes around the union.
   */
  #open(field: PathIndexFieldEntry, inner: string): PathIndexStructuralEntry {
    const opened = field as unknown as OpenedEntry;

    if (PathIndex.#infer(inner) === PathKind.Array) {
      opened.kind = PathKind.Array;
      opened.children = [];
    } else {
      opened.kind = PathKind.Object;
      opened.children = new Map();
    }

    return opened;
  }

  /**
   * The kind is only held against an entry being claimed, never against one
   * merely on the way: a field standing in the middle is opened, not refused.
   */
  #ensureChild(
    parent: PathIndexRootEntry | PathIndexObjectEntry,
    segment: string,
    kind: RegisterableKind,
    path: string,
    claimed: boolean,
  ): PathIndexChildEntry {
    const existing = parent.children.get(segment);

    if (existing) {
      if (claimed) {
        this.#assertKind(existing, path, kind);
      }

      return existing;
    }

    const child = this.#create(parent, segment, kind);

    parent.children.set(segment, child);

    return child;
  }

  /**
   * Registration is independent of the value, so a path may claim any position
   * without the ones before it being in use. An ordered list cannot hold gaps,
   * so those become real entries rather than JavaScript holes.
   */
  #ensureItem(
    array: PathIndexArrayEntry,
    index: number,
    kind: RegisterableKind,
    path: string,
    claimed: boolean,
  ): PathIndexChildEntry {
    const { children } = array;

    if (index < children.length) {
      const existing = children[index];

      if (claimed) {
        this.#assertKind(existing, path, kind);
      }

      return existing;
    }

    while (children.length <= index) {
      children.push(this.#create(array, null, kind));
    }

    return children[index];
  }

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
      throw new NotAnArrayEntry(id);
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
