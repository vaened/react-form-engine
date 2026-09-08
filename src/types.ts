/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { IsTerminal } from "./path";

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
