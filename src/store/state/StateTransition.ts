/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

export enum StateFlag {
  Dirty = 1 << 0,
  Touched = 1 << 1,
  Invalid = 1 << 2,
  Validating = 1 << 3,
}

/** How many reactive children carry each flag. */
export type StateAggregate = {
  dirty: number;
  touched: number;
  invalid: number;
  validating: number;
};

/**
 * Flag and aggregate arithmetic.
 *
 * Pure numbers: it knows nothing about paths, entries, structure or identity,
 * which is why it survives any change to how the form is indexed.
 *
 * The suffix is not decoration. `hasFlag` and `setFlag` work on a bitmask; the
 * rest work on an aggregate. Two subjects, told apart by the name.
 */
export class StateTransition {
  /**
   * Folds a child's change into the counters, without reading the other
   * children. This is what keeps a node's state incremental.
   */
  apply(aggregate: StateAggregate, previous: number, current: number): StateAggregate {
    return {
      dirty: aggregate.dirty + this.#delta(previous, current, StateFlag.Dirty),
      invalid: aggregate.invalid + this.#delta(previous, current, StateFlag.Invalid),
      touched: aggregate.touched + this.#delta(previous, current, StateFlag.Touched),
      validating: aggregate.validating + this.#delta(previous, current, StateFlag.Validating),
    };
  }

  /** Counts one contributor in. Used when a node is materialized from scratch. */
  add(aggregate: StateAggregate, flags: number): StateAggregate {
    return {
      dirty: aggregate.dirty + (this.hasFlag(flags, StateFlag.Dirty) ? 1 : 0),
      invalid: aggregate.invalid + (this.hasFlag(flags, StateFlag.Invalid) ? 1 : 0),
      touched: aggregate.touched + (this.hasFlag(flags, StateFlag.Touched) ? 1 : 0),
      validating: aggregate.validating + (this.hasFlag(flags, StateFlag.Validating) ? 1 : 0),
    };
  }

  /** The public flags of a node: a flag is set while any child carries it. */
  derive(aggregate: StateAggregate): number {
    let flags = 0;

    flags = this.setFlag(flags, StateFlag.Dirty, aggregate.dirty > 0);
    flags = this.setFlag(flags, StateFlag.Touched, aggregate.touched > 0);
    flags = this.setFlag(flags, StateFlag.Invalid, aggregate.invalid > 0);
    flags = this.setFlag(flags, StateFlag.Validating, aggregate.validating > 0);

    return flags;
  }

  empty(): StateAggregate {
    return {
      dirty: 0,
      invalid: 0,
      touched: 0,
      validating: 0,
    };
  }

  /** True when a counter went below zero, which means a delta was lost. */
  isUnderflowed(aggregate: StateAggregate): boolean {
    return aggregate.dirty < 0 || aggregate.touched < 0 || aggregate.invalid < 0 || aggregate.validating < 0;
  }

  hasFlag(flags: number, flag: StateFlag): boolean {
    return (flags & flag) === flag;
  }

  setFlag(flags: number, flag: StateFlag, value: boolean): number {
    return value ? flags | flag : flags & ~flag;
  }

  #delta(previous: number, current: number, flag: StateFlag): number {
    const wasSet = this.hasFlag(previous, flag);
    const isSet = this.hasFlag(current, flag);

    if (wasSet === isSet) {
      return 0;
    }

    return isSet ? 1 : -1;
  }
}
