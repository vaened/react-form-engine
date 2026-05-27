/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { Path, PathValue } from "./path";

export type FormValues = Record<string, unknown>;

export type FormMode = "full" | "patch";

export type FieldState = {
  flags: number;
  errors: unknown[];
};

function createFieldState(): FieldState {
  return {
    errors: [],
    flags: 0,
  };
}

export type FormStoreOptions<TValues extends FormValues> = {
  values: TValues;
  defaults?: TValues;
  mode?: FormMode;
};

export class FormStore<TValues extends FormValues> {
  readonly #mode: FormMode;

  #values: TValues;
  #defaults: TValues;
  #states = new Map<string, FieldState>();

  constructor(options: FormStoreOptions<TValues>) {
    this.#mode = options.mode ?? "full";
    this.#values = options.values;
    this.#defaults = options.defaults ?? options.values;
  }

  get mode(): FormMode {
    return this.#mode;
  }

  get values(): TValues {
    return this.#values;
  }

  get defaults(): TValues {
    return this.#defaults;
  }

  get states(): ReadonlyMap<string, FieldState> {
    return this.#states;
  }

  register<TPath extends Path<TValues>>(path: TPath): FieldState {
    const existingState = this.#states.get(path);

    if (existingState) {
      return existingState;
    }

    const state = createFieldState();
    this.#states.set(path, state);

    return state;
  }

  unregister<TPath extends Path<TValues>>(path: TPath): void {
    this.#states.delete(path);
  }

  getState<TPath extends Path<TValues>>(path: TPath): FieldState | undefined {
    return this.#states.get(path);
  }

  set<TPath extends Path<TValues>>(path: TPath, value: PathValue<TValues, TPath>): void {
    FormStore.setAtPath(this.#values, path, value);
  }

  static setAtPath<TValue>(target: unknown, path: string, value: TValue): void {
    const segments = path.split(".");

    if (segments.length === 0) {
      return;
    }

    let current = target as Record<string, unknown>;

    for (const segment of segments.slice(0, -1)) {
      current = current[segment] as Record<string, unknown>;
    }

    const lastSegment = segments[segments.length - 1];

    if (lastSegment === undefined) {
      return;
    }

    current[lastSegment] = value;
  }
}
