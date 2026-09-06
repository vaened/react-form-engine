/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { Equal, Expect } from "./path/__tests__/type-assertions";
import type { DeepReadonly } from "./types";

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
