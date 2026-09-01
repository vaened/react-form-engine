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
 * A single slot is enough for the work this engine repeats: the same input
 * arriving over and over, such as a person typing into one field. Ask again
 * with the same input and the answer comes back without recomputing it; ask
 * with a different one and the slot is simply taken over.
 *
 * Inputs are compared by identity, so it works with interned strings, branded
 * ids and object references alike.
 *
 * Having a single slot is also what makes it safe to cache derived answers:
 * invalidating means `clear()`, with nothing selective left behind to forget.
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
