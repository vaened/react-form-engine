/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues } from "../../path";
import { type PathIndexEntry, PathKind } from "../path/types";
import { isolate } from "./isolate";
import type { PathValueClassifier } from "./PathValueClassifier";
import type { ValueStore } from "./ValueStore";
import type { ValueWrite } from "./ValueWrite";

/** Shared so that a write that lands nowhere does not allocate to say so. */
const NOWHERE: readonly PathIndexEntry[] = Object.freeze([]);

/** The value replaces whatever occupied the location, and nothing else moves. */
export class FullWrite<TValues extends FormValues = FormValues> implements ValueWrite {
  readonly #value: ValueStore<TValues>;
  readonly #classifier: PathValueClassifier;

  constructor(value: ValueStore<TValues>, classifier: PathValueClassifier) {
    this.#value = value;
    this.#classifier = classifier;
  }

  /**
   * A field is kept as it came: it holds one value, and replacing it reaches
   * nothing else. Anything else becomes places the form addresses one by one,
   * and what was handed over may already sit somewhere in the form, so a copy
   * goes in instead — two places holding one object would be one slot.
   *
   * A field landing on what it already held went nowhere, so it is answered for
   * with nothing: the location did not move and neither did anything above it.
   * Only a field is asked, because comparing a container means walking it, and
   * what lives inside answers for itself one field at a time.
   */
  write(entry: PathIndexEntry, value: unknown): readonly PathIndexEntry[] {
    const held = entry.kind === PathKind.Field ? value : isolate(value, this.#classifier);

    return this.#value.write(entry, held) ? [entry] : NOWHERE;
  }
}
