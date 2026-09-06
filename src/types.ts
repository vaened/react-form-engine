/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

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
