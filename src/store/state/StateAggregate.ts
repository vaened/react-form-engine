/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { hasFlag, StateFlag, setFlag } from "./StateFlag";

/**
 * How many reactive children of a node carry each flag.
 *
 * One of these belongs to each materialized node and to nobody else, which is
 * what makes it safe to keep in place instead of replacing it on every change:
 * the counters are nobody's but the node's, and the node reports upward by
 * comparing the number `derive` gives back, never the aggregate itself.
 *
 * Counting rather than storing a boolean is what lets a flag survive until the
 * last child lets go of it, and what lets a node tell an ancestor that nothing
 * changed even though one of its children just did.
 */
export class StateAggregate {
  dirty = 0;
  touched = 0;
  invalid = 0;
  validating = 0;

  /** Folds one child's change in, without reading the other children. */
  fold(previous: number, current: number): void {
    this.dirty += StateAggregate.#delta(previous, current, StateFlag.Dirty);
    this.touched += StateAggregate.#delta(previous, current, StateFlag.Touched);
    this.invalid += StateAggregate.#delta(previous, current, StateFlag.Invalid);
    this.validating += StateAggregate.#delta(previous, current, StateFlag.Validating);
  }

  /** Counts one contributor in. Used when a node is materialized from scratch. */
  add(flags: number): void {
    this.dirty += hasFlag(flags, StateFlag.Dirty) ? 1 : 0;
    this.touched += hasFlag(flags, StateFlag.Touched) ? 1 : 0;
    this.invalid += hasFlag(flags, StateFlag.Invalid) ? 1 : 0;
    this.validating += hasFlag(flags, StateFlag.Validating) ? 1 : 0;
  }

  /** The public flags of the node: a flag is set while any child carries it. */
  derive(): number {
    let flags = 0;

    flags = setFlag(flags, StateFlag.Dirty, this.dirty > 0);
    flags = setFlag(flags, StateFlag.Touched, this.touched > 0);
    flags = setFlag(flags, StateFlag.Invalid, this.invalid > 0);
    flags = setFlag(flags, StateFlag.Validating, this.validating > 0);

    return flags;
  }

  /** True when a counter fell below zero, which means a delta was lost. */
  isUnderflowed(): boolean {
    return this.dirty < 0 || this.touched < 0 || this.invalid < 0 || this.validating < 0;
  }

  static #delta(previous: number, current: number, flag: StateFlag): number {
    const wasSet = hasFlag(previous, flag);
    const isSet = hasFlag(current, flag);

    if (wasSet === isSet) {
      return 0;
    }

    return isSet ? 1 : -1;
  }
}
