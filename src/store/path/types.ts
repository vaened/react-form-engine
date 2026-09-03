/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

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
};

export type PathIndexObjectEntry = EntryBase & {
  readonly kind: PathKind.Object;
  readonly parent: PathIndexStructuralEntry;
  readonly children: Map<string, PathIndexChildEntry>;
};

/** `children` is the order. Position lives here and nowhere else. */
export type PathIndexArrayEntry = EntryBase & {
  readonly kind: PathKind.Array;
  readonly parent: PathIndexStructuralEntry;
  readonly children: PathIndexChildEntry[];
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
  /** Every step up, nearest first. Never a field: only a node holds children. */
  ancestorsOf(id: EntryId): PathIndexStructuralEntry[];
  /** Every level down, flattened and split by kind. */
  descendantsOf(id: EntryId): PathDescendants;
}
