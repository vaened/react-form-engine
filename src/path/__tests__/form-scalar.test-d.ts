import type {
  ArrayPath,
  ControlType,
  FieldControl,
  FieldPath,
  FormScalar,
  NodeControl,
  NodePath,
  Path,
} from "../../index";
import type { Equal, Expect, Extends } from "./type-assertions";

declare class Money {
  readonly amount: number;
  readonly currency: string;
  readonly history: { at: string; rate: number }[];
}

interface Money extends FormScalar {}

interface Client extends FormScalar {
  documentNumber: string;
  name: string;
}

interface Address {
  city: string;
  reference: string;
}

type ScalarValues = {
  total: Money;
  client: Client;
  series: string;
  addresses: Address[];
  details: { description: string; unitPrice: Money }[];
};

type ScalarExpectedPath =
  | "total"
  | "client"
  | "series"
  | "addresses"
  | `addresses.${number}`
  | `addresses.${number}.city`
  | `addresses.${number}.reference`
  | "details"
  | `details.${number}`
  | `details.${number}.description`
  | `details.${number}.unitPrice`;
type ScalarExpectedFieldPath =
  | "total"
  | "client"
  | "series"
  | `addresses.${number}.city`
  | `addresses.${number}.reference`
  | `details.${number}.description`
  | `details.${number}.unitPrice`;
type ScalarExpectedNodePath = "addresses" | `addresses.${number}` | "details" | `details.${number}`;
type ScalarExpectedArrayPath = "addresses" | "details";

type ScalarPathExpectationA = Expect<Extends<Path<ScalarValues>, ScalarExpectedPath>>;
type ScalarPathExpectationB = Expect<Extends<ScalarExpectedPath, Path<ScalarValues>>>;
type ScalarFieldPathExpectationA = Expect<Extends<FieldPath<ScalarValues>, ScalarExpectedFieldPath>>;
type ScalarFieldPathExpectationB = Expect<Extends<ScalarExpectedFieldPath, FieldPath<ScalarValues>>>;
type ScalarNodePathExpectationA = Expect<Extends<NodePath<ScalarValues>, ScalarExpectedNodePath>>;
type ScalarNodePathExpectationB = Expect<Extends<ScalarExpectedNodePath, NodePath<ScalarValues>>>;
type ScalarArrayPathExpectation = Expect<Equal<ArrayPath<ScalarValues>, ScalarExpectedArrayPath>>;

type MoneyControlExpectation = Expect<Equal<ControlType<Money>, FieldControl<Money>>>;
type ClientControlExpectation = Expect<Equal<ControlType<Client>, FieldControl<Client>>>;
type AddressControlExpectation = Expect<Equal<ControlType<Address>, NodeControl<Address>>>;
type OptionalMoneyControlExpectation = Expect<Equal<ControlType<Money | undefined>, FieldControl<Money | undefined>>>;

declare const scalarPathExpectationA: ScalarPathExpectationA;
declare const scalarPathExpectationB: ScalarPathExpectationB;
declare const scalarFieldPathExpectationA: ScalarFieldPathExpectationA;
declare const scalarFieldPathExpectationB: ScalarFieldPathExpectationB;
declare const scalarNodePathExpectationA: ScalarNodePathExpectationA;
declare const scalarNodePathExpectationB: ScalarNodePathExpectationB;
declare const scalarArrayPathExpectation: ScalarArrayPathExpectation;
declare const moneyControlExpectation: MoneyControlExpectation;
declare const clientControlExpectation: ClientControlExpectation;
declare const addressControlExpectation: AddressControlExpectation;
declare const optionalMoneyControlExpectation: OptionalMoneyControlExpectation;

void scalarPathExpectationA;
void scalarPathExpectationB;
void scalarFieldPathExpectationA;
void scalarFieldPathExpectationB;
void scalarNodePathExpectationA;
void scalarNodePathExpectationB;
void scalarArrayPathExpectation;
void moneyControlExpectation;
void clientControlExpectation;
void addressControlExpectation;
void optionalMoneyControlExpectation;

// @ts-expect-error a marked type must stay terminal
const invalidScalarPath: Path<ScalarValues> = "total.amount";

// @ts-expect-error a marked type must stay terminal inside an array item
const invalidScalarItemPath: Path<ScalarValues> = "details.0.unitPrice.currency";

// @ts-expect-error a marked interface must stay terminal
const invalidScalarFieldPath: FieldPath<ScalarValues> = "client.name";

// @ts-expect-error a marked type must not become a node
const invalidScalarNodePath: NodePath<ScalarValues> = "total";

void invalidScalarPath;
void invalidScalarItemPath;
void invalidScalarFieldPath;
void invalidScalarNodePath;

const unmarkedNodePath: NodePath<ScalarValues> = "addresses";
const unmarkedFieldPath: FieldPath<ScalarValues> = "addresses.0.city";

void unmarkedNodePath;
void unmarkedFieldPath;

declare const money: Money;
const amount: number = money.amount;
const client: Client = { documentNumber: "12345678", name: "Ada Lovelace" };

void amount;
void client;

/** The four path families read the same rule, so a collection inside a marked
 * type is no more reachable than anything else under it. */
// @ts-expect-error a collection inside a marked type is not an array path
const invalidScalarArrayPath: ArrayPath<ScalarValues> = "total.history";

// @ts-expect-error nor is one inside a marked type sitting in an array item
const invalidScalarItemArrayPath: ArrayPath<ScalarValues> = "details.0.unitPrice.history";

void invalidScalarArrayPath;
void invalidScalarItemArrayPath;
