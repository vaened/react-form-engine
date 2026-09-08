/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, Path, PathValue } from "./path";
import { PathIndex } from "./store/path/PathIndex";
import type { PathIndexChildEntry, PathIndexEntry, RegisterableKind, WalkOf } from "./store/path/types";
import { PathKind } from "./store/path/types";
import { Reconciler } from "./store/Reconciler";
import { FieldState } from "./store/state/FieldState";
import { type PathIdentifier, PathRegistry } from "./store/state/PathRegistry";
import { StateAssessor } from "./store/state/StateAssessor";
import { StateGraph } from "./store/state/StateGraph";
import type { StateEntry } from "./store/state/types";
import { FullWrite } from "./store/value/FullWrite";
import { isolate } from "./store/value/isolate";
import { PatchWrite } from "./store/value/PatchWrite";
import { PathValueClassifier } from "./store/value/PathValueClassifier";
import { ValueStore } from "./store/value/ValueStore";
import type { ValueWrite } from "./store/value/ValueWrite";
import type { DeepReadonly } from "./types";

export type { FormValues } from "./path";

export type FormMode = "full" | "patch";

export type FormStoreOptions<TValues extends FormValues> = {
  /** What the form is measured against, and what `reset` returns it to. */
  defaults: TValues;
  /** Where the form starts, when that is not its base. */
  values?: TValues;
  mode?: FormMode;
};

export class FormStore<TValues extends FormValues> {
  readonly #mode: FormMode;
  readonly #paths: PathRegistry<Path<TValues>>;
  readonly #index: PathIndex<TValues>;
  readonly #state: StateGraph;
  readonly #value: ValueStore<TValues>;
  readonly #classifier = new PathValueClassifier();
  readonly #assessor: StateAssessor;
  readonly #reconciler: Reconciler<TValues>;
  readonly #writer: ValueWrite;
  readonly #reconcileWritten = (written: PathIndexEntry): void => this.#reconciler.reconcile(written);

  constructor(options: FormStoreOptions<TValues>) {
    this.#mode = options.mode ?? "full";
    this.#paths = new PathRegistry<Path<TValues>>();
    this.#index = new PathIndex<TValues>(this.#paths);
    this.#state = new StateGraph(this.#index);
    this.#value = new ValueStore<TValues>(
      this.#index,
      this.#classifier,
      isolate(options.values ?? options.defaults, this.#classifier),
      isolate(options.defaults, this.#classifier),
    );
    this.#assessor = new StateAssessor(this.#classifier);
    this.#reconciler = new Reconciler(this.#index, this.#state, this.#value, this.#classifier, this.#assessor);
    this.#writer =
      this.#mode === "patch"
        ? new PatchWrite(this.#index, this.#value, this.#classifier)
        : new FullWrite(this.#value, this.#classifier);
  }

  get mode(): FormMode {
    return this.#mode;
  }

  /**
   * The live value, handed over as something to read.
   *
   * Reaching in and changing it would leave the form believing whatever it
   * believed before: nothing is reassessed and nobody is told. Changing a value
   * is what `set` is for.
   */
  get values(): DeepReadonly<TValues> {
    // Nothing is converted here: the same object is handed over with less that
    // can be done to it. It has to be said out loud because a conditional type
    // over a parameter that is still open cannot be checked against itself.
    return this.#value.value as DeepReadonly<TValues>;
  }

  get defaults(): DeepReadonly<TValues> {
    return this.#value.defaults as DeepReadonly<TValues>;
  }

  get identifier(): PathIdentifier<Path<TValues>> {
    return this.#paths;
  }

  /**
   * A path already in the index keeps whatever kind it was claimed with.
   * A new one is classified from the value living there right now, so an
   * absent branch registers as a field and opens into a node the moment
   * something registers underneath it.
   */
  register<TPath extends Path<TValues>>(path: TPath): void {
    const existing = this.#index.resolve(path);

    if (existing) {
      this.#join(existing);
      return;
    }

    const walk = this.#walk(path);

    this.#join(this.#index.ensure(path, walk[walk.length - 1].observed ?? PathKind.Field, walk));
  }

  unregister<TPath extends Path<TValues>>(path: TPath): void {
    const entry = this.#index.resolve(path);

    if (!entry) {
      return;
    }

    if (this.#state.has(entry.id)) {
      entry.kind === PathKind.Field ? this.#state.unregister(entry.id) : this.#state.dematerialize(entry.id);
    }

    if (this.#value.has(entry.id)) {
      entry.kind === PathKind.Field ? this.#value.unregister(entry.id) : this.#value.dematerialize(entry.id);
    }
  }

  set<TPath extends Path<TValues>>(path: TPath, value: PathValue<TValues, TPath>): void {
    const entry = this.#index.resolve(path) ?? this.#claim(path, this.#classifier.classify(value));

    this.#writer.write(entry, value, this.#reconcileWritten);
  }

  getState<TPath extends Path<TValues>>(path: TPath): StateEntry | undefined {
    const entry = this.#index.resolve(path);

    return entry && this.#state.find(entry.id);
  }

  /** Reaches a path in the index, having made sure the value lets it through. */
  #claim<TPath extends Path<TValues>>(path: TPath, kind: RegisterableKind): PathIndexChildEntry {
    return this.#index.ensure(path, kind, this.#walk(path));
  }

  /** Every segment of a path, alongside whatever the value holds at it. */
  #walk<TPath extends Path<TValues>>(path: TPath): WalkOf<TPath> {
    return this.#value.observe(this.#index.segmentsOf(path));
  }

  #join(entry: PathIndexEntry): void {
    if (entry.kind === PathKind.Field) {
      const initial = new FieldState();

      initial.assessed(this.#assessor.assess(this.#value.read(entry), this.#value.default(entry)));

      this.#state.register(entry.id, initial);
      this.#value.register(entry.id);
      return;
    }

    this.#state.materialize(entry.id);
    this.#value.materialize(entry.id);

    if (entry.kind === PathKind.Array) {
      this.#state.measured(
        entry.id,
        FormStore.#count(this.#value.read(entry)),
        FormStore.#count(this.#value.default(entry)),
      );
    }
  }

  static #count(value: unknown): number {
    return Array.isArray(value) ? value.length : 0;
  }
}
