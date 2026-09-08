/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { PathKind } from "../path/types";

export class StateKindConflict extends Error {
  constructor(id: number, current: PathKind, expected: PathKind) {
    super(`Entry "${id}" is materialized as "${current}", not "${expected}".`);
    this.name = "StateKindConflict";
  }
}

/**
 * A counter fell below zero, which can only happen if a delta was applied twice
 * or a contributor was removed without discounting it first.
 */
export class StateAggregateUnderflow extends Error {
  constructor(id: number) {
    super(`The state aggregate of entry "${id}" went below zero.`);
    this.name = "StateAggregateUnderflow";
  }
}
