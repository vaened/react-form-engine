/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { EntryId } from "../path/types";
import type { StateAggregate } from "./StateAggregate";

export enum StateKind {
  Field = 1,
  Node = 2,
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
  flags: number;
};

/** A registered field owns its state outright. */
export type StateFieldEntry = StateBase & {
  readonly kind: StateKind.Field;
  errors: readonly unknown[];
};

/**
 * A materialized node owns no state of its own: `flags` is derived from
 * `aggregate`, which counts how many reactive children carry each flag.
 */
export type StateNodeEntry = StateBase & {
  readonly kind: StateKind.Node;
  readonly aggregate: StateAggregate;
};

export type StateEntry = StateFieldEntry | StateNodeEntry;

export type FieldStateInput = {
  readonly flags?: number;
  readonly errors?: readonly unknown[];
};
