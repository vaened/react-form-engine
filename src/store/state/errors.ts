/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { StateKind } from "./types";

export class UnknownStateEntry extends Error {
  constructor(id: number) {
    super(`No state is materialized for entry "${id}".`);
    this.name = "UnknownStateEntry";
  }
}

export class StateKindConflict extends Error {
  constructor(id: number, current: StateKind, expected: StateKind) {
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

export class RootStateRequired extends Error {
  constructor() {
    super("The root state cannot be dematerialized.");
    this.name = "RootStateRequired";
  }
}

/** A parent that is no longer materialized would take its subtree out of the chain. */
export class DetachedStateParent extends Error {
  constructor(id: number) {
    super(`Entry "${id}" is no longer materialized and cannot be given children.`);
    this.name = "DetachedStateParent";
  }
}

/**
 * Taking a child away from a parent it never reported to would discount flags
 * that parent never counted, leaving the form claiming less than it holds.
 */
export class UnexpectedStateParent extends Error {
  constructor(id: number) {
    super(`Entry "${id}" does not currently report to the given parent.`);
    this.name = "UnexpectedStateParent";
  }
}

/** Taking the same child over twice would discount its weight twice. */
export class DuplicatedStateChild extends Error {
  constructor(id: number) {
    super(`Entry "${id}" appears more than once among the children being taken over.`);
    this.name = "DuplicatedStateChild";
  }
}
