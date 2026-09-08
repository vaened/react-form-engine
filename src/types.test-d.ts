/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormScalar } from "./path";
import type { Equal, Expect } from "./path/__tests__/type-assertions";
import type { DeepPartial, DeepReadonly } from "./types";

type Coords = DeepReadonly<[number, number]>;
type Range = DeepReadonly<[string, number]>;
type Tags = DeepReadonly<string[]>;
type Nested = DeepReadonly<{ span: [Date, Date]; rows: { city: string }[] }>;

type CoordsExpectation = Expect<Equal<Coords, readonly [number, number]>>;
type RangeExpectation = Expect<Equal<Range, readonly [string, number]>>;
type TagsExpectation = Expect<Equal<Tags, readonly string[]>>;
type NestedExpectation = Expect<
  Equal<Nested, { readonly span: readonly [Date, Date]; readonly rows: readonly { readonly city: string }[] }>
>;

declare const coordsExpectation: CoordsExpectation;
declare const rangeExpectation: RangeExpectation;
declare const tagsExpectation: TagsExpectation;
declare const nestedExpectation: NestedExpectation;

void coordsExpectation;
void rangeExpectation;
void tagsExpectation;
void nestedExpectation;

declare const range: Range;

const first: string = range[0];
const second: number = range[1];

void first;
void second;

// @ts-expect-error a tuple keeps its length
const longer: Coords = [1, 2, 3];

// @ts-expect-error and each position keeps its own type
const swapped: Range = [1, "a"];

// @ts-expect-error nothing about it is writable
range[0] = "other";

void longer;
void swapped;

/** A value the engine is told never to take apart. */
interface Money extends FormScalar {
  readonly amount: number;
}

type Invoice = {
  series: string;
  createdAt: Date;
  price: Money;
  client: { name: string; addresses: { city: string; zip: string }[] };
  span: [Date, Date];
};

/** Nothing is required, however deep it sits. */
type NothingRequired = [
  Expect<Equal<DeepPartial<Invoice>["series"], string | undefined>>,
  Expect<Equal<NonNullable<DeepPartial<Invoice>["client"]>["name"], string | undefined>>,
];

/** A value the engine never takes apart is asked for whole or not at all. */
type TerminalStaysWhole = [
  Expect<Equal<DeepPartial<Invoice>["createdAt"], Date | undefined>>,
  Expect<Equal<DeepPartial<Invoice>["price"], Money | undefined>>,
  Expect<Equal<DeepPartial<Date>, Date>>,
];

/** A list keeps being a list; what its items hold is what may be missing. */
type ListsStayLists = [
  Expect<Equal<DeepPartial<{ city: string }[]>, { city?: string }[]>>,
  Expect<Equal<DeepPartial<[Date, Date]>, [Date, Date]>>,
];

const accepts = (): void => {
  const empty: DeepPartial<Invoice> = {};
  const some: DeepPartial<Invoice> = { series: "F001" };
  const deep: DeepPartial<Invoice> = { client: { addresses: [{ city: "Lima" }] } };
  const whole: DeepPartial<Invoice> = {
    series: "F001",
    createdAt: new Date(),
    price: { amount: 1 },
    client: { name: "Ada", addresses: [{ city: "Lima", zip: "15001" }] },
    span: [new Date(), new Date()],
  };

  void [empty, some, deep, whole];
};

const refuses = (): void => {
  // @ts-expect-error a location still has to be what it is
  const wrong: DeepPartial<Invoice> = { series: 1 };
  // @ts-expect-error and so does one further in
  const nested: DeepPartial<Invoice> = { client: { addresses: [{ city: 1 }] } };
  // @ts-expect-error a terminal is not taken apart, so half of one is nothing
  const half: DeepPartial<Invoice> = { createdAt: { getTime: 1 } };

  void [wrong, nested, half];
};

export type All = [NothingRequired, TerminalStaysWhole, ListsStayLists];
export { accepts, refuses };
