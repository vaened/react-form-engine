/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { EventEmitter, type Unsubscribe } from "../../EventEmitter";
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
  type ObservableStructure,
  type PathDescendants,
  type PathIndexArrayEntry,
  type PathIndexChildEntry,
  type PathIndexEntry,
  type PathIndexFieldEntry,
  type PathIndexObjectEntry,
  type PathIndexRootEntry,
  type PathIndexStructuralEntry,
  PathKind,
  type PathStep,
  type RegisterableKind,
  type Route,
  type RouteStep,
  type Split,
  type StructureEvents,
  type WalkOf,
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
export class PathIndex<TValues extends FormValues = FormValues> implements EntryTree, ObservableStructure {
  readonly #paths: PathIdentifier<FormPath<TValues>>;
  readonly #root: PathIndexRootEntry;
  readonly #entries = new Map<EntryId, PathIndexEntry>();
  readonly #routes = new Map<PathId<FormPath<TValues>>, Route>();
  readonly #events = new EventEmitter<StructureEvents>();

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

  on<TType extends keyof StructureEvents>(
    type: TType,
    handler: (payload: StructureEvents[TType]) => void,
  ): Unsubscribe {
    return this.#events.on(type, handler);
  }

  root(): PathIndexRootEntry {
    return this.#root;
  }

  /**
   * Ensures the whole branch of `path` exists and remembers how to reach it.
   *
   * `walk` is the same path with whatever the value holds at each of its
   * segments, which is what keeps an intermediate from being guessed at. It is
   * typed against `path`, so one describing a different one does not compile.
   *
   * `kind` is what a location is created as, never what an existing one is held
   * against: reaching a location is not the same as claiming it.
   */
  ensure<TPath extends FormPath<TValues>>(
    path: TPath,
    kind: RegisterableKind,
    walk?: WalkOf<TPath>,
  ): PathIndexChildEntry {
    const pathId = this.#paths.register(path);
    const known = this.#routes.get(pathId);
    const reachable = known && this.#reachable(known);

    if (reachable) {
      // A registered path always has at least one segment, so it never lands on root.
      return reachable as PathIndexChildEntry;
    }

    // Either the path is new, or its route outlived the entries it used to
    // reach. Routes survive structural operations on purpose, so registering
    // again has to rebuild the branch instead of trusting the old one.
    const walked: readonly PathStep[] = walk ?? PathIndex.#unobserved(this.segmentsOf(path));
    const steps: RouteStep[] = [];

    let current: PathIndexEntry = this.#root;
    let anchor: PathIndexEntry = this.#root;
    let leaf: PathIndexChildEntry | null = null;

    for (let index = 0; index < walked.length; index++) {
      const { segment } = walked[index];
      const last = index === walked.length - 1;
      const childKind = last ? kind : PathIndex.#holder(walked[index], walked[index + 1].segment);

      // Only reached below the root, which is never a field, so there is always
      // a step before this one to say what the location it reopens has to be.
      const holder =
        current.kind === PathKind.Field ? this.#open(current, PathIndex.#holder(walked[index - 1], segment)) : current;

      let child: PathIndexChildEntry;

      if (holder.kind === PathKind.Array) {
        const position = PathIndex.#toIndex(segment);

        if (position === undefined) {
          throw new InvalidArrayIndex(path, segment);
        }

        child = this.#ensureItem(holder, position, childKind);
        steps.push({ at: position });
      } else {
        child = this.ensureChild(holder, segment, childKind);

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

  register(path: FormPath<TValues>, kind: RegisterableKind): PathIndexChildEntry {
    const entry = this.ensure(path, kind);

    this.#assertKind(entry, path, kind);

    return entry;
  }

  /**
   * One entry under a parent already in hand, for a caller descending a value
   * rather than following a path.
   *
   * It is what `ensure` steps with, not a smaller version of it: no path is
   * named here, so nothing is identified and no route is remembered. Reaching
   * this location again by its path still has to go through `ensure`.
   */
  ensureChild(
    parent: PathIndexRootEntry | PathIndexObjectEntry,
    segment: string,
    kind: RegisterableKind,
  ): PathIndexChildEntry {
    PathIndex.#assertValidSegment(segment);

    const existing = parent.children.get(segment);

    if (existing) {
      return existing;
    }

    const child = this.#create(parent, segment, kind);

    parent.children.set(segment, child);
    this.#recomposed(parent);

    return child;
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

    if (pathId === undefined) {
      return undefined;
    }

    const route = this.#routes.get(pathId);

    return route && this.#reachable(route);
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

  /**
   * Where an entry sits in the array holding it.
   *
   * `children` is the order, so it goes from a position to an entry directly
   * and the other way only by looking. What was found last is kept, and trusted
   * again only while that position still holds that same entry, so no array
   * operation has to remember to discard it.
   */
  positionOf(id: EntryId): number {
    const entry = this.entry(id);
    const array = entry.parent;

    if (!array || array.kind !== PathKind.Array) {
      throw new NotAnArrayEntry(entry.parent?.id ?? id);
    }

    return PathIndex.#positionIn(array, entry);
  }

  /**
   * The entries a location is composed of, in the order it holds them.
   *
   * Identities travel, never the entries: what a caller keeps cannot be
   * something the index is still writing into.
   *
   * The same question has the same answer while the location goes on being
   * composed of the same entries, so what comes back is the very thing that
   * came back before rather than something equal to it.
   *
   * A location that does not exist is composed of nothing, which is not the
   * same as one that exists and holds none.
   */
  composedOf(id: EntryId): readonly EntryId[] | undefined {
    const entry = this.#entries.get(id);

    if (!entry || entry.kind === PathKind.Field) {
      return undefined;
    }

    entry.composition ??= PathIndex.#idsOf(entry);

    return entry.composition;
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
   * Walks down from `id`, stopping the instant a field answers for itself and
   * descending through anything else, on the assumption that a name still
   * reaches the location it always reached.
   *
   * An array is told before the walk goes on, because how many positions it
   * has is the value's to decide and the ones that outlive the value have to
   * be gone before anything looks for them.
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
        segments.push(String(PathIndex.#positionIn(parent, current)));
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
   *
   * The one position past the end is where an insert appends.
   */
  insert(arrayId: EntryId, index: number, kind: RegisterableKind): PathIndexChildEntry {
    const array = this.#array(arrayId);

    PathIndex.#assertPosition(array, index, array.children.length);

    const item = this.#create(array, null, kind);

    array.children.splice(index, 0, item);
    this.#recomposed(array);

    return item;
  }

  append(arrayId: EntryId, kind: RegisterableKind): PathIndexChildEntry {
    return this.insert(arrayId, this.#array(arrayId).children.length, kind);
  }

  /**
   * Another item takes the place of the one at this position.
   *
   * Taking it out and putting one back shifts every position after it twice and
   * says two things happened; one item becoming another is one thing, and the
   * order around it never moved.
   */
  replace(arrayId: EntryId, index: number, kind: RegisterableKind): PathIndexChildEntry {
    const array = this.#array(arrayId);

    PathIndex.#assertPosition(array, index);

    const item = this.#create(array, null, kind);
    const gone: PathIndexEntry[] = [];

    this.#forget(array.children[index], gone);

    array.children[index] = item;

    this.#recomposed(array);
    this.#events.emit("discarded", gone);

    return item;
  }

  remove(arrayId: EntryId, index: number): void {
    const array = this.#array(arrayId);

    PathIndex.#assertPosition(array, index);

    const [removed] = array.children.splice(index, 1);
    const gone: PathIndexEntry[] = [];

    this.#forget(removed, gone);
    this.#recomposed(array);

    this.#events.emit("discarded", gone);
  }

  /**
   * Drops every position from `length` onward in one operation.
   *
   * Taking the items out one at a time shifts the order on every step and says
   * what went once per item; losing a tail is one thing that happens, so it
   * walks what is inside once and says it once.
   */
  truncate(arrayId: EntryId, length: number): void {
    const array = this.#array(arrayId);

    if (length >= array.children.length) {
      return;
    }

    PathIndex.#assertPosition(array, length, array.children.length);

    const gone: PathIndexEntry[] = [];

    for (let position = length; position < array.children.length; position++) {
      this.#forget(array.children[position], gone);
    }

    array.children.length = length;
    this.#recomposed(array);

    this.#events.emit("discarded", gone);
  }

  clear(arrayId: EntryId): void {
    this.truncate(arrayId, 0);
  }

  move(arrayId: EntryId, from: number, to: number): void {
    const array = this.#array(arrayId);

    PathIndex.#assertPosition(array, from);
    PathIndex.#assertPosition(array, to);

    const [item] = array.children.splice(from, 1);

    array.children.splice(to, 0, item);
    this.#recomposed(array);
  }

  swap(arrayId: EntryId, left: number, right: number): void {
    const array = this.#array(arrayId);

    PathIndex.#assertPosition(array, left);
    PathIndex.#assertPosition(array, right);

    const { children } = array;

    [children[left], children[right]] = [children[right], children[left]];
    this.#recomposed(array);
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
  #open(field: PathIndexFieldEntry, kind: PathKind.Object | PathKind.Array): PathIndexStructuralEntry {
    const opened = field as unknown as OpenedEntry;

    if (kind === PathKind.Array) {
      opened.kind = PathKind.Array;
      opened.children = [];
    } else {
      opened.kind = PathKind.Object;
      opened.children = new Map();
    }

    this.#events.emit("reopened", opened.id);

    return opened;
  }

  /**
   * Registration is independent of the value, so a path may claim any position
   * without the ones before it being in use. An ordered list cannot hold gaps,
   * so those become real entries rather than JavaScript holes.
   */
  #ensureItem(array: PathIndexArrayEntry, index: number, kind: RegisterableKind): PathIndexChildEntry {
    const { children } = array;

    if (index < children.length) {
      return children[index];
    }

    while (children.length <= index) {
      children.push(this.#create(array, null, kind));
      this.#recomposed(array);
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

  #forget(entry: PathIndexEntry, gone: PathIndexEntry[]): void {
    this.#entries.delete(entry.id);
    gone.push(entry);

    for (const child of PathIndex.#children(entry)) {
      this.#forget(child, gone);
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

  /**
   * A location is composed of other entries than the ones it answered for.
   *
   * What it is composed of now is worked out here rather than left for whoever
   * asks, because whoever operates on a location is the same one waiting to
   * hear how it ended up, and would ask for it the moment this returns.
   */
  #recomposed(entry: PathIndexStructuralEntry): void {
    entry.composition = PathIndex.#idsOf(entry);

    this.#events.emit("recomposed", { id: entry.id, composition: entry.composition });
  }

  static #idsOf(entry: PathIndexStructuralEntry): readonly EntryId[] {
    const ids: EntryId[] = [];

    for (const child of PathIndex.#children(entry)) {
      ids.push(child.id);
    }

    return ids;
  }

  /**
   * `children` is the order, so it goes from a position to an entry directly
   * and the other way only by looking. What was found last is kept, and trusted
   * again only while that position still holds that same entry, so no array
   * operation has to remember to discard it.
   */
  static #positionIn(array: PathIndexArrayEntry, entry: PathIndexEntry): number {
    const remembered = array.positions?.get(entry.id);

    if (remembered !== undefined && array.children[remembered] === entry) {
      return remembered;
    }

    const positions = new Map<EntryId, number>();

    for (let position = 0; position < array.children.length; position++) {
      positions.set(array.children[position].id, position);
    }

    array.positions = positions;

    const position = positions.get(entry.id);

    if (position === undefined) {
      throw new UnknownEntryId(entry.id);
    }

    return position;
  }

  static #children(entry: PathIndexEntry): Iterable<PathIndexChildEntry> {
    if (entry.kind === PathKind.Field) {
      return [];
    }

    return entry.kind === PathKind.Array ? entry.children : entry.children.values();
  }

  /**
   * A position is a place in the order, so anything that is not a whole number
   * has none: `NaN` compares false against every bound and would reach `splice`
   * as a zero, and a fraction sits between two positions rather than on one.
   */
  static #assertPosition(array: PathIndexArrayEntry, index: number, limit = array.children.length - 1): void {
    if (!Number.isInteger(index) || index < 0 || index > limit) {
      throw new MissingArrayPosition(index, array.children.length);
    }
  }

  /**
   * `__proto__` is refused because writing it does not name a property: it
   * replaces the prototype of the object holding it, and a path is allowed to
   * reach values, never the shape of the objects carrying them.
   */
  static #assertValidSegment(segment: string): void {
    if (!segment || segment.trim() !== segment || segment.includes(".") || segment === "__proto__") {
      throw new InvalidPathSegment(segment);
    }
  }

  /**
   * The segments of a path, none of which can still be refused.
   *
   * Walking a path opens whatever it passes through, so a segment refused
   * halfway would leave behind a branch reshaped for a registration that never
   * happened. Neither check needs to know what a segment lands on, so both are
   * answered here, before there is anything to undo.
   */
  segmentsOf<TPath extends FormPath<TValues>>(path: TPath): Split<TPath> {
    const segments = path.split(".");

    for (const segment of segments) {
      PathIndex.#assertValidSegment(segment);

      if (INDEX_SEGMENT.test(segment) && PathIndex.#toIndex(segment) === undefined) {
        throw new InvalidArrayIndex(path, segment);
      }
    }

    // Splitting a string is where a path stops being one and becomes text, so
    // the compiler cannot follow the segments back to the path they spell.
    return segments as Split<TPath>;
  }

  /**
   * The position a segment names, or nothing when it names none.
   *
   * Refusing is left to whoever asked, because only they know the path the
   * segment came from and the error has to say it.
   */
  static #toIndex(segment: string): number | undefined {
    if (!INDEX_SEGMENT.test(segment)) {
      return undefined;
    }

    const index = Number(segment);

    // Registering a position fills every position before it, so an index that
    // cannot be represented exactly would fill forever.
    return Number.isSafeInteger(index) ? index : undefined;
  }

  /**
   * What a location holding others has to be.
   *
   * A value that was found there says it outright. A field found there says
   * nothing usable, since the path reaches inside it and a field holds nobody,
   * so the reading falls back with the same answer as if nothing were there.
   */
  static #holder(step: PathStep, inner: string): PathKind.Array | PathKind.Object {
    return step.observed === PathKind.Array || step.observed === PathKind.Object
      ? step.observed
      : PathIndex.#infer(inner);
  }

  /**
   * A path string on its own can only guess, and treats an intermediate as an
   * array when what follows it is numeric. An object whose keys are digits is
   * misread here, which is why it is the last resort rather than the first.
   */
  static #infer(next: string): PathKind.Array | PathKind.Object {
    return INDEX_SEGMENT.test(next) ? PathKind.Array : PathKind.Object;
  }

  static #unobserved(segments: readonly string[]): PathStep[] {
    return segments.map((segment) => ({ segment }));
  }
}
