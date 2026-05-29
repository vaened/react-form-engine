interface CacheEntry<TInput, TOutput> {
  input: TInput | undefined;
  output: TOutput | undefined;
}

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
