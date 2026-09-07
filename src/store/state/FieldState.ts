/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { hasFlag, StateFlag, setFlag } from "./StateFlag";
import type { PathState } from "./types";

/** Shared so that registering a form's worth of fields does not leave one empty array each. */
const NO_ERRORS: readonly unknown[] = Object.freeze([]);

/**
 * What a registered field is, as against what it was given to hold.
 *
 * A field is the only place state is born, and every flag on it answers to a
 * different owner: what the value implies, what a validation found, what the
 * user did. Each one lands through the member that names its owner, so no
 * answer can arrive carrying the others.
 */
export class FieldState implements PathState {
  flags: number;
  errors: readonly unknown[];

  constructor(flags = 0, errors: readonly unknown[] = NO_ERRORS) {
    this.flags = flags;
    this.errors = errors;
  }

  get isDirty(): boolean {
    return hasFlag(this.flags, StateFlag.Dirty);
  }

  get isTouched(): boolean {
    return hasFlag(this.flags, StateFlag.Touched);
  }

  get isInvalid(): boolean {
    return hasFlag(this.flags, StateFlag.Invalid);
  }

  get isValidating(): boolean {
    return hasFlag(this.flags, StateFlag.Validating);
  }

  /** What comparing the value against its base implies, and nothing else. */
  assessed(dirty: boolean): void {
    this.flags = setFlag(this.flags, StateFlag.Dirty, dirty);
  }

  /**
   * What a validation found. The verdict and what it was based on land
   * together, so a field is never left holding errors it does not call itself
   * invalid for, nor invalid with nothing to show for it.
   */
  validated(invalid: boolean, errors: readonly unknown[]): void {
    this.flags = setFlag(this.flags, StateFlag.Invalid, invalid);
    this.errors = errors;
  }

  /** The user has been here. Only a reset takes it back. */
  touch(): void {
    this.flags = setFlag(this.flags, StateFlag.Touched, true);
  }
}
