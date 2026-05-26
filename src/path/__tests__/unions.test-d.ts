import type { ArrayPath, FieldPath, NodePath, Path } from "../../index";
import type { Expect, Extends } from "./type-assertions";

type UnionRootValues = { person: { name: string } } | { company: { ruc: string } };

type UnionNestedValues = {
  target: { name: string } | { id: number };
  items: string[] | null;
};

type UnionTupleArrayValues =
  | {
      payload: [number, string[]];
    }
  | {
      payload: { items: string[] };
    };

type UnionTupleObjectValues =
  | {
      payload: [number, { meta: string }];
    }
  | {
      payload: { meta: string };
    };

type UnionRootPathExpectationA = Expect<
  Extends<Path<UnionRootValues>, "person" | "person.name" | "company" | "company.ruc">
>;
type UnionRootPathExpectationB = Expect<
  Extends<"person" | "person.name" | "company" | "company.ruc", Path<UnionRootValues>>
>;
type UnionRootFieldPathExpectationA = Expect<Extends<FieldPath<UnionRootValues>, "person.name" | "company.ruc">>;
type UnionRootFieldPathExpectationB = Expect<Extends<"person.name" | "company.ruc", FieldPath<UnionRootValues>>>;

type UnionNestedExpectedPath = "target" | "target.name" | "target.id" | "items" | `items.${number}`;
type UnionNestedExpectedFieldPath = "target.name" | "target.id" | `items.${number}`;
type UnionNestedExpectedArrayPath = "items";

type UnionNestedPathExpectationA = Expect<Extends<Path<UnionNestedValues>, UnionNestedExpectedPath>>;
type UnionNestedPathExpectationB = Expect<Extends<UnionNestedExpectedPath, Path<UnionNestedValues>>>;
type UnionNestedFieldPathExpectationA = Expect<Extends<FieldPath<UnionNestedValues>, UnionNestedExpectedFieldPath>>;
type UnionNestedFieldPathExpectationB = Expect<Extends<UnionNestedExpectedFieldPath, FieldPath<UnionNestedValues>>>;
type UnionNestedArrayPathExpectationA = Expect<Extends<ArrayPath<UnionNestedValues>, UnionNestedExpectedArrayPath>>;
type UnionNestedArrayPathExpectationB = Expect<Extends<UnionNestedExpectedArrayPath, ArrayPath<UnionNestedValues>>>;

type UnionTupleArrayExpectedPath =
  | "payload"
  | "payload.0"
  | "payload.1"
  | `payload.1.${number}`
  | "payload.items"
  | `payload.items.${number}`;
type UnionTupleArrayExpectedFieldPath = "payload.0" | `payload.1.${number}` | `payload.items.${number}`;
type UnionTupleArrayExpectedNodePath = "payload" | "payload.1" | "payload.items";
type UnionTupleArrayExpectedArrayPath = "payload.1" | "payload.items";

type UnionTupleArrayPathExpectationA = Expect<Extends<Path<UnionTupleArrayValues>, UnionTupleArrayExpectedPath>>;
type UnionTupleArrayPathExpectationB = Expect<Extends<UnionTupleArrayExpectedPath, Path<UnionTupleArrayValues>>>;
type UnionTupleArrayFieldPathExpectationA = Expect<
  Extends<FieldPath<UnionTupleArrayValues>, UnionTupleArrayExpectedFieldPath>
>;
type UnionTupleArrayFieldPathExpectationB = Expect<
  Extends<UnionTupleArrayExpectedFieldPath, FieldPath<UnionTupleArrayValues>>
>;
type UnionTupleArrayNodePathExpectationA = Expect<
  Extends<NodePath<UnionTupleArrayValues>, UnionTupleArrayExpectedNodePath>
>;
type UnionTupleArrayNodePathExpectationB = Expect<
  Extends<UnionTupleArrayExpectedNodePath, NodePath<UnionTupleArrayValues>>
>;
type UnionTupleArrayArrayPathExpectationA = Expect<
  Extends<ArrayPath<UnionTupleArrayValues>, UnionTupleArrayExpectedArrayPath>
>;
type UnionTupleArrayArrayPathExpectationB = Expect<
  Extends<UnionTupleArrayExpectedArrayPath, ArrayPath<UnionTupleArrayValues>>
>;

type UnionTupleObjectExpectedPath = "payload" | "payload.0" | "payload.1" | "payload.1.meta" | "payload.meta";
type UnionTupleObjectExpectedFieldPath = "payload.0" | "payload.1.meta" | "payload.meta";
type UnionTupleObjectExpectedNodePath = "payload" | "payload.1";
type UnionTupleObjectExpectedArrayPath = never;

type UnionTupleObjectPathExpectationA = Expect<Extends<Path<UnionTupleObjectValues>, UnionTupleObjectExpectedPath>>;
type UnionTupleObjectPathExpectationB = Expect<Extends<UnionTupleObjectExpectedPath, Path<UnionTupleObjectValues>>>;
type UnionTupleObjectFieldPathExpectationA = Expect<
  Extends<FieldPath<UnionTupleObjectValues>, UnionTupleObjectExpectedFieldPath>
>;
type UnionTupleObjectFieldPathExpectationB = Expect<
  Extends<UnionTupleObjectExpectedFieldPath, FieldPath<UnionTupleObjectValues>>
>;
type UnionTupleObjectNodePathExpectationA = Expect<
  Extends<NodePath<UnionTupleObjectValues>, UnionTupleObjectExpectedNodePath>
>;
type UnionTupleObjectNodePathExpectationB = Expect<
  Extends<UnionTupleObjectExpectedNodePath, NodePath<UnionTupleObjectValues>>
>;
type UnionTupleObjectArrayPathExpectation = Expect<
  Extends<ArrayPath<UnionTupleObjectValues>, UnionTupleObjectExpectedArrayPath>
>;

declare const unionRootPathExpectationA: UnionRootPathExpectationA;
declare const unionRootPathExpectationB: UnionRootPathExpectationB;
declare const unionRootFieldPathExpectationA: UnionRootFieldPathExpectationA;
declare const unionRootFieldPathExpectationB: UnionRootFieldPathExpectationB;
declare const unionNestedPathExpectationA: UnionNestedPathExpectationA;
declare const unionNestedPathExpectationB: UnionNestedPathExpectationB;
declare const unionNestedFieldPathExpectationA: UnionNestedFieldPathExpectationA;
declare const unionNestedFieldPathExpectationB: UnionNestedFieldPathExpectationB;
declare const unionNestedArrayPathExpectationA: UnionNestedArrayPathExpectationA;
declare const unionNestedArrayPathExpectationB: UnionNestedArrayPathExpectationB;
declare const unionTupleArrayPathExpectationA: UnionTupleArrayPathExpectationA;
declare const unionTupleArrayPathExpectationB: UnionTupleArrayPathExpectationB;
declare const unionTupleArrayFieldPathExpectationA: UnionTupleArrayFieldPathExpectationA;
declare const unionTupleArrayFieldPathExpectationB: UnionTupleArrayFieldPathExpectationB;
declare const unionTupleArrayNodePathExpectationA: UnionTupleArrayNodePathExpectationA;
declare const unionTupleArrayNodePathExpectationB: UnionTupleArrayNodePathExpectationB;
declare const unionTupleArrayArrayPathExpectationA: UnionTupleArrayArrayPathExpectationA;
declare const unionTupleArrayArrayPathExpectationB: UnionTupleArrayArrayPathExpectationB;
declare const unionTupleObjectPathExpectationA: UnionTupleObjectPathExpectationA;
declare const unionTupleObjectPathExpectationB: UnionTupleObjectPathExpectationB;
declare const unionTupleObjectFieldPathExpectationA: UnionTupleObjectFieldPathExpectationA;
declare const unionTupleObjectFieldPathExpectationB: UnionTupleObjectFieldPathExpectationB;
declare const unionTupleObjectNodePathExpectationA: UnionTupleObjectNodePathExpectationA;
declare const unionTupleObjectNodePathExpectationB: UnionTupleObjectNodePathExpectationB;
declare const unionTupleObjectArrayPathExpectation: UnionTupleObjectArrayPathExpectation;

void unionRootPathExpectationA;
void unionRootPathExpectationB;
void unionRootFieldPathExpectationA;
void unionRootFieldPathExpectationB;
void unionNestedPathExpectationA;
void unionNestedPathExpectationB;
void unionNestedFieldPathExpectationA;
void unionNestedFieldPathExpectationB;
void unionNestedArrayPathExpectationA;
void unionNestedArrayPathExpectationB;
void unionTupleArrayPathExpectationA;
void unionTupleArrayPathExpectationB;
void unionTupleArrayFieldPathExpectationA;
void unionTupleArrayFieldPathExpectationB;
void unionTupleArrayNodePathExpectationA;
void unionTupleArrayNodePathExpectationB;
void unionTupleArrayArrayPathExpectationA;
void unionTupleArrayArrayPathExpectationB;
void unionTupleObjectPathExpectationA;
void unionTupleObjectPathExpectationB;
void unionTupleObjectFieldPathExpectationA;
void unionTupleObjectFieldPathExpectationB;
void unionTupleObjectNodePathExpectationA;
void unionTupleObjectNodePathExpectationB;
void unionTupleObjectArrayPathExpectation;

const unionRootPersonFieldPath: FieldPath<UnionRootValues> = "person.name";
const unionRootCompanyFieldPath: FieldPath<UnionRootValues> = "company.ruc";
const unionNestedNamePath: FieldPath<UnionNestedValues> = "target.name";
const unionNestedIdPath: FieldPath<UnionNestedValues> = "target.id";
const unionNestedItemPath: FieldPath<UnionNestedValues> = "items.0";
const unionNestedArrayPath: ArrayPath<UnionNestedValues> = "items";
const unionTupleArrayTuplePath: ArrayPath<UnionTupleArrayValues> = "payload.1";
const unionTupleArrayObjectPath: ArrayPath<UnionTupleArrayValues> = "payload.items";

void unionRootPersonFieldPath;
void unionRootCompanyFieldPath;
void unionNestedNamePath;
void unionNestedIdPath;
void unionNestedItemPath;
void unionNestedArrayPath;
void unionTupleArrayTuplePath;
void unionTupleArrayObjectPath;

// @ts-expect-error invalid root union branch path
const invalidUnionRootFieldPath: FieldPath<UnionRootValues> = "person.ruc";

// @ts-expect-error invalid nested union branch path
const invalidUnionNestedFieldPath: FieldPath<UnionNestedValues> = "target.ruc";

// @ts-expect-error tuple branch only exposes fixed tuple indices
const invalidUnionTupleArrayFieldPath: FieldPath<UnionTupleArrayValues> = "payload.2";

// @ts-expect-error tuple plus object union does not create array path from fixed tuple object branch
const invalidUnionTupleObjectArrayPath: ArrayPath<UnionTupleObjectValues> = "payload.1";

void invalidUnionRootFieldPath;
void invalidUnionNestedFieldPath;
void invalidUnionTupleArrayFieldPath;
void invalidUnionTupleObjectArrayPath;
