/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { EntryId, PathKind } from "../path/types";
import type { ArrayStateAggregate } from "./ArrayStateAggregate";
import type { FieldState } from "./FieldState";
import type { StateAggregate } from "./StateAggregate";

/**
 * What can be asked of a location, whichever kind of state answers for it.
 *
 * A field reads a flag it was told; a node reads how many of the children
 * reporting to it carry that flag. The question is the same and the answer
 * means the same, so nothing outside has to know which one it is holding.
 */
export interface PathState {
  readonly isDirty: boolean;
  readonly isTouched: boolean;
  readonly isInvalid: boolean;
  readonly isValidating: boolean;
}

type StateBase = {
  readonly id: EntryId;
  /**
   * The nearest materialized ancestor, or `null` on the root.
   *
   * This is a reactive edge, not a structural one: unobserved nodes are not
   * part of the chain at all, so a field can point straight at the root even
   * when five structural levels sit in between.
   */
  parent: StateNodeEntry | null;
};

/** A registered field owns its state outright. */
export type StateFieldEntry = StateBase & {
  readonly kind: PathKind.Field;
  readonly state: FieldState;
};

/** Always materialized, so a form can always answer for itself as a whole. */
export type StateRootEntry = StateBase & {
  readonly kind: PathKind.Root;
  readonly state: StateAggregate;
};

/**
 * A materialized object owns no state of its own: its flags are derived from
 * counters of how many reactive children carry each one.
 */
export type StateObjectEntry = StateBase & {
  readonly kind: PathKind.Object;
  readonly state: StateAggregate;
};

/** The one location that also answers for something no child of it can. */
export type StateArrayEntry = StateBase & {
  readonly kind: PathKind.Array;
  readonly state: ArrayStateAggregate;
};

export type StateNodeEntry = StateRootEntry | StateObjectEntry | StateArrayEntry;

export type StateEntry = StateFieldEntry | StateNodeEntry;
