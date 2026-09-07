/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { hasFlag, StateFlag } from "./StateFlag";
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
}
