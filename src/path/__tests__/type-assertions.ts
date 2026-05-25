export type Expect<TValue extends true> = TValue;

export type Extends<TLeft, TRight> = TLeft extends TRight ? true : false;
