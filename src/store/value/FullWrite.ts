/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues } from "../../path";
import type { PathIndexEntry } from "../path/types";
import type { ValueStore } from "./ValueStore";
import type { ValueWrite } from "./ValueWrite";

/** The value replaces whatever occupied the location, and nothing else moves. */
export class FullWrite<TValues extends FormValues = FormValues> implements ValueWrite {
  readonly #value: ValueStore<TValues>;

  constructor(value: ValueStore<TValues>) {
    this.#value = value;
  }

  write(entry: PathIndexEntry, value: unknown): readonly PathIndexEntry[] {
    this.#value.write(entry, value, () => {});

    return [entry];
  }
}
