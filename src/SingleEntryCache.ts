/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

interface CacheEntry<TInput, TOutput> {
  input: TInput | undefined;
  output: TOutput | undefined;
}

/**
 * Remembers the answer to the last question, and only that one.
 *
 * Inputs are compared by identity, so it works with interned strings, branded
 * ids and object references alike.
 */
export class SingleEntryCache<TInput, TOutput> {
  readonly #entry: CacheEntry<TInput, TOutput>;

  constructor() {
    this.#entry = {
      input: undefined,
      output: undefined,
    };
  }

  get(input: TInput): TOutput | undefined {
    const entry = this.#entry;

    if (entry.input !== input) {
      return undefined;
    }

    return entry.output;
  }

  set(input: TInput, output: TOutput): void {
    const entry = this.#entry;

    entry.input = input;
    entry.output = output;
  }

  clear(): void {
    const entry = this.#entry;

    entry.input = undefined;
    entry.output = undefined;
  }
}
