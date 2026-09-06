/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

interface Blob {
  readonly size: number;
  readonly type: string;
}

interface File extends Blob {
  readonly lastModified: number;
  readonly name: string;
}

interface FileList {
  readonly length: number;
  item(index: number): File | null;
  [index: number]: File;
}

export type Primitive = bigint | boolean | null | number | string | symbol | undefined;

export type HostNativeObject = Blob | Date | File | FileList;

declare const FORM_SCALAR: unique symbol;

/**
 * Marks a type as a single value, so paths stop at it instead of continuing
 * into its properties.
 *
 * By default the engine takes any object apart: every property it holds becomes
 * a location with its own path, its own state and its own dirty flag. A domain
 * type is rarely meant to be read that way — a `Money` is one amount, not an
 * `amount` and a `currency` that drifted apart.
 *
 * A marked type is terminal everywhere it appears: `Path` and `FieldPath` end
 * at it, `NodePath` skips it, and `Control` resolves to a `FieldControl` rather
 * than a `NodeControl`.
 *
 * Mark a type by merging this interface into it. Only an `interface` or a
 * `class` can be marked, because a `type` alias cannot be reopened.
 *
 * @example
 * // Where the type is declared:
 * export class Money {
 *   constructor(readonly amount: number, readonly currency: string) {}
 * }
 *
 * export interface Money extends FormScalar {}
 *
 * @example
 * // From anywhere else, including for a type you do not own:
 * declare module "./domain" {
 *   interface Money extends FormScalar {}
 * }
 *
 * The declaration is erased at compile time and has no effect at runtime. The
 * engine still has to be given a `Scalar` that knows how to recognise the type
 * and compare two of its values.
 */
export interface FormScalar {
  readonly [FORM_SCALAR]?: true;
}

// biome-ignore lint/suspicious/noExplicitAny: Interfaces require an open record constraint without losing their exact value types.
export type FormValues = Record<string, any>;

type StringKeyOf<T> = Extract<keyof T, string>;

type TupleKeys<T extends readonly unknown[]> = Extract<keyof T, `${number}`>;

type Present<T> = Exclude<T, null | undefined>;

type IsTuple<T extends readonly unknown[]> = number extends T["length"] ? false : true;

type IsScalar<T> = typeof FORM_SCALAR extends keyof T ? true : false;

export type IsTerminal<T> = T extends Primitive | HostNativeObject
  ? true
  : IsScalar<T> extends true
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

type ArrayPathEntry<K extends string, V, TSeen> =
  IsTerminal<Present<V>> extends true
    ? never
    : Present<V> extends readonly (infer TValue)[]
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
        [TKey in TupleKeys<T>]-?: ArrayPathEntry<TKey & string, T[TKey], TSeen>;
      }[TupleKeys<T>]
    : ArrayPathDynamicChild<T, TValue, TSeen>
  : T extends object
    ? {
        [TKey in StringKeyOf<T>]-?: ArrayPathEntry<TKey, T[TKey], TSeen>;
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
