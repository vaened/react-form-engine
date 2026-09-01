/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

export {
  InvalidArrayIndex,
  InvalidPathSegment,
  MissingArrayPosition,
  NotAnArrayEntry,
  PathKindConflict,
  UnknownChildPath,
  UnknownEntryId,
  UnknownPathId,
} from "./errors";
export { PathIndex } from "./PathIndex";
export type {
  EntryId,
  KeyedStep,
  PathDescendants,
  PathIndexArrayEntry,
  PathIndexChildEntry,
  PathIndexEntry,
  PathIndexFieldEntry,
  PathIndexObjectEntry,
  PathIndexRootEntry,
  PathIndexStructuralEntry,
  PositionalStep,
  RegisterableKind,
  Route,
  RouteStep,
} from "./types";
export { PathKind } from "./types";
