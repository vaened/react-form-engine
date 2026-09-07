/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

export { StateAggregateUnderflow, StateKindConflict } from "./errors";
export { FieldState } from "./FieldState";
export { type PathId, type PathIdentifier, PathRegistry } from "./PathRegistry";
export { StateAggregate } from "./StateAggregate";
export { StateAssessor } from "./StateAssessor";
export { hasFlag, StateFlag, setFlag } from "./StateFlag";
export { StateGraph } from "./StateGraph";
export type { PathState, StateEntry, StateFieldEntry, StateNodeEntry } from "./types";
export { StateKind } from "./types";
