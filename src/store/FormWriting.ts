/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { ArrayPath, FormValues, Path, PathValue } from "../path";
import type { ArrayItem, DeepPartial } from "../types";
import type { PathIndex } from "./path/PathIndex";
import type { StateAssessor } from "./state/StateAssessor";
import type { StateGraph } from "./state/StateGraph";
import { Transaction } from "./Transaction";
import type { PathValueClassifier } from "./value/PathValueClassifier";
import type { ValueStore } from "./value/ValueStore";
import type { ValueWrite } from "./value/ValueWrite";

/** Locations of a form, each carrying the value its own path holds. */
export type FormWrites<TValues extends FormValues> = {
  [TPath in Path<TValues>]?: PathValue<TValues, TPath>;
};

/**
 * Writing, whole: the value lands, the shape follows it, the state is measured
 * against it, and whoever waits is told once it is over.
 *
 * The four are one operation and not four steps that happen to run in order. A
 * value already moved with the state that answers for it still catching up is a
 * form nobody should see, and two locations the same request reached are one
 * change rather than two. Nothing in between is reportable, which is why the
 * transaction lives here and nobody below is told it exists.
 */
export class FormWriting<TValues extends FormValues = FormValues> {
  readonly #index: PathIndex<TValues>;
  readonly #value: ValueStore<TValues>;
  readonly #state: StateGraph;
  readonly #assessor: StateAssessor;
  readonly #classifier: PathValueClassifier;
  readonly #policy: ValueWrite;
  #transactions = 0;

  constructor(
    index: PathIndex<TValues>,
    value: ValueStore<TValues>,
    state: StateGraph,
    assessor: StateAssessor,
    classifier: PathValueClassifier,
    policy: ValueWrite,
  ) {
    this.#index = index;
    this.#value = value;
    this.#state = state;
    this.#assessor = assessor;
    this.#classifier = classifier;
    this.#policy = policy;
  }

  set<TPath extends Path<TValues>>(path: TPath, value: PathValue<TValues, TPath>): void {
    this.#begin().write(path, value).commit();
  }

  /**
   * Several locations as one transaction, so a caller that meant one change is owed
   * one telling however far apart the places it named turned out to be.
   *
   * They land in the order they were written down, and one left out is one
   * nothing reaches: what it held stays as it was.
   */
  assign(writes: FormWrites<TValues>): void {
    const transaction = this.#begin();

    for (const path of Object.keys(writes) as Path<TValues>[]) {
      transaction.write(path, writes[path] as PathValue<TValues, Path<TValues>>);
    }

    transaction.commit();
  }

  /** The positions of a list, each move told once like any other change. */
  insert<TPath extends ArrayPath<TValues> & Path<TValues>>(
    path: TPath,
    index: number,
    value: ArrayItem<TValues, TPath>,
  ): void {
    this.#begin().insert(path, index, value).commit();
  }

  remove<TPath extends ArrayPath<TValues> & Path<TValues>>(path: TPath, index: number): void {
    this.#begin().remove(path, index).commit();
  }

  move<TPath extends ArrayPath<TValues> & Path<TValues>>(path: TPath, from: number, to: number): void {
    this.#begin().move(path, from, to).commit();
  }

  swap<TPath extends ArrayPath<TValues> & Path<TValues>>(path: TPath, left: number, right: number): void {
    this.#begin().swap(path, left, right).commit();
  }

  /** A form born again, told once like any other change. */
  reset(base?: DeepPartial<TValues>): void {
    this.#begin().reset(base).commit();
  }

  #begin(): Transaction<TValues> {
    return new Transaction(
      ++this.#transactions,
      this.#index,
      this.#value,
      this.#state,
      this.#assessor,
      this.#classifier,
      this.#policy,
    );
  }
}
