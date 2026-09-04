/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { PathValueClassifier } from "../value/PathValueClassifier";
import { StateFlag } from "./StateFlag";
import type { FieldStateInput } from "./types";

/** Shared so that a form's worth of clean fields does not allocate one each. */
const CLEAN: FieldStateInput = Object.freeze({});

/**
 * What a field's state should be, given its value.
 *
 * `register` and `set` both reach this same question — a field just got a
 * value, so what does that make its state — and answer it the same way,
 * whether the value is the one it was born with or one it just received.
 *
 * It holds no value of its own and performs no write: given two values, it
 * only decides what they imply.
 */
export class StateAssessor {
  readonly #classifier: PathValueClassifier;

  constructor(classifier: PathValueClassifier) {
    this.#classifier = classifier;
  }

  /** Dirty is the only thing a value on its own can ever imply. */
  assess(value: unknown, defaultValue: unknown): FieldStateInput {
    return this.#classifier.equals(value, defaultValue) ? CLEAN : { flags: StateFlag.Dirty };
  }
}
