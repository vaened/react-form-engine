/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { EntryId } from "../path/types";
import type { FieldState } from "./FieldState";
import type { StateAggregate } from "./StateAggregate";

export enum StateKind {
  Field = 1,
  Node = 2,
}

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
  readonly kind: StateKind.Field;
  readonly state: FieldState;
};

/**
 * A materialized node owns no state of its own: its flags are derived from
 * counters of how many reactive children carry each one.
 */
export type StateNodeEntry = StateBase & {
  readonly kind: StateKind.Node;
  readonly state: StateAggregate;
};

export type StateEntry = StateFieldEntry | StateNodeEntry;

/** What a field is given to start from, or to be told after a write. */
export type FieldStateInput = {
  readonly flags?: number;
  readonly errors?: readonly unknown[];
};
