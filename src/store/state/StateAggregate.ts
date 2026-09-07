/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { hasFlag, StateFlag, setFlag } from "./StateFlag";
import type { PathState } from "./types";

/**
 * What a materialized node is: how many of the children reporting to it carry
 * each flag, and the flags that follow from those counts.
 *
 * One belongs to a single node and to nobody else, which is what makes it safe
 * to mutate in place: an ancestor is told by comparing the flags before and
 * after, never the counters themselves.
 */
export class StateAggregate implements PathState {
  #flags = 0;
  #dirty = 0;
  #touched = 0;
  #invalid = 0;
  #validating = 0;

  /**
   * The four counts packed into the one number the chain travels on: an
   * ancestor is told by comparing this before and against after, and folds the
   * same pair into its own counts.
   *
   * It is remembered rather than packed again on every read, which the chain
   * does twice per level. Nothing outside can write it, and the counters move
   * only through `fold` and `add`, each of which packs this before returning.
   */
  get flags(): number {
    return this.#flags;
  }

  get dirty(): number {
    return this.#dirty;
  }

  get touched(): number {
    return this.#touched;
  }

  get invalid(): number {
    return this.#invalid;
  }

  get validating(): number {
    return this.#validating;
  }

  get isDirty(): boolean {
    return this.#dirty > 0;
  }

  get isTouched(): boolean {
    return this.#touched > 0;
  }

  get isInvalid(): boolean {
    return this.#invalid > 0;
  }

  get isValidating(): boolean {
    return this.#validating > 0;
  }

  /** Folds one child's change in, without reading the other children. */
  fold(previous: number, current: number): void {
    this.#dirty += StateAggregate.#delta(previous, current, StateFlag.Dirty);
    this.#touched += StateAggregate.#delta(previous, current, StateFlag.Touched);
    this.#invalid += StateAggregate.#delta(previous, current, StateFlag.Invalid);
    this.#validating += StateAggregate.#delta(previous, current, StateFlag.Validating);

    this.#derive();
  }

  /** Counts one contributor in. Used when a node is materialized from scratch. */
  add(flags: number): void {
    this.#dirty += hasFlag(flags, StateFlag.Dirty) ? 1 : 0;
    this.#touched += hasFlag(flags, StateFlag.Touched) ? 1 : 0;
    this.#invalid += hasFlag(flags, StateFlag.Invalid) ? 1 : 0;
    this.#validating += hasFlag(flags, StateFlag.Validating) ? 1 : 0;

    this.#derive();
  }

  /** True when a counter fell below zero, which means a delta was lost. */
  isUnderflowed(): boolean {
    return this.#dirty < 0 || this.#touched < 0 || this.#invalid < 0 || this.#validating < 0;
  }

  /** A flag is set while any child carries it. */
  #derive(): void {
    let flags = 0;

    flags = setFlag(flags, StateFlag.Dirty, this.#dirty > 0);
    flags = setFlag(flags, StateFlag.Touched, this.#touched > 0);
    flags = setFlag(flags, StateFlag.Invalid, this.#invalid > 0);
    flags = setFlag(flags, StateFlag.Validating, this.#validating > 0);

    this.#flags = flags;
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
