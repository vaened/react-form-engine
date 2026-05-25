import type { ArrayPath, FieldPath, NodePath, Path } from "../../index";
import type { Expect, Extends } from "./type-assertions";

type ExampleValues = {
  active: boolean;
  person: {
    name: string;
    birthdate: string;
    contactInfo: {
      phone: string;
      address: string;
    };
    homes: Array<{
      city: string;
      coordinates: [number, number];
      phones: string[];
    }>;
  };
};

type ExpectedPath =
  | "active"
  | "person"
  | "person.name"
  | "person.birthdate"
  | "person.contactInfo"
  | "person.contactInfo.phone"
  | "person.contactInfo.address"
  | "person.homes"
  | `person.homes.${number}`
  | `person.homes.${number}.city`
  | `person.homes.${number}.coordinates`
  | `person.homes.${number}.coordinates.0`
  | `person.homes.${number}.coordinates.1`
  | `person.homes.${number}.phones`
  | `person.homes.${number}.phones.${number}`;

type ExpectedFieldPath =
  | "active"
  | "person.name"
  | "person.birthdate"
  | "person.contactInfo.phone"
  | "person.contactInfo.address"
  | `person.homes.${number}.city`
  | `person.homes.${number}.coordinates.0`
  | `person.homes.${number}.coordinates.1`
  | `person.homes.${number}.phones.${number}`;

type ExpectedNodePath =
  | "person"
  | "person.contactInfo"
  | "person.homes"
  | `person.homes.${number}`
  | `person.homes.${number}.coordinates`
  | `person.homes.${number}.phones`;

type ExpectedArrayPath = "person.homes" | `person.homes.${number}.phones`;

type PathExpectationA = Expect<Extends<Path<ExampleValues>, ExpectedPath>>;
type PathExpectationB = Expect<Extends<ExpectedPath, Path<ExampleValues>>>;
type FieldPathExpectationA = Expect<Extends<FieldPath<ExampleValues>, ExpectedFieldPath>>;
type FieldPathExpectationB = Expect<Extends<ExpectedFieldPath, FieldPath<ExampleValues>>>;
type NodePathExpectationA = Expect<Extends<NodePath<ExampleValues>, ExpectedNodePath>>;
type NodePathExpectationB = Expect<Extends<ExpectedNodePath, NodePath<ExampleValues>>>;
type ArrayPathExpectationA = Expect<Extends<ArrayPath<ExampleValues>, ExpectedArrayPath>>;
type ArrayPathExpectationB = Expect<Extends<ExpectedArrayPath, ArrayPath<ExampleValues>>>;

declare const pathExpectationA: PathExpectationA;
declare const pathExpectationB: PathExpectationB;
declare const fieldPathExpectationA: FieldPathExpectationA;
declare const fieldPathExpectationB: FieldPathExpectationB;
declare const nodePathExpectationA: NodePathExpectationA;
declare const nodePathExpectationB: NodePathExpectationB;
declare const arrayPathExpectationA: ArrayPathExpectationA;
declare const arrayPathExpectationB: ArrayPathExpectationB;

void pathExpectationA;
void pathExpectationB;
void fieldPathExpectationA;
void fieldPathExpectationB;
void nodePathExpectationA;
void nodePathExpectationB;
void arrayPathExpectationA;
void arrayPathExpectationB;

const rootArrayPath: ArrayPath<ExampleValues> = "person.homes";
const nestedArrayPath: ArrayPath<ExampleValues> = "person.homes.0.phones";
const tupleNodePath: NodePath<ExampleValues> = "person.homes.0.coordinates";
const tupleFieldPathA: FieldPath<ExampleValues> = "person.homes.0.coordinates.0";
const tupleFieldPathB: FieldPath<ExampleValues> = "person.homes.0.coordinates.1";
const fieldPath: FieldPath<ExampleValues> = "person.contactInfo.phone";

void rootArrayPath;
void nestedArrayPath;
void tupleNodePath;
void tupleFieldPathA;
void tupleFieldPathB;
void fieldPath;

// @ts-expect-error not an array path
const invalidArrayPath: ArrayPath<ExampleValues> = "person.name";

// @ts-expect-error tuple is not a structural array path
const invalidTupleArrayPath: ArrayPath<ExampleValues> = "person.homes.0.coordinates";

// @ts-expect-error node path is not a field path
const invalidFieldPath: FieldPath<ExampleValues> = "person.contactInfo";

void invalidArrayPath;
void invalidTupleArrayPath;
void invalidFieldPath;
