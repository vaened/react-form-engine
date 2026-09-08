/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

export { ArrayStateAggregate } from "./ArrayStateAggregate";
export { StateAggregateUnderflow, StateKindConflict } from "./errors";
export { FieldState } from "./FieldState";
export { type PathId, type PathIdentifier, PathRegistry } from "./PathRegistry";
export { StateAggregate } from "./StateAggregate";
export { StateAssessor } from "./StateAssessor";
export { hasFlag, StateFlag, setFlag } from "./StateFlag";
export { StateGraph } from "./StateGraph";
export type {
  PathState,
  StateArrayEntry,
  StateEntry,
  StateFieldEntry,
  StateNodeEntry,
  StateObjectEntry,
} from "./types";
export { StateKind } from "./types";
