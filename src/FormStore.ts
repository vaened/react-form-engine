/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { Unsubscribe } from "./EventEmitter";
import type { FormValues, Path, PathValue } from "./path";
import { type FormWrites, FormWriting } from "./store/FormWriting";
import { PathIndex } from "./store/path/PathIndex";
import type { PathIndexEntry, WalkOf } from "./store/path/types";
import { PathKind } from "./store/path/types";
import { FieldState } from "./store/state/FieldState";
import { type PathIdentifier, PathRegistry } from "./store/state/PathRegistry";
import { StateAssessor } from "./store/state/StateAssessor";
import { StateGraph } from "./store/state/StateGraph";
import type { StateEntry } from "./store/state/types";
import { FullWrite } from "./store/value/FullWrite";
import { isolate } from "./store/value/isolate";
import { PatchWrite } from "./store/value/PatchWrite";
import { PathValueClassifier } from "./store/value/PathValueClassifier";
import type { Scalar } from "./store/value/Scalar";
import { type ValueEntry, ValueStore } from "./store/value/ValueStore";
import type { DeepPartial } from "./types";

export type { FormValues } from "./path";
export type { FormWrites } from "./store/FormWriting";

export type FormMode = "full" | "patch";

/** The one location, as each domain knows it. */
interface Admitted {
  readonly value: ValueEntry;
  readonly state: StateEntry;
}

export interface FormStoreOptions<TValues extends FormValues> {
  /**
   * What the form is measured against, and what `reset` returns it to.
   *
   * Nothing in it is required: a form for creating a record is measured against
   * almost nothing, and a location left out is one the form starts without.
   */
  defaults: DeepPartial<TValues>;
  /**
   * Where the form starts, when that is not its base.
   *
   * Left out, the form starts at its `defaults` and nothing is dirty. Given,
   * the form starts here and is still measured against `defaults`, so a
   * location that already differs is dirty before anyone types — which is what
   * editing an existing record looks like.
   */
  values?: DeepPartial<TValues>;
  /**
   * Shapes the form is to hold whole rather than take apart, each saying how it
   * is recognised and how two of them are told apart.
   *
   * A location whose value nothing claims is read by its shape, which only ever
   * takes a plain record and a list apart. What that leaves out is the shape
   * that reads like a record and is not one — an amount and its currency are
   * one price, and two of them are the same price by what they say, never by
   * being the same object.
   *
   * These are offered a value before the ones the engine brings, so holding a
   * `Date` as a day rather than an instant is a matter of passing one in.
   */
  scalars?: readonly Scalar[];
  /**
   * Whether writing a location replaces it or lands inside it. Defaults to
   * `"full"`.
   *
   * In `"full"` the value takes the place of whatever the location held: what
   * the incoming value does not carry is gone, and everything the form knew
   * underneath is measured again against the base.
   *
   * In `"patch"` only what the value carries lands, and only where it carries
   * it. A key the value does not mention is never visited, so what lives under
   * it keeps its value, its state and the identity of its items. A key it does
   * mention lands as it came, `null` and `undefined` included, because either
   * may be what the caller meant.
   *
   * Both modes stop at a value the form holds whole: a location claimed by a
   * `Scalar` is replaced rather than walked into, whichever mode is in use.
   *
   * @example
   * store.set("invoice.client.addresses.0", { city: "Arequipa" });
   *
   * // "full":  { city: "Arequipa" }
   * // "patch": { city: "Arequipa", reference: "Frente al parque principal" }
   */
  mode?: FormMode;
}

export class FormStore<TValues extends FormValues> {
  readonly #mode: FormMode;
  readonly #paths: PathRegistry<Path<TValues>>;
  readonly #index: PathIndex<TValues>;
  readonly #state: StateGraph;
  readonly #value: ValueStore<TValues>;
  readonly #classifier: PathValueClassifier;
  readonly #assessor: StateAssessor;
  readonly #writing: FormWriting<TValues>;

  constructor(options: FormStoreOptions<TValues>) {
    this.#mode = options.mode ?? "full";
    this.#classifier = new PathValueClassifier(options.scalars);
    this.#paths = new PathRegistry<Path<TValues>>();
    this.#index = new PathIndex<TValues>(this.#paths);
    this.#state = new StateGraph(this.#index);
    this.#value = new ValueStore<TValues>(
      this.#index,
      this.#classifier,
      this.#held(options.values ?? options.defaults),
      this.#held(options.defaults),
    );
    this.#assessor = new StateAssessor(this.#classifier);
    this.#writing = new FormWriting(
      this.#index,
      this.#value,
      this.#state,
      this.#assessor,
      this.#classifier,
      this.#mode === "patch"
        ? new PatchWrite(this.#index, this.#value, this.#classifier)
        : new FullWrite(this.#value, this.#classifier),
    );
  }

  get mode(): FormMode {
    return this.#mode;
  }

  /**
   * The live value, handed over as it was declared.
   *
   * Reaching in and changing it leaves the form believing whatever it believed
   * before: nothing is reassessed and nobody is told. Changing a value is what
   * `set` is for.
   *
   * It is not handed over as something read-only, because a form value exists
   * to be given to whatever the form was filled in for, and a value narrowed
   * that way stops being the type its owner declared. What that costs is a
   * promise the type cannot keep, which it never could: the narrowing was a
   * request, and a request is escaped with a cast.
   */
  get values(): TValues {
    return this.#value.value;
  }

  get defaults(): TValues {
    return this.#value.defaults;
  }

  get identifier(): PathIdentifier<Path<TValues>> {
    return this.#paths;
  }

  register<TPath extends Path<TValues>>(path: TPath): void {
    this.#admit(path);
  }

  /**
   * Takes somebody waiting to hear that a location's value moved.
   *
   * Waiting on a location brings it onto the chain the same way registering it
   * does, so a caller never has to have named it first. What that costs is one
   * watcher, which is what the returned call gives back.
   */
  watch<TPath extends Path<TValues>>(path: TPath, listener: () => void): Unsubscribe {
    const leave = this.#value.subscribe(this.#admit(path).value, listener);

    return () => {
      leave();
      this.unregister(path);
    };
  }

  /** The same as `watch`, for how a location stands rather than what it holds. */
  feel<TPath extends Path<TValues>>(path: TPath, listener: () => void): Unsubscribe {
    const leave = this.#state.subscribe(this.#admit(path).state, listener);

    return () => {
      leave();
      this.unregister(path);
    };
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
    this.#writing.set(path, value);
  }

  /**
   * Writes several locations, each one as `set` would write it alone.
   *
   * A caller that means one change spread over places that have nothing to do
   * with each other — a projection standing for a group, a reset, a form filled
   * from a fetched record — says it here rather than as a run of writes, so
   * whoever is listening hears the change once instead of hearing it take shape.
   *
   * Locations land in the order they were written down, and one left out is one
   * nothing reaches: what it held stays as it was.
   *
   * @example
   * store.assign({
   *   "invoice.client.name": "Grace Hopper",
   *   "invoice.series": "F002",
   * });
   */
  assign(writes: FormWrites<TValues>): void {
    this.#writing.assign(writes);
  }

  getState<TPath extends Path<TValues>>(path: TPath): StateEntry | undefined {
    const entry = this.#index.resolve(path);

    return entry && this.#state.find(entry.id);
  }

  /** Every segment of a path, alongside whatever the value holds at it. */
  #walk<TPath extends Path<TValues>>(path: TPath): WalkOf<TPath> {
    return this.#value.observe(this.#index.segmentsOf(path));
  }

  /**
   * A path already in the index keeps whatever kind it was claimed with.
   * A new one is classified from the value living there right now, so an
   * absent branch registers as a field and opens into a node the moment
   * something registers underneath it.
   */
  #admit<TPath extends Path<TValues>>(path: TPath): Admitted {
    const existing = this.#index.resolve(path);

    if (existing) {
      return this.#join(existing);
    }

    const walk = this.#walk(path);

    return this.#join(this.#index.ensure(path, walk[walk.length - 1].observed ?? PathKind.Field, walk));
  }

  #join(entry: PathIndexEntry): Admitted {
    if (entry.kind === PathKind.Field) {
      const initial = new FieldState();

      initial.assessed(this.#assessor.assess(this.#value.read(entry), this.#value.default(entry)));

      return { state: this.#state.register(entry.id, initial), value: this.#value.register(entry.id) };
    }

    const state = this.#state.materialize(entry.id);
    const value = this.#value.materialize(entry.id);

    if (entry.kind === PathKind.Array) {
      this.#state.measured(
        entry.id,
        FormStore.#count(this.#value.read(entry)),
        FormStore.#count(this.#value.default(entry)),
      );
    }

    return { state, value };
  }

  /**
   * A copy of what the form was handed, as the shape it says it holds.
   *
   * The two describe the same shape and differ only in what is there, which is
   * what a form is: everything it can hold, less whatever nobody has filled in
   * yet. Reading a location that was left out answers absent, the same as one
   * that was never registered — so the missing pieces cost the reader nothing
   * and the compiler has no way to tell the two apart on its own.
   */
  #held(value: DeepPartial<TValues>): TValues {
    return isolate(value, this.#classifier) as TValues;
  }

  static #count(value: unknown): number {
    return Array.isArray(value) ? value.length : 0;
  }
}
