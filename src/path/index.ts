export type Primitive = bigint | boolean | null | number | string | symbol | undefined;

export type FormValues = Record<string, unknown> | readonly unknown[];

type StringKeyOf<T> = Extract<keyof T, string>;

type TupleKeys<T extends readonly unknown[]> = Extract<keyof T, `${number}`>;

type IsTuple<T extends readonly unknown[]> = number extends T["length"] ? false : true;

type IsTerminal<T> = T extends Primitive
  ? true
  : T extends readonly unknown[]
    ? false
    : T extends object
      ? false
      : true;

type PathEntry<K extends string | number, V> = V extends Primitive ? `${K}` : `${K}` | `${K}.${PathInternal<V>}`;

type PathInternal<T> = T extends readonly (infer TValue)[]
  ? IsTuple<T> extends true
    ? {
        [TKey in TupleKeys<T>]-?: PathEntry<TKey & string, T[TKey]>;
      }[TupleKeys<T>]
    : PathEntry<number, TValue>
  : T extends object
    ? {
        [TKey in StringKeyOf<T>]-?: PathEntry<TKey, T[TKey]>;
      }[StringKeyOf<T>]
    : never;

type FieldPathEntry<K extends string | number, V> =
  IsTerminal<V> extends true ? `${K}` : `${K}.${FieldPathInternal<V>}`;

type FieldPathInternal<T> = T extends readonly (infer TValue)[]
  ? IsTuple<T> extends true
    ? {
        [TKey in TupleKeys<T>]-?: FieldPathEntry<TKey & string, T[TKey]>;
      }[TupleKeys<T>]
    : FieldPathEntry<number, TValue>
  : T extends object
    ? {
        [TKey in StringKeyOf<T>]-?: FieldPathEntry<TKey, T[TKey]>;
      }[StringKeyOf<T>]
    : never;

type NodePathEntry<K extends string | number, V> =
  IsTerminal<V> extends true
    ? never
    : `${K}` | (NodePathInternal<V> extends never ? never : `${K}.${NodePathInternal<V>}`);

type NodePathInternal<T> = T extends readonly (infer TValue)[]
  ? IsTuple<T> extends true
    ? {
        [TKey in TupleKeys<T>]-?: NodePathEntry<TKey & string, T[TKey]>;
      }[TupleKeys<T>]
    : NodePathEntry<number, TValue>
  : T extends object
    ? {
        [TKey in StringKeyOf<T>]-?: NodePathEntry<TKey, T[TKey]>;
      }[StringKeyOf<T>]
    : never;

type ArrayPathTupleEntry<K extends string, V> = V extends readonly (infer TValue)[]
  ? IsTuple<V> extends true
    ? ArrayPathInternal<V> extends never
      ? never
      : `${K}.${ArrayPathInternal<V>}`
    : `${K}` | (ArrayPathDynamicChild<V, TValue> extends never ? never : `${K}.${ArrayPathDynamicChild<V, TValue>}`)
  : V extends object
    ? ArrayPathInternal<V> extends never
      ? never
      : `${K}.${ArrayPathInternal<V>}`
    : never;

type ArrayPathObjectEntry<K extends string, V> = V extends readonly (infer TValue)[]
  ? IsTuple<V> extends true
    ? ArrayPathInternal<V> extends never
      ? never
      : `${K}.${ArrayPathInternal<V>}`
    : `${K}` | (ArrayPathDynamicChild<V, TValue> extends never ? never : `${K}.${ArrayPathDynamicChild<V, TValue>}`)
  : V extends object
    ? ArrayPathInternal<V> extends never
      ? never
      : `${K}.${ArrayPathInternal<V>}`
    : never;

type ArrayPathDynamicChild<TArray extends readonly unknown[], TValue> =
  IsTuple<TArray> extends true
    ? never
    : IsTerminal<TValue> extends true
      ? never
      : TValue extends readonly (infer TChild)[]
        ? IsTuple<TValue> extends true
          ? ArrayPathInternal<TValue> extends never
            ? never
            : `${number}.${ArrayPathInternal<TValue>}`
          :
              | `${number}`
              | (ArrayPathDynamicChild<TValue, TChild> extends never
                  ? never
                  : `${number}.${ArrayPathDynamicChild<TValue, TChild>}`)
        : TValue extends object
          ? `${number}.${ArrayPathInternal<TValue>}`
          : never;

type ArrayPathInternal<T> = T extends readonly (infer TValue)[]
  ? IsTuple<T> extends true
    ? {
        [TKey in TupleKeys<T>]-?: ArrayPathTupleEntry<TKey & string, T[TKey]>;
      }[TupleKeys<T>]
    : ArrayPathDynamicChild<T, TValue>
  : T extends object
    ? {
        [TKey in StringKeyOf<T>]-?: ArrayPathObjectEntry<TKey, T[TKey]>;
      }[StringKeyOf<T>]
    : never;

type PathValueArray<T extends readonly unknown[], P extends string> = P extends `${infer K}.${infer R}`
  ? IsTuple<T> extends true
    ? K extends TupleKeys<T>
      ? PathValueInternal<T[K], R>
      : never
    : K extends `${number}`
      ? T extends readonly (infer TValue)[]
        ? PathValueInternal<TValue, R>
        : never
      : never
  : IsTuple<T> extends true
    ? P extends TupleKeys<T>
      ? T[P]
      : never
    : P extends `${number}`
      ? T extends readonly (infer TValue)[]
        ? TValue
        : never
      : never;

type PathValueObject<T extends object, P extends string> = P extends `${infer K}.${infer R}`
  ? K extends keyof T
    ? undefined extends T[K]
      ? PathValueInternal<T[K], R> | undefined
      : PathValueInternal<T[K], R>
    : never
  : P extends keyof T
    ? T[P]
    : never;

type PathValueInternal<T, P extends string> = T extends unknown
  ? T extends readonly unknown[]
    ? PathValueArray<T, P>
    : T extends object
      ? PathValueObject<T, P>
      : never
  : never;

export type Path<TValues extends FormValues> = TValues extends unknown ? PathInternal<TValues> : never;

export type FieldPath<TValues extends FormValues> = TValues extends unknown ? FieldPathInternal<TValues> : never;

export type NodePath<TValues extends FormValues> = TValues extends unknown ? NodePathInternal<TValues> : never;

export type ArrayPath<TValues extends FormValues> = TValues extends unknown ? ArrayPathInternal<TValues> : never;

export type PathValue<
  TValues extends FormValues,
  TPath extends Path<TValues> | FieldPath<TValues> | NodePath<TValues> | ArrayPath<TValues>,
> = PathValueInternal<TValues, TPath>;
