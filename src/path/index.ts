export type Primitive = bigint | boolean | null | number | string | symbol | undefined;

export type FormValues = Record<string, unknown> | readonly unknown[];

type StringKeyOf<T> = Extract<keyof T, string>;

type TupleKeys<T extends readonly unknown[]> = Extract<keyof T, `${number}`>;

type Present<T> = Exclude<T, null | undefined>;

type IsTuple<T extends readonly unknown[]> = number extends T["length"] ? false : true;

type IsTerminal<T> = T extends Primitive
  ? true
  : T extends readonly unknown[]
    ? false
    : T extends object
      ? false
      : true;

type IsEqual<TLeft, TRight> =
  (<TValue>() => TValue extends TLeft ? 1 : 2) extends <TValue>() => TValue extends TRight ? 1 : 2 ? true : false;

type AnyIsEqual<TLeft, TRight> = TLeft extends TRight ? (IsEqual<TLeft, TRight> extends true ? true : never) : never;

type PathEntry<K extends string | number, V, TSeen> =
  IsTerminal<V> extends true
    ? `${K}`
    : true extends AnyIsEqual<TSeen, Present<V>>
      ? `${K}`
      : `${K}` | `${K}.${PathInternal<Present<V>, TSeen | Present<V>>}`;

type PathInternal<T, TSeen = T> = T extends readonly (infer TValue)[]
  ? IsTuple<T> extends true
    ? {
        [TKey in TupleKeys<T>]-?: PathEntry<TKey & string, T[TKey], TSeen>;
      }[TupleKeys<T>]
    : PathEntry<number, TValue, TSeen>
  : T extends object
    ? {
        [TKey in StringKeyOf<T>]-?: PathEntry<TKey, T[TKey], TSeen>;
      }[StringKeyOf<T>]
    : never;

type FieldPathEntry<K extends string | number, V, TSeen> =
  IsTerminal<V> extends true
    ? `${K}`
    : true extends AnyIsEqual<TSeen, Present<V>>
      ? never
      : `${K}.${FieldPathInternal<Present<V>, TSeen | Present<V>>}`;

type FieldPathInternal<T, TSeen = T> = T extends readonly (infer TValue)[]
  ? IsTuple<T> extends true
    ? {
        [TKey in TupleKeys<T>]-?: FieldPathEntry<TKey & string, T[TKey], TSeen>;
      }[TupleKeys<T>]
    : FieldPathEntry<number, TValue, TSeen>
  : T extends object
    ? {
        [TKey in StringKeyOf<T>]-?: FieldPathEntry<TKey, T[TKey], TSeen>;
      }[StringKeyOf<T>]
    : never;

type NodePathEntry<K extends string | number, V, TSeen> =
  IsTerminal<V> extends true
    ? never
    : true extends AnyIsEqual<TSeen, Present<V>>
      ? `${K}`
      :
          | `${K}`
          | (NodePathInternal<Present<V>, TSeen | Present<V>> extends never
              ? never
              : `${K}.${NodePathInternal<Present<V>, TSeen | Present<V>>}`);

type NodePathInternal<T, TSeen = T> = T extends readonly (infer TValue)[]
  ? IsTuple<T> extends true
    ? {
        [TKey in TupleKeys<T>]-?: NodePathEntry<TKey & string, T[TKey], TSeen>;
      }[TupleKeys<T>]
    : NodePathEntry<number, TValue, TSeen>
  : T extends object
    ? {
        [TKey in StringKeyOf<T>]-?: NodePathEntry<TKey, T[TKey], TSeen>;
      }[StringKeyOf<T>]
    : never;

type ArrayPathTupleEntry<K extends string, V, TSeen> =
  Present<V> extends readonly (infer TValue)[]
    ? IsTuple<Present<V>> extends true
      ? true extends AnyIsEqual<TSeen, Present<V>>
        ? never
        : ArrayPathInternal<Present<V>, TSeen | Present<V>> extends never
          ? never
          : `${K}.${ArrayPathInternal<Present<V>, TSeen | Present<V>>}`
      :
          | `${K}`
          | (ArrayPathDynamicChild<Present<V>, TValue, TSeen | Present<V>> extends never
              ? never
              : `${K}.${ArrayPathDynamicChild<Present<V>, TValue, TSeen | Present<V>>}`)
    : Present<V> extends object
      ? true extends AnyIsEqual<TSeen, Present<V>>
        ? never
        : ArrayPathInternal<Present<V>, TSeen | Present<V>> extends never
          ? never
          : `${K}.${ArrayPathInternal<Present<V>, TSeen | Present<V>>}`
      : never;

type ArrayPathObjectEntry<K extends string, V, TSeen> =
  Present<V> extends readonly (infer TValue)[]
    ? IsTuple<Present<V>> extends true
      ? true extends AnyIsEqual<TSeen, Present<V>>
        ? never
        : ArrayPathInternal<Present<V>, TSeen | Present<V>> extends never
          ? never
          : `${K}.${ArrayPathInternal<Present<V>, TSeen | Present<V>>}`
      :
          | `${K}`
          | (ArrayPathDynamicChild<Present<V>, TValue, TSeen | Present<V>> extends never
              ? never
              : `${K}.${ArrayPathDynamicChild<Present<V>, TValue, TSeen | Present<V>>}`)
    : Present<V> extends object
      ? true extends AnyIsEqual<TSeen, Present<V>>
        ? never
        : ArrayPathInternal<Present<V>, TSeen | Present<V>> extends never
          ? never
          : `${K}.${ArrayPathInternal<Present<V>, TSeen | Present<V>>}`
      : never;

type ArrayPathDynamicChild<TArray extends readonly unknown[], TValue, TSeen> =
  IsTuple<TArray> extends true
    ? never
    : IsTerminal<TValue> extends true
      ? never
      : Present<TValue> extends readonly (infer TChild)[]
        ? IsTuple<Present<TValue>> extends true
          ? true extends AnyIsEqual<TSeen, Present<TValue>>
            ? never
            : ArrayPathInternal<Present<TValue>, TSeen | Present<TValue>> extends never
              ? never
              : `${number}.${ArrayPathInternal<Present<TValue>, TSeen | Present<TValue>>}`
          :
              | `${number}`
              | (ArrayPathDynamicChild<Present<TValue>, TChild, TSeen | Present<TValue>> extends never
                  ? never
                  : `${number}.${ArrayPathDynamicChild<Present<TValue>, TChild, TSeen | Present<TValue>>}`)
        : Present<TValue> extends object
          ? true extends AnyIsEqual<TSeen, Present<TValue>>
            ? `${number}`
            : `${number}.${ArrayPathInternal<Present<TValue>, TSeen | Present<TValue>>}`
          : never;

type ArrayPathInternal<T, TSeen = T> = T extends readonly (infer TValue)[]
  ? IsTuple<T> extends true
    ? {
        [TKey in TupleKeys<T>]-?: ArrayPathTupleEntry<TKey & string, T[TKey], TSeen>;
      }[TupleKeys<T>]
    : ArrayPathDynamicChild<T, TValue, TSeen>
  : T extends object
    ? {
        [TKey in StringKeyOf<T>]-?: ArrayPathObjectEntry<TKey, T[TKey], TSeen>;
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
