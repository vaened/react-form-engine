/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, IsTerminal, Path, PathValue } from "./path";

/**
 * What a write says about the locations it reaches, beyond the value it puts
 * there.
 *
 * Everything here is optional and left out by default, which is what an edit
 * means: somebody put this value here.
 *
 * Whether a location differs from what it is measured against is not offered,
 * because it is not an opinion. It is read from the value every time, so a form
 * that says nothing is dirty is a form whose values match their base.
 *
 * @example
 * // Fills the form from a fetched record without saying the user typed it.
 * store.set("invoice.client.name", record.name, { touch: false });
 */
export interface WriteOptions {
  /**
   * Whether a location this reaches counts as one somebody has been at.
   *
   * Defaults to `true`: a write is somebody putting a value somewhere. Pass
   * `false` for a value the form gave itself, so a field the user never visited
   * does not start showing the errors of an empty one.
   */
  readonly touch?: boolean;
}

/**
 * A value that says the same shape, with nothing required.
 *
 * What a form is measured against is rarely everything it can hold: a form for
 * creating a record starts with almost nothing, and demanding the whole of it
 * would make the caller invent a value for every location just to say it has
 * none.
 *
 * It stops where a path stops. A `Date` and anything a `Scalar` claims are one
 * value, not a shape to take apart, so they are asked for whole or not at all.
 * A list keeps being a list, because there is no half of one — what its items
 * hold is what may be missing.
 */
export type DeepPartial<TValue> =
  IsTerminal<TValue> extends true
    ? TValue
    : TValue extends readonly (infer TItem)[]
      ? number extends TValue["length"]
        ? DeepPartial<TItem>[]
        : { [TKey in keyof TValue]: DeepPartial<TValue[TKey]> }
      : { [TKey in keyof TValue]?: DeepPartial<TValue[TKey]> };

type DeepReadonlyPrimitive = bigint | boolean | null | number | string | symbol | undefined;

export type DeepReadonly<TValue> = TValue extends DeepReadonlyPrimitive | ((...args: never[]) => unknown)
  ? TValue
  : TValue extends ReadonlyMap<infer TKey, infer TItem>
    ? ReadonlyMap<DeepReadonly<TKey>, DeepReadonly<TItem>>
    : TValue extends ReadonlySet<infer TItem>
      ? ReadonlySet<DeepReadonly<TItem>>
      : TValue extends readonly unknown[]
        ? number extends TValue["length"]
          ? readonly DeepReadonly<TValue[number]>[]
          : { readonly [TKey in keyof TValue]: DeepReadonly<TValue[TKey]> }
        : TValue extends object
          ? { readonly [TKey in keyof TValue]: DeepReadonly<TValue[TKey]> }
          : TValue;

/** What a list holds at each of its positions. */
export type ArrayItem<TValues extends FormValues, TPath extends Path<TValues>> =
  PathValue<TValues, TPath> extends readonly (infer TItem)[] ? TItem : never;
