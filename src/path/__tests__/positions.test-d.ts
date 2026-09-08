import type { Path, PathValue } from "../../index";
import type { Equal, Expect, Extends } from "./type-assertions";

type Row = { city: string };

type Values = {
  rows: Row[];
  pair: [Row, string];
  byYear: { 2026: { total: number }; 2027: { total: number }; alias: { total: number } };
  loose: Record<string, { total: number }>;
};

/** A position is digits, and reaches the item sitting at it. */
type CanonicalIndex = [
  Expect<Equal<PathValue<Values, "rows.0">, Row>>,
  Expect<Equal<PathValue<Values, "rows.7">, Row>>,
  Expect<Equal<PathValue<Values, "rows.2026">, Row>>,
  Expect<Equal<PathValue<Values, "rows.0.city">, string>>,
  Expect<Equal<PathValue<Values, "rows.9007199254740991">, Row>>,
];

/**
 * Everything else a path may be written with reaches nothing, so a write into
 * one has no value it would accept.
 */
type RefusedIndex = [
  Expect<Equal<PathValue<Values, "rows.01">, never>>,
  Expect<Equal<PathValue<Values, "rows.00">, never>>,
  Expect<Equal<PathValue<Values, "rows.-1">, never>>,
  Expect<Equal<PathValue<Values, "rows.+1">, never>>,
  Expect<Equal<PathValue<Values, "rows.1e3">, never>>,
  Expect<Equal<PathValue<Values, "rows.1.5">, never>>,
  Expect<Equal<PathValue<Values, "rows.01.city">, never>>,
  Expect<Equal<PathValue<Values, "rows.-1.city">, never>>,
];

/** A position nobody knows yet stands for every one of them, never a wrong one. */
type UnknownIndex = [
  Expect<Equal<PathValue<Values, `rows.${number}`>, Row>>,
  Expect<Equal<PathValue<Values, `rows.${number}.city`>, string>>,
];

/** What the grammar never even offers. */
type NotAPathAtAll = [
  Expect<Equal<Extends<"rows.1_000", Path<Values>>, false>>,
  Expect<Equal<Extends<"rows.NaN", Path<Values>>, false>>,
  Expect<Equal<Extends<"rows.total", Path<Values>>, false>>,
  Expect<Equal<Extends<"pair.2", Path<Values>>, false>>,
];

/** A tuple names its positions outright, so the grammar never gets a say. */
type TuplePositions = [
  Expect<Equal<PathValue<Values, "pair.0">, Row>>,
  Expect<Equal<PathValue<Values, "pair.1">, string>>,
];

/** A key written as a number is a key, reached by the name the value holds it under. */
type NumericKeys = [
  Expect<Extends<"byYear.2026", Path<Values>>>,
  Expect<Extends<"byYear.2026.total", Path<Values>>>,
  Expect<Extends<"byYear.alias.total", Path<Values>>>,
  Expect<Equal<PathValue<Values, "byYear.2026.total">, number>>,
  Expect<Equal<PathValue<Values, "byYear.2027.total">, number>>,
  Expect<Equal<PathValue<Values, "byYear.alias.total">, number>>,
];

/** On an object the grammar does not apply: a leading zero is simply another key. */
type NumericKeysAreNotPositions = [
  Expect<Equal<Extends<"byYear.02", Path<Values>>, false>>,
  Expect<Equal<PathValue<Values, "loose.02.total">, number>>,
  Expect<Equal<PathValue<Values, "loose.-1.total">, number>>,
];

export type All = [
  CanonicalIndex,
  RefusedIndex,
  UnknownIndex,
  NotAPathAtAll,
  TuplePositions,
  NumericKeys,
  NumericKeysAreNotPositions,
];
