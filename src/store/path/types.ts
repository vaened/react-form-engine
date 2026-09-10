/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { Unsubscribe } from "../../EventEmitter";

declare const entryIdBrand: unique symbol;

/**
 * Structural identity of a location inside the form.
 *
 * Minted when the location is created and never reused, so anything keyed by it
 * (state, errors, subscriptions, value references) survives array reordering.
 * It is deliberately unrelated to `PathId`, which identifies a public path
 * string and therefore changes meaning when items move.
 */
export type EntryId = number & { readonly [entryIdBrand]: "EntryId" };

export enum PathKind {
  Root = 1,
  Object = 2,
  Array = 3,
  Field = 4,
}

type EntryBase = {
  readonly id: EntryId;
  /** `null` when the parent names this entry by position instead of by key. */
  readonly segment: string | null;
};

export type PathIndexRootEntry = EntryBase & {
  readonly kind: PathKind.Root;
  readonly parent: null;
  readonly children: Map<string, PathIndexChildEntry>;
  composition?: readonly EntryId[] | undefined;
};

export type PathIndexObjectEntry = EntryBase & {
  readonly kind: PathKind.Object;
  readonly parent: PathIndexStructuralEntry;
  readonly children: Map<string, PathIndexChildEntry>;
  composition?: readonly EntryId[] | undefined;
};

/** `children` is the order. Position lives here and nowhere else. */
export type PathIndexArrayEntry = EntryBase & {
  readonly kind: PathKind.Array;
  readonly parent: PathIndexStructuralEntry;
  readonly children: PathIndexChildEntry[];
  positions?: Map<EntryId, number>;
  composition?: readonly EntryId[] | undefined;
};

export type PathIndexFieldEntry = EntryBase & {
  readonly kind: PathKind.Field;
  readonly parent: PathIndexStructuralEntry;
};

export type PathIndexStructuralEntry = PathIndexRootEntry | PathIndexObjectEntry | PathIndexArrayEntry;

export type PathIndexChildEntry = PathIndexObjectEntry | PathIndexArrayEntry | PathIndexFieldEntry;

export type PathIndexEntry = PathIndexRootEntry | PathIndexChildEntry;

/** Kind a caller may ask `register` for. Root is owned by the index. */
export type RegisterableKind = PathKind.Object | PathKind.Array | PathKind.Field;

/**
 * A segment of a path, and what was found living at it.
 *
 * `observed` is absent where nothing lives yet, which is the only case left for
 * the path string to decide on its own.
 */
export type PathStep<TSegment extends string = string> = {
  readonly segment: TSegment;
  readonly observed?: RegisterableKind;
};

/** A path taken apart, each segment kept as the literal it is. */
export type Split<TPath extends string> = TPath extends `${infer THead}.${infer TRest}`
  ? [THead, ...Split<TRest>]
  : [TPath];

export type StepsOf<TSegments extends readonly string[]> = {
  readonly [TKey in keyof TSegments]: PathStep<TSegments[TKey] & string>;
};

/**
 * A walk over a path: its segments in order, each with whatever the value
 * holds there.
 *
 * The segments are the path's own, so a walk cannot describe one path while
 * being handed in alongside another. That is checked rather than trusted,
 * which is why the walk is typed against the path instead of being a list of
 * strings that happens to look right.
 */
export type WalkOf<TPath extends string> = StepsOf<Split<TPath>>;

/** Take `children[at]` of the current array entry. */
export type PositionalStep = { readonly at: number };

/** Take `children.get(key)` of the current object entry. */
export type KeyedStep = { readonly key: string };

export type RouteStep = PositionalStep | KeyedStep;

/**
 * How a public path reaches its entry.
 *
 * `anchor` is the deepest entry reachable using only property names. Property
 * names never move, so it is resolved once during `register` and stays valid
 * forever. `steps` is everything after the first positional segment, replayed
 * on each resolution against the live structure.
 *
 * The route stores the question ("position 0 of this array"), never the answer
 * ("this entry"). That is why array operations do not invalidate it.
 */
export type Route = {
  readonly anchor: PathIndexEntry;
  readonly steps: readonly RouteStep[];
};

export type PathDescendants = {
  readonly nodes: readonly (PathIndexObjectEntry | PathIndexArrayEntry)[];
  readonly fields: readonly PathIndexFieldEntry[];
};

/**
 * What is inside what, read only, keyed by identity.
 *
 * Whatever needs the shape of a form depends on this rather than on `PathIndex`
 * itself. Nothing here registers a path or moves an item, so a reader cannot
 * turn into a writer, and nothing carries the value type or a path string.
 */
export interface EntryTree {
  root(): PathIndexRootEntry;
  entry(id: EntryId): PathIndexEntry;
  /** One step up, or `null` at the root. */
  parentOf(id: EntryId): PathIndexStructuralEntry | null;
  /** One level down. On an array, this is the item order. */
  childrenOf(id: EntryId): PathIndexChildEntry[];
  /** Where an entry sits in the array holding it. Refuses anything else. */
  positionOf(id: EntryId): number;
  /** Every step up, nearest first. Never a field: only a node holds children. */
  ancestorsOf(id: EntryId): PathIndexStructuralEntry[];
  /** Every level down, flattened and split by kind. */
  descendantsOf(id: EntryId): PathDescendants;
}

/**
 * How the shape of a location may change under whoever kept something on it.
 *
 * Only structure travels here. What each listener keeps about a location is its
 * own, and so is deciding whether anything of it still applies.
 */
export type StructureEvents = {
  /**
   * A location is composed of other entries than the ones it answered for: one
   * appeared, one left, or the order they sit in is another.
   *
   * What it is composed of now travels with it, and it is the very thing
   * `composedOf` gives back, so nobody ends up holding two answers to the same
   * question with no way to tell them apart.
   */
  recomposed: { readonly id: EntryId; readonly composition: readonly EntryId[] };
  /** A location that answered for itself now holds others that answer for it. */
  reopened: EntryId;
  /**
   * Locations that stop existing, handed over whole rather than by id: they are
   * about to leave the index, so afterwards there is nothing left to ask.
   */
  discarded: readonly PathIndexEntry[];
};

/**
 * Where a listener says it depends on the shape, rather than on being handed
 * it. Whoever keeps something keyed by a location has to be here, or it keeps
 * describing a location that stopped being what it was.
 */
export interface ObservableStructure {
  on<TType extends keyof StructureEvents>(type: TType, handler: (payload: StructureEvents[TType]) => void): Unsubscribe;
}
