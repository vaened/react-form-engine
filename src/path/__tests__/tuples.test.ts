import type { ArrayPath, FieldPath, NodePath, Path } from "../../index";
import type { Expect, Extends } from "./type-assertions";

type RootTupleValues = [number, { label: string }, string[]];
type RootReadonlyTupleValues = readonly [number, { label: string }, readonly string[]];

type NestedTupleValues = {
  coordinates: [[number, number], [number, number]];
  ranges: [readonly [number, number], readonly [number, number]];
};

type ReadonlyTupleValues = {
  point: readonly [number, number];
  aliases: readonly [readonly string[], readonly string[]];
};

type OptionalTupleValues = {
  point?: [number, number];
  aliases?: [string[], string[]];
};

type NullableTupleValues = {
  point: [number, number] | null;
  aliases: [string[], string[]] | null;
};

type RootTupleExpectedPath = "0" | "1" | "1.label" | "2" | `2.${number}`;
type RootTupleExpectedFieldPath = "0" | "1.label" | `2.${number}`;
type RootTupleExpectedNodePath = "1" | "2";
type RootTupleExpectedArrayPath = "2";

type RootTuplePathExpectationA = Expect<Extends<Path<RootTupleValues>, RootTupleExpectedPath>>;
type RootTuplePathExpectationB = Expect<Extends<RootTupleExpectedPath, Path<RootTupleValues>>>;
type RootTupleFieldPathExpectationA = Expect<Extends<FieldPath<RootTupleValues>, RootTupleExpectedFieldPath>>;
type RootTupleFieldPathExpectationB = Expect<Extends<RootTupleExpectedFieldPath, FieldPath<RootTupleValues>>>;
type RootTupleNodePathExpectationA = Expect<Extends<NodePath<RootTupleValues>, RootTupleExpectedNodePath>>;
type RootTupleNodePathExpectationB = Expect<Extends<RootTupleExpectedNodePath, NodePath<RootTupleValues>>>;
type RootTupleArrayPathExpectationA = Expect<Extends<ArrayPath<RootTupleValues>, RootTupleExpectedArrayPath>>;
type RootTupleArrayPathExpectationB = Expect<Extends<RootTupleExpectedArrayPath, ArrayPath<RootTupleValues>>>;

type RootReadonlyTupleExpectedPath = "0" | "1" | "1.label" | "2" | `2.${number}`;
type RootReadonlyTupleExpectedFieldPath = "0" | "1.label" | `2.${number}`;
type RootReadonlyTupleExpectedNodePath = "1" | "2";
type RootReadonlyTupleExpectedArrayPath = "2";

type RootReadonlyTuplePathExpectationA = Expect<Extends<Path<RootReadonlyTupleValues>, RootReadonlyTupleExpectedPath>>;
type RootReadonlyTuplePathExpectationB = Expect<Extends<RootReadonlyTupleExpectedPath, Path<RootReadonlyTupleValues>>>;
type RootReadonlyTupleFieldPathExpectationA = Expect<
  Extends<FieldPath<RootReadonlyTupleValues>, RootReadonlyTupleExpectedFieldPath>
>;
type RootReadonlyTupleFieldPathExpectationB = Expect<
  Extends<RootReadonlyTupleExpectedFieldPath, FieldPath<RootReadonlyTupleValues>>
>;
type RootReadonlyTupleNodePathExpectationA = Expect<
  Extends<NodePath<RootReadonlyTupleValues>, RootReadonlyTupleExpectedNodePath>
>;
type RootReadonlyTupleNodePathExpectationB = Expect<
  Extends<RootReadonlyTupleExpectedNodePath, NodePath<RootReadonlyTupleValues>>
>;
type RootReadonlyTupleArrayPathExpectationA = Expect<
  Extends<ArrayPath<RootReadonlyTupleValues>, RootReadonlyTupleExpectedArrayPath>
>;
type RootReadonlyTupleArrayPathExpectationB = Expect<
  Extends<RootReadonlyTupleExpectedArrayPath, ArrayPath<RootReadonlyTupleValues>>
>;

type NestedTupleExpectedPath =
  | "coordinates"
  | "coordinates.0"
  | "coordinates.0.0"
  | "coordinates.0.1"
  | "coordinates.1"
  | "coordinates.1.0"
  | "coordinates.1.1"
  | "ranges"
  | "ranges.0"
  | "ranges.0.0"
  | "ranges.0.1"
  | "ranges.1"
  | "ranges.1.0"
  | "ranges.1.1";
type NestedTupleExpectedFieldPath =
  | "coordinates.0.0"
  | "coordinates.0.1"
  | "coordinates.1.0"
  | "coordinates.1.1"
  | "ranges.0.0"
  | "ranges.0.1"
  | "ranges.1.0"
  | "ranges.1.1";
type NestedTupleExpectedNodePath =
  | "coordinates"
  | "coordinates.0"
  | "coordinates.1"
  | "ranges"
  | "ranges.0"
  | "ranges.1";

type NestedTuplePathExpectationA = Expect<Extends<Path<NestedTupleValues>, NestedTupleExpectedPath>>;
type NestedTuplePathExpectationB = Expect<Extends<NestedTupleExpectedPath, Path<NestedTupleValues>>>;
type NestedTupleFieldPathExpectationA = Expect<Extends<FieldPath<NestedTupleValues>, NestedTupleExpectedFieldPath>>;
type NestedTupleFieldPathExpectationB = Expect<Extends<NestedTupleExpectedFieldPath, FieldPath<NestedTupleValues>>>;
type NestedTupleNodePathExpectationA = Expect<Extends<NodePath<NestedTupleValues>, NestedTupleExpectedNodePath>>;
type NestedTupleNodePathExpectationB = Expect<Extends<NestedTupleExpectedNodePath, NodePath<NestedTupleValues>>>;
type NestedTupleArrayPathExpectation = Expect<Extends<ArrayPath<NestedTupleValues>, never>>;

type ReadonlyTupleExpectedPath =
  | "point"
  | "point.0"
  | "point.1"
  | "aliases"
  | "aliases.0"
  | `aliases.0.${number}`
  | "aliases.1"
  | `aliases.1.${number}`;
type ReadonlyTupleExpectedFieldPath = "point.0" | "point.1" | `aliases.0.${number}` | `aliases.1.${number}`;
type ReadonlyTupleExpectedNodePath = "point" | "aliases" | "aliases.0" | "aliases.1";
type ReadonlyTupleExpectedArrayPath = "aliases.0" | "aliases.1";

type ReadonlyTuplePathExpectationA = Expect<Extends<Path<ReadonlyTupleValues>, ReadonlyTupleExpectedPath>>;
type ReadonlyTuplePathExpectationB = Expect<Extends<ReadonlyTupleExpectedPath, Path<ReadonlyTupleValues>>>;
type ReadonlyTupleFieldPathExpectationA = Expect<
  Extends<FieldPath<ReadonlyTupleValues>, ReadonlyTupleExpectedFieldPath>
>;
type ReadonlyTupleFieldPathExpectationB = Expect<
  Extends<ReadonlyTupleExpectedFieldPath, FieldPath<ReadonlyTupleValues>>
>;
type ReadonlyTupleNodePathExpectationA = Expect<Extends<NodePath<ReadonlyTupleValues>, ReadonlyTupleExpectedNodePath>>;
type ReadonlyTupleNodePathExpectationB = Expect<Extends<ReadonlyTupleExpectedNodePath, NodePath<ReadonlyTupleValues>>>;
type ReadonlyTupleArrayPathExpectationA = Expect<
  Extends<ArrayPath<ReadonlyTupleValues>, ReadonlyTupleExpectedArrayPath>
>;
type ReadonlyTupleArrayPathExpectationB = Expect<
  Extends<ReadonlyTupleExpectedArrayPath, ArrayPath<ReadonlyTupleValues>>
>;

type OptionalTupleExpectedPath =
  | "point"
  | "point.0"
  | "point.1"
  | "aliases"
  | "aliases.0"
  | `aliases.0.${number}`
  | "aliases.1"
  | `aliases.1.${number}`;
type OptionalTupleExpectedFieldPath = "point.0" | "point.1" | `aliases.0.${number}` | `aliases.1.${number}`;
type OptionalTupleExpectedNodePath = "point" | "aliases" | "aliases.0" | "aliases.1";
type OptionalTupleExpectedArrayPath = "aliases.0" | "aliases.1";

type OptionalTuplePathExpectationA = Expect<Extends<Path<OptionalTupleValues>, OptionalTupleExpectedPath>>;
type OptionalTuplePathExpectationB = Expect<Extends<OptionalTupleExpectedPath, Path<OptionalTupleValues>>>;
type OptionalTupleFieldPathExpectationA = Expect<
  Extends<FieldPath<OptionalTupleValues>, OptionalTupleExpectedFieldPath>
>;
type OptionalTupleFieldPathExpectationB = Expect<
  Extends<OptionalTupleExpectedFieldPath, FieldPath<OptionalTupleValues>>
>;
type OptionalTupleNodePathExpectationA = Expect<Extends<NodePath<OptionalTupleValues>, OptionalTupleExpectedNodePath>>;
type OptionalTupleNodePathExpectationB = Expect<Extends<OptionalTupleExpectedNodePath, NodePath<OptionalTupleValues>>>;
type OptionalTupleArrayPathExpectationA = Expect<
  Extends<ArrayPath<OptionalTupleValues>, OptionalTupleExpectedArrayPath>
>;
type OptionalTupleArrayPathExpectationB = Expect<
  Extends<OptionalTupleExpectedArrayPath, ArrayPath<OptionalTupleValues>>
>;

type NullableTupleExpectedPath =
  | "point"
  | "point.0"
  | "point.1"
  | "aliases"
  | "aliases.0"
  | `aliases.0.${number}`
  | "aliases.1"
  | `aliases.1.${number}`;
type NullableTupleExpectedFieldPath = "point.0" | "point.1" | `aliases.0.${number}` | `aliases.1.${number}`;
type NullableTupleExpectedNodePath = "point" | "aliases" | "aliases.0" | "aliases.1";
type NullableTupleExpectedArrayPath = "aliases.0" | "aliases.1";

type NullableTuplePathExpectationA = Expect<Extends<Path<NullableTupleValues>, NullableTupleExpectedPath>>;
type NullableTuplePathExpectationB = Expect<Extends<NullableTupleExpectedPath, Path<NullableTupleValues>>>;
type NullableTupleFieldPathExpectationA = Expect<
  Extends<FieldPath<NullableTupleValues>, NullableTupleExpectedFieldPath>
>;
type NullableTupleFieldPathExpectationB = Expect<
  Extends<NullableTupleExpectedFieldPath, FieldPath<NullableTupleValues>>
>;
type NullableTupleNodePathExpectationA = Expect<Extends<NodePath<NullableTupleValues>, NullableTupleExpectedNodePath>>;
type NullableTupleNodePathExpectationB = Expect<Extends<NullableTupleExpectedNodePath, NodePath<NullableTupleValues>>>;
type NullableTupleArrayPathExpectationA = Expect<
  Extends<ArrayPath<NullableTupleValues>, NullableTupleExpectedArrayPath>
>;
type NullableTupleArrayPathExpectationB = Expect<
  Extends<NullableTupleExpectedArrayPath, ArrayPath<NullableTupleValues>>
>;

declare const rootTuplePathExpectationA: RootTuplePathExpectationA;
declare const rootTuplePathExpectationB: RootTuplePathExpectationB;
declare const rootTupleFieldPathExpectationA: RootTupleFieldPathExpectationA;
declare const rootTupleFieldPathExpectationB: RootTupleFieldPathExpectationB;
declare const rootTupleNodePathExpectationA: RootTupleNodePathExpectationA;
declare const rootTupleNodePathExpectationB: RootTupleNodePathExpectationB;
declare const rootTupleArrayPathExpectationA: RootTupleArrayPathExpectationA;
declare const rootTupleArrayPathExpectationB: RootTupleArrayPathExpectationB;
declare const rootReadonlyTuplePathExpectationA: RootReadonlyTuplePathExpectationA;
declare const rootReadonlyTuplePathExpectationB: RootReadonlyTuplePathExpectationB;
declare const rootReadonlyTupleFieldPathExpectationA: RootReadonlyTupleFieldPathExpectationA;
declare const rootReadonlyTupleFieldPathExpectationB: RootReadonlyTupleFieldPathExpectationB;
declare const rootReadonlyTupleNodePathExpectationA: RootReadonlyTupleNodePathExpectationA;
declare const rootReadonlyTupleNodePathExpectationB: RootReadonlyTupleNodePathExpectationB;
declare const rootReadonlyTupleArrayPathExpectationA: RootReadonlyTupleArrayPathExpectationA;
declare const rootReadonlyTupleArrayPathExpectationB: RootReadonlyTupleArrayPathExpectationB;
declare const nestedTuplePathExpectationA: NestedTuplePathExpectationA;
declare const nestedTuplePathExpectationB: NestedTuplePathExpectationB;
declare const nestedTupleFieldPathExpectationA: NestedTupleFieldPathExpectationA;
declare const nestedTupleFieldPathExpectationB: NestedTupleFieldPathExpectationB;
declare const nestedTupleNodePathExpectationA: NestedTupleNodePathExpectationA;
declare const nestedTupleNodePathExpectationB: NestedTupleNodePathExpectationB;
declare const nestedTupleArrayPathExpectation: NestedTupleArrayPathExpectation;
declare const readonlyTuplePathExpectationA: ReadonlyTuplePathExpectationA;
declare const readonlyTuplePathExpectationB: ReadonlyTuplePathExpectationB;
declare const readonlyTupleFieldPathExpectationA: ReadonlyTupleFieldPathExpectationA;
declare const readonlyTupleFieldPathExpectationB: ReadonlyTupleFieldPathExpectationB;
declare const readonlyTupleNodePathExpectationA: ReadonlyTupleNodePathExpectationA;
declare const readonlyTupleNodePathExpectationB: ReadonlyTupleNodePathExpectationB;
declare const readonlyTupleArrayPathExpectationA: ReadonlyTupleArrayPathExpectationA;
declare const readonlyTupleArrayPathExpectationB: ReadonlyTupleArrayPathExpectationB;
declare const optionalTuplePathExpectationA: OptionalTuplePathExpectationA;
declare const optionalTuplePathExpectationB: OptionalTuplePathExpectationB;
declare const optionalTupleFieldPathExpectationA: OptionalTupleFieldPathExpectationA;
declare const optionalTupleFieldPathExpectationB: OptionalTupleFieldPathExpectationB;
declare const optionalTupleNodePathExpectationA: OptionalTupleNodePathExpectationA;
declare const optionalTupleNodePathExpectationB: OptionalTupleNodePathExpectationB;
declare const optionalTupleArrayPathExpectationA: OptionalTupleArrayPathExpectationA;
declare const optionalTupleArrayPathExpectationB: OptionalTupleArrayPathExpectationB;
declare const nullableTuplePathExpectationA: NullableTuplePathExpectationA;
declare const nullableTuplePathExpectationB: NullableTuplePathExpectationB;
declare const nullableTupleFieldPathExpectationA: NullableTupleFieldPathExpectationA;
declare const nullableTupleFieldPathExpectationB: NullableTupleFieldPathExpectationB;
declare const nullableTupleNodePathExpectationA: NullableTupleNodePathExpectationA;
declare const nullableTupleNodePathExpectationB: NullableTupleNodePathExpectationB;
declare const nullableTupleArrayPathExpectationA: NullableTupleArrayPathExpectationA;
declare const nullableTupleArrayPathExpectationB: NullableTupleArrayPathExpectationB;

void rootTuplePathExpectationA;
void rootTuplePathExpectationB;
void rootTupleFieldPathExpectationA;
void rootTupleFieldPathExpectationB;
void rootTupleNodePathExpectationA;
void rootTupleNodePathExpectationB;
void rootTupleArrayPathExpectationA;
void rootTupleArrayPathExpectationB;
void rootReadonlyTuplePathExpectationA;
void rootReadonlyTuplePathExpectationB;
void rootReadonlyTupleFieldPathExpectationA;
void rootReadonlyTupleFieldPathExpectationB;
void rootReadonlyTupleNodePathExpectationA;
void rootReadonlyTupleNodePathExpectationB;
void rootReadonlyTupleArrayPathExpectationA;
void rootReadonlyTupleArrayPathExpectationB;
void nestedTuplePathExpectationA;
void nestedTuplePathExpectationB;
void nestedTupleFieldPathExpectationA;
void nestedTupleFieldPathExpectationB;
void nestedTupleNodePathExpectationA;
void nestedTupleNodePathExpectationB;
void nestedTupleArrayPathExpectation;
void readonlyTuplePathExpectationA;
void readonlyTuplePathExpectationB;
void readonlyTupleFieldPathExpectationA;
void readonlyTupleFieldPathExpectationB;
void readonlyTupleNodePathExpectationA;
void readonlyTupleNodePathExpectationB;
void readonlyTupleArrayPathExpectationA;
void readonlyTupleArrayPathExpectationB;
void optionalTuplePathExpectationA;
void optionalTuplePathExpectationB;
void optionalTupleFieldPathExpectationA;
void optionalTupleFieldPathExpectationB;
void optionalTupleNodePathExpectationA;
void optionalTupleNodePathExpectationB;
void optionalTupleArrayPathExpectationA;
void optionalTupleArrayPathExpectationB;
void nullableTuplePathExpectationA;
void nullableTuplePathExpectationB;
void nullableTupleFieldPathExpectationA;
void nullableTupleFieldPathExpectationB;
void nullableTupleNodePathExpectationA;
void nullableTupleNodePathExpectationB;
void nullableTupleArrayPathExpectationA;
void nullableTupleArrayPathExpectationB;

const rootTupleArrayPath: ArrayPath<RootTupleValues> = "2";
const rootReadonlyTupleArrayPath: ArrayPath<RootReadonlyTupleValues> = "2";
const readonlyTupleAliasesArrayPathA: ArrayPath<ReadonlyTupleValues> = "aliases.0";
const readonlyTupleAliasesArrayPathB: ArrayPath<ReadonlyTupleValues> = "aliases.1";
const optionalTupleAliasesArrayPathA: ArrayPath<OptionalTupleValues> = "aliases.0";
const optionalTupleAliasesArrayPathB: ArrayPath<OptionalTupleValues> = "aliases.1";
const nullableTupleAliasesArrayPathA: ArrayPath<NullableTupleValues> = "aliases.0";
const nullableTupleAliasesArrayPathB: ArrayPath<NullableTupleValues> = "aliases.1";

void rootTupleArrayPath;
void rootReadonlyTupleArrayPath;
void readonlyTupleAliasesArrayPathA;
void readonlyTupleAliasesArrayPathB;
void optionalTupleAliasesArrayPathA;
void optionalTupleAliasesArrayPathB;
void nullableTupleAliasesArrayPathA;
void nullableTupleAliasesArrayPathB;

// @ts-expect-error tuple nested inside tuple is not a structural array path
const invalidNestedTupleArrayPath: ArrayPath<NestedTupleValues> = "coordinates.0";

// @ts-expect-error readonly tuple itself is not a structural array path
const invalidReadonlyTupleArrayPath: ArrayPath<ReadonlyTupleValues> = "point";

// @ts-expect-error tuple index out of bounds
const invalidTupleFieldPath: FieldPath<RootTupleValues> = "3";

// @ts-expect-error nested tuple index out of bounds
const invalidNestedTupleFieldPath: FieldPath<NestedTupleValues> = "coordinates.2.0";

// @ts-expect-error optional tuple fixed node does not expose arbitrary array index
const invalidOptionalTupleArrayPath: ArrayPath<OptionalTupleValues> = "point.0";

void invalidNestedTupleArrayPath;
void invalidReadonlyTupleArrayPath;
void invalidTupleFieldPath;
void invalidNestedTupleFieldPath;
void invalidOptionalTupleArrayPath;
