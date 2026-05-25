export type Expect<TValue extends true> = TValue;

export type Extends<TLeft, TRight> = TLeft extends TRight ? true : false;

export type Equal<TLeft, TRight> =
  Extends<TLeft, TRight> extends true ? (Extends<TRight, TLeft> extends true ? true : false) : false;
