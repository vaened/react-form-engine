/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { Notifiable } from "../observation/ObservationChain";
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

/**
 * How a field stands, as one answer.
 *
 * It is one answer and not several because whoever asks compares what came
 * back against what it read last. The errors travel with the flags for the
 * same reason: a verdict that held while what it has to show changed is a
 * move, and nothing about the flags says so.
 */
export interface FieldPathState extends PathState {
  /** What a validation found, kept as the very collection it landed with. */
  readonly errors: readonly unknown[];
}

/**
 * How a node stands, which is everything its reactive children report and
 * nothing of its own.
 *
 * It carries no errors, and that is the whole of why it is its own answer: a
 * node derives how many of its children carry a flag, and there is no such
 * thing as deriving what they say. Handing over an empty collection would read
 * as a location that was validated and found nothing, which is a different
 * thing from one that cannot be validated at all.
 */
export type NodePathState = PathState;

export const STALE = Symbol("stale");

interface StateBase extends Notifiable {
  readonly id: EntryId;
  snapshot: FieldPathState | NodePathState | typeof STALE;
  /**
   * The nearest materialized ancestor, or `null` on the root.
   *
   * This is a reactive edge, not a structural one: unobserved nodes are not
   * part of the chain at all, so a field can point straight at the root even
   * when five structural levels sit in between.
   */
  parent: StateNodeEntry | null;
}

/** A registered field owns its state outright. */
export interface StateFieldEntry extends StateBase {
  readonly kind: PathKind.Field;
  readonly state: FieldState;
}

/** Always materialized, so a form can always answer for itself as a whole. */
export interface StateRootEntry extends StateBase {
  readonly kind: PathKind.Root;
  readonly state: StateAggregate;
}

/**
 * A materialized object owns no state of its own: its flags are derived from
 * counters of how many reactive children carry each one.
 */
export interface StateObjectEntry extends StateBase {
  readonly kind: PathKind.Object;
  readonly state: StateAggregate;
}

/** The one location that also answers for something no child of it can. */
export interface StateArrayEntry extends StateBase {
  readonly kind: PathKind.Array;
  readonly state: ArrayStateAggregate;
}

export type StateNodeEntry = StateRootEntry | StateObjectEntry | StateArrayEntry;

export type StateEntry = StateFieldEntry | StateNodeEntry;
