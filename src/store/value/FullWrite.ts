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
   */
  write(entry: PathIndexEntry, value: unknown): readonly PathIndexEntry[] {
    const held = entry.kind === PathKind.Field ? value : isolate(value, this.#classifier);

    this.#value.write(entry, held, () => {});

    return [entry];
  }
}
