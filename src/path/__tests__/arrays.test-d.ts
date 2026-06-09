import type { ArrayPath, FieldPath, NodePath, Path } from "../../index";
import type { Expect, Extends } from "./type-assertions";

type NestedArrayValues = {
  matrix: Array<
    Array<{
      value: string;
      tags: string[];
    }>
  >;
};

type OptionalArrayValues = {
  items?: {
    name: string;
    aliases: string[];
  }[];
};

type NullableArrayValues = {
  items:
    | {
        name: string;
        aliases: string[];
      }[]
    | null;
};

type ReadonlyArrayValues = {
  items: readonly {
    name: string;
    aliases: readonly string[];
  }[];
};

type NestedArrayExpectedPath =
  | "matrix"
  | `matrix.${number}`
  | `matrix.${number}.${number}`
  | `matrix.${number}.${number}.value`
  | `matrix.${number}.${number}.tags`
  | `matrix.${number}.${number}.tags.${number}`;
type NestedArrayExpectedFieldPath = `matrix.${number}.${number}.value` | `matrix.${number}.${number}.tags.${number}`;
type NestedArrayExpectedNodePath =
  | "matrix"
  | `matrix.${number}`
  | `matrix.${number}.${number}`
  | `matrix.${number}.${number}.tags`;
type NestedArrayExpectedArrayPath = "matrix" | `matrix.${number}` | `matrix.${number}.${number}.tags`;

type NestedArrayPathExpectationA = Expect<Extends<Path<NestedArrayValues>, NestedArrayExpectedPath>>;
type NestedArrayPathExpectationB = Expect<Extends<NestedArrayExpectedPath, Path<NestedArrayValues>>>;
type NestedArrayFieldPathExpectationA = Expect<Extends<FieldPath<NestedArrayValues>, NestedArrayExpectedFieldPath>>;
type NestedArrayFieldPathExpectationB = Expect<Extends<NestedArrayExpectedFieldPath, FieldPath<NestedArrayValues>>>;
type NestedArrayNodePathExpectationA = Expect<Extends<NodePath<NestedArrayValues>, NestedArrayExpectedNodePath>>;
type NestedArrayNodePathExpectationB = Expect<Extends<NestedArrayExpectedNodePath, NodePath<NestedArrayValues>>>;
type NestedArrayArrayPathExpectationA = Expect<Extends<ArrayPath<NestedArrayValues>, NestedArrayExpectedArrayPath>>;
type NestedArrayArrayPathExpectationB = Expect<Extends<NestedArrayExpectedArrayPath, ArrayPath<NestedArrayValues>>>;

type OptionalArrayExpectedPath =
  | "items"
  | `items.${number}`
  | `items.${number}.name`
  | `items.${number}.aliases`
  | `items.${number}.aliases.${number}`;
type OptionalArrayExpectedFieldPath = `items.${number}.name` | `items.${number}.aliases.${number}`;
type OptionalArrayExpectedNodePath = "items" | `items.${number}` | `items.${number}.aliases`;
type OptionalArrayExpectedArrayPath = "items" | `items.${number}.aliases`;

type OptionalArrayPathExpectationA = Expect<Extends<Path<OptionalArrayValues>, OptionalArrayExpectedPath>>;
type OptionalArrayPathExpectationB = Expect<Extends<OptionalArrayExpectedPath, Path<OptionalArrayValues>>>;
type OptionalArrayFieldPathExpectationA = Expect<
  Extends<FieldPath<OptionalArrayValues>, OptionalArrayExpectedFieldPath>
>;
type OptionalArrayFieldPathExpectationB = Expect<
  Extends<OptionalArrayExpectedFieldPath, FieldPath<OptionalArrayValues>>
>;
type OptionalArrayNodePathExpectationA = Expect<Extends<NodePath<OptionalArrayValues>, OptionalArrayExpectedNodePath>>;
type OptionalArrayNodePathExpectationB = Expect<Extends<OptionalArrayExpectedNodePath, NodePath<OptionalArrayValues>>>;
type OptionalArrayArrayPathExpectationA = Expect<
  Extends<ArrayPath<OptionalArrayValues>, OptionalArrayExpectedArrayPath>
>;
type OptionalArrayArrayPathExpectationB = Expect<
  Extends<OptionalArrayExpectedArrayPath, ArrayPath<OptionalArrayValues>>
>;

type NullableArrayExpectedPath =
  | "items"
  | `items.${number}`
  | `items.${number}.name`
  | `items.${number}.aliases`
  | `items.${number}.aliases.${number}`;
type NullableArrayExpectedFieldPath = `items.${number}.name` | `items.${number}.aliases.${number}`;
type NullableArrayExpectedNodePath = "items" | `items.${number}` | `items.${number}.aliases`;
type NullableArrayExpectedArrayPath = "items" | `items.${number}.aliases`;

type NullableArrayPathExpectationA = Expect<Extends<Path<NullableArrayValues>, NullableArrayExpectedPath>>;
type NullableArrayPathExpectationB = Expect<Extends<NullableArrayExpectedPath, Path<NullableArrayValues>>>;
type NullableArrayFieldPathExpectationA = Expect<
  Extends<FieldPath<NullableArrayValues>, NullableArrayExpectedFieldPath>
>;
type NullableArrayFieldPathExpectationB = Expect<
  Extends<NullableArrayExpectedFieldPath, FieldPath<NullableArrayValues>>
>;
type NullableArrayNodePathExpectationA = Expect<Extends<NodePath<NullableArrayValues>, NullableArrayExpectedNodePath>>;
type NullableArrayNodePathExpectationB = Expect<Extends<NullableArrayExpectedNodePath, NodePath<NullableArrayValues>>>;
type NullableArrayArrayPathExpectationA = Expect<
  Extends<ArrayPath<NullableArrayValues>, NullableArrayExpectedArrayPath>
>;
type NullableArrayArrayPathExpectationB = Expect<
  Extends<NullableArrayExpectedArrayPath, ArrayPath<NullableArrayValues>>
>;

type ReadonlyArrayExpectedPath =
  | "items"
  | `items.${number}`
  | `items.${number}.name`
  | `items.${number}.aliases`
  | `items.${number}.aliases.${number}`;
type ReadonlyArrayExpectedFieldPath = `items.${number}.name` | `items.${number}.aliases.${number}`;
type ReadonlyArrayExpectedNodePath = "items" | `items.${number}` | `items.${number}.aliases`;
type ReadonlyArrayExpectedArrayPath = "items" | `items.${number}.aliases`;

type ReadonlyArrayPathExpectationA = Expect<Extends<Path<ReadonlyArrayValues>, ReadonlyArrayExpectedPath>>;
type ReadonlyArrayPathExpectationB = Expect<Extends<ReadonlyArrayExpectedPath, Path<ReadonlyArrayValues>>>;
type ReadonlyArrayFieldPathExpectationA = Expect<
  Extends<FieldPath<ReadonlyArrayValues>, ReadonlyArrayExpectedFieldPath>
>;
type ReadonlyArrayFieldPathExpectationB = Expect<
  Extends<ReadonlyArrayExpectedFieldPath, FieldPath<ReadonlyArrayValues>>
>;
type ReadonlyArrayNodePathExpectationA = Expect<Extends<NodePath<ReadonlyArrayValues>, ReadonlyArrayExpectedNodePath>>;
type ReadonlyArrayNodePathExpectationB = Expect<Extends<ReadonlyArrayExpectedNodePath, NodePath<ReadonlyArrayValues>>>;
type ReadonlyArrayArrayPathExpectationA = Expect<
  Extends<ArrayPath<ReadonlyArrayValues>, ReadonlyArrayExpectedArrayPath>
>;
type ReadonlyArrayArrayPathExpectationB = Expect<
  Extends<ReadonlyArrayExpectedArrayPath, ArrayPath<ReadonlyArrayValues>>
>;

declare const nestedArrayPathExpectationA: NestedArrayPathExpectationA;
declare const nestedArrayPathExpectationB: NestedArrayPathExpectationB;
declare const nestedArrayFieldPathExpectationA: NestedArrayFieldPathExpectationA;
declare const nestedArrayFieldPathExpectationB: NestedArrayFieldPathExpectationB;
declare const nestedArrayNodePathExpectationA: NestedArrayNodePathExpectationA;
declare const nestedArrayNodePathExpectationB: NestedArrayNodePathExpectationB;
declare const nestedArrayArrayPathExpectationA: NestedArrayArrayPathExpectationA;
declare const nestedArrayArrayPathExpectationB: NestedArrayArrayPathExpectationB;
declare const optionalArrayPathExpectationA: OptionalArrayPathExpectationA;
declare const optionalArrayPathExpectationB: OptionalArrayPathExpectationB;
declare const optionalArrayFieldPathExpectationA: OptionalArrayFieldPathExpectationA;
declare const optionalArrayFieldPathExpectationB: OptionalArrayFieldPathExpectationB;
declare const optionalArrayNodePathExpectationA: OptionalArrayNodePathExpectationA;
declare const optionalArrayNodePathExpectationB: OptionalArrayNodePathExpectationB;
declare const optionalArrayArrayPathExpectationA: OptionalArrayArrayPathExpectationA;
declare const optionalArrayArrayPathExpectationB: OptionalArrayArrayPathExpectationB;
declare const nullableArrayPathExpectationA: NullableArrayPathExpectationA;
declare const nullableArrayPathExpectationB: NullableArrayPathExpectationB;
declare const nullableArrayFieldPathExpectationA: NullableArrayFieldPathExpectationA;
declare const nullableArrayFieldPathExpectationB: NullableArrayFieldPathExpectationB;
declare const nullableArrayNodePathExpectationA: NullableArrayNodePathExpectationA;
declare const nullableArrayNodePathExpectationB: NullableArrayNodePathExpectationB;
declare const nullableArrayArrayPathExpectationA: NullableArrayArrayPathExpectationA;
declare const nullableArrayArrayPathExpectationB: NullableArrayArrayPathExpectationB;
declare const readonlyArrayPathExpectationA: ReadonlyArrayPathExpectationA;
declare const readonlyArrayPathExpectationB: ReadonlyArrayPathExpectationB;
declare const readonlyArrayFieldPathExpectationA: ReadonlyArrayFieldPathExpectationA;
declare const readonlyArrayFieldPathExpectationB: ReadonlyArrayFieldPathExpectationB;
declare const readonlyArrayNodePathExpectationA: ReadonlyArrayNodePathExpectationA;
declare const readonlyArrayNodePathExpectationB: ReadonlyArrayNodePathExpectationB;
declare const readonlyArrayArrayPathExpectationA: ReadonlyArrayArrayPathExpectationA;
declare const readonlyArrayArrayPathExpectationB: ReadonlyArrayArrayPathExpectationB;

void nestedArrayPathExpectationA;
void nestedArrayPathExpectationB;
void nestedArrayFieldPathExpectationA;
void nestedArrayFieldPathExpectationB;
void nestedArrayNodePathExpectationA;
void nestedArrayNodePathExpectationB;
void nestedArrayArrayPathExpectationA;
void nestedArrayArrayPathExpectationB;
void optionalArrayPathExpectationA;
void optionalArrayPathExpectationB;
void optionalArrayFieldPathExpectationA;
void optionalArrayFieldPathExpectationB;
void optionalArrayNodePathExpectationA;
void optionalArrayNodePathExpectationB;
void optionalArrayArrayPathExpectationA;
void optionalArrayArrayPathExpectationB;
void nullableArrayPathExpectationA;
void nullableArrayPathExpectationB;
void nullableArrayFieldPathExpectationA;
void nullableArrayFieldPathExpectationB;
void nullableArrayNodePathExpectationA;
void nullableArrayNodePathExpectationB;
void nullableArrayArrayPathExpectationA;
void nullableArrayArrayPathExpectationB;
void readonlyArrayPathExpectationA;
void readonlyArrayPathExpectationB;
void readonlyArrayFieldPathExpectationA;
void readonlyArrayFieldPathExpectationB;
void readonlyArrayNodePathExpectationA;
void readonlyArrayNodePathExpectationB;
void readonlyArrayArrayPathExpectationA;
void readonlyArrayArrayPathExpectationB;

const matrixArrayPath: ArrayPath<NestedArrayValues> = "matrix.0";
const nestedMatrixTagsArrayPath: ArrayPath<NestedArrayValues> = "matrix.0.0.tags";
const optionalAliasesArrayPath: ArrayPath<OptionalArrayValues> = "items.0.aliases";
const nullableAliasesArrayPath: ArrayPath<NullableArrayValues> = "items.0.aliases";
const readonlyAliasesArrayPath: ArrayPath<ReadonlyArrayValues> = "items.0.aliases";

void matrixArrayPath;
void nestedMatrixTagsArrayPath;
void optionalAliasesArrayPath;
void nullableAliasesArrayPath;
void readonlyAliasesArrayPath;

