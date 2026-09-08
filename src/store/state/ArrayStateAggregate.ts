/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { StateAggregate } from "./StateAggregate";

/**
 * What a materialized array is: everything a node derives from its children,
 * and how many items it holds against how many its base held.
 *
 * The count is here because no child can speak for it. A field compares the
 * position it sits at against the same position of the base, so between them
 * the fields answer for every position both sides have — and for none of the
 * ones only one side has. An array that lost or gained items differs from its
 * base in a way that lives in the array and nowhere below it.
 *
 * This is the only place a location says something of its own. An object never
 * needs to: the locations it is compared through are the same ones for its
 * whole life, so its children answer for all of it.
 */
export class ArrayStateAggregate extends StateAggregate {
  #length = 0;
  #expected = 0;

  override get isDirty(): boolean {
    return super.isDirty || this.#length !== this.#expected;
  }

  get length(): number {
    return this.#length;
  }

  get expected(): number {
    return this.#expected;
  }

  /** How many items the array holds, and how many the base it is measured against holds. */
  measured(length: number, expected: number): void {
    this.#length = length;
    this.#expected = expected;

    this.derive();
  }
}
