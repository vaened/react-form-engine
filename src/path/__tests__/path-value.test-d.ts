import type { PathValue } from "../../index";
import type { Equal, Expect } from "./type-assertions";

type ExampleValues = {
  active: boolean;
  person: {
    name: string;
    contactInfo?: {
      phone: string;
    };
    homes: Array<{
      city: string;
      coordinates: [number, number];
      phones: string[];
    }>;
  };
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

type OptionalTupleValues = {
  point?: [number, number];
  aliases?: [string[], string[]];
};

type NullableTupleValues = {
  point: [number, number] | null;
  aliases: [string[], string[]] | null;
};

type UnionValues =
  | {
      payload: [number, string[]];
    }
  | {
      payload: { items: string[] };
    };

type ActiveValueExpectation = Expect<Equal<PathValue<ExampleValues, "active">, boolean>>;
type PersonValueExpectation = Expect<
  Equal<
    PathValue<ExampleValues, "person">,
    {
      name: string;
      contactInfo?: {
        phone: string;
      };
      homes: Array<{
        city: string;
        coordinates: [number, number];
        phones: string[];
      }>;
    }
  >
>;
type NameValueExpectation = Expect<Equal<PathValue<ExampleValues, "person.name">, string>>;
type OptionalContactValueExpectation = Expect<
  Equal<PathValue<ExampleValues, "person.contactInfo.phone">, string | undefined>
>;
type HomesValueExpectation = Expect<
  Equal<
    PathValue<ExampleValues, "person.homes">,
    Array<{
      city: string;
      coordinates: [number, number];
      phones: string[];
    }>
  >
>;
type HomeItemValueExpectation = Expect<
  Equal<
    PathValue<ExampleValues, "person.homes.0">,
    {
      city: string;
      coordinates: [number, number];
      phones: string[];
    }
  >
>;
type HomeCityValueExpectation = Expect<Equal<PathValue<ExampleValues, "person.homes.0.city">, string>>;
type HomeCoordinateValueExpectation = Expect<Equal<PathValue<ExampleValues, "person.homes.0.coordinates.1">, number>>;
type HomePhonesValueExpectation = Expect<Equal<PathValue<ExampleValues, "person.homes.0.phones">, string[]>>;
type HomePhoneItemValueExpectation = Expect<Equal<PathValue<ExampleValues, "person.homes.0.phones.0">, string>>;

type OptionalArrayValueExpectation = Expect<Equal<PathValue<OptionalArrayValues, "items.0.name">, string | undefined>>;
type OptionalArrayAliasValueExpectation = Expect<
  Equal<PathValue<OptionalArrayValues, "items.0.aliases.0">, string | undefined>
>;
type NullableArrayValueExpectation = Expect<Equal<PathValue<NullableArrayValues, "items.0.name">, string>>;
type NullableArrayAliasValueExpectation = Expect<Equal<PathValue<NullableArrayValues, "items.0.aliases.0">, string>>;

type OptionalTupleValueExpectation = Expect<Equal<PathValue<OptionalTupleValues, "point.1">, number | undefined>>;
type OptionalTupleArraySlotValueExpectation = Expect<
  Equal<PathValue<OptionalTupleValues, "aliases.0">, string[] | undefined>
>;
type OptionalTupleArrayItemValueExpectation = Expect<
  Equal<PathValue<OptionalTupleValues, "aliases.0.0">, string | undefined>
>;

type NullableTupleValueExpectation = Expect<Equal<PathValue<NullableTupleValues, "point.1">, number>>;
type NullableTupleArraySlotValueExpectation = Expect<Equal<PathValue<NullableTupleValues, "aliases.0">, string[]>>;
type NullableTupleArrayItemValueExpectation = Expect<Equal<PathValue<NullableTupleValues, "aliases.0.0">, string>>;

type UnionTupleArraySlotValueExpectation = Expect<Equal<PathValue<UnionValues, "payload.1">, string[]>>;
type UnionTupleArrayItemValueExpectation = Expect<Equal<PathValue<UnionValues, "payload.1.0">, string>>;
type UnionObjectArraySlotValueExpectation = Expect<Equal<PathValue<UnionValues, "payload.items">, string[]>>;
type UnionObjectArrayItemValueExpectation = Expect<Equal<PathValue<UnionValues, "payload.items.0">, string>>;
type UnionTupleScalarValueExpectation = Expect<Equal<PathValue<UnionValues, "payload.0">, number>>;

declare const activeValueExpectation: ActiveValueExpectation;
declare const personValueExpectation: PersonValueExpectation;
declare const nameValueExpectation: NameValueExpectation;
declare const optionalContactValueExpectation: OptionalContactValueExpectation;
declare const homesValueExpectation: HomesValueExpectation;
declare const homeItemValueExpectation: HomeItemValueExpectation;
declare const homeCityValueExpectation: HomeCityValueExpectation;
declare const homeCoordinateValueExpectation: HomeCoordinateValueExpectation;
declare const homePhonesValueExpectation: HomePhonesValueExpectation;
declare const homePhoneItemValueExpectation: HomePhoneItemValueExpectation;
declare const optionalArrayValueExpectation: OptionalArrayValueExpectation;
declare const optionalArrayAliasValueExpectation: OptionalArrayAliasValueExpectation;
declare const nullableArrayValueExpectation: NullableArrayValueExpectation;
declare const nullableArrayAliasValueExpectation: NullableArrayAliasValueExpectation;
declare const optionalTupleValueExpectation: OptionalTupleValueExpectation;
declare const optionalTupleArraySlotValueExpectation: OptionalTupleArraySlotValueExpectation;
declare const optionalTupleArrayItemValueExpectation: OptionalTupleArrayItemValueExpectation;
declare const nullableTupleValueExpectation: NullableTupleValueExpectation;
declare const nullableTupleArraySlotValueExpectation: NullableTupleArraySlotValueExpectation;
declare const nullableTupleArrayItemValueExpectation: NullableTupleArrayItemValueExpectation;
declare const unionTupleArraySlotValueExpectation: UnionTupleArraySlotValueExpectation;
declare const unionTupleArrayItemValueExpectation: UnionTupleArrayItemValueExpectation;
declare const unionObjectArraySlotValueExpectation: UnionObjectArraySlotValueExpectation;
declare const unionObjectArrayItemValueExpectation: UnionObjectArrayItemValueExpectation;
declare const unionTupleScalarValueExpectation: UnionTupleScalarValueExpectation;

void activeValueExpectation;
void personValueExpectation;
void nameValueExpectation;
void optionalContactValueExpectation;
void homesValueExpectation;
void homeItemValueExpectation;
void homeCityValueExpectation;
void homeCoordinateValueExpectation;
void homePhonesValueExpectation;
void homePhoneItemValueExpectation;
void optionalArrayValueExpectation;
void optionalArrayAliasValueExpectation;
void nullableArrayValueExpectation;
void nullableArrayAliasValueExpectation;
void optionalTupleValueExpectation;
void optionalTupleArraySlotValueExpectation;
void optionalTupleArrayItemValueExpectation;
void nullableTupleValueExpectation;
void nullableTupleArraySlotValueExpectation;
void nullableTupleArrayItemValueExpectation;
void unionTupleArraySlotValueExpectation;
void unionTupleArrayItemValueExpectation;
void unionObjectArraySlotValueExpectation;
void unionObjectArrayItemValueExpectation;
void unionTupleScalarValueExpectation;

// @ts-expect-error invalid example path
export type InvalidExamplePathValue = PathValue<ExampleValues, "person.unknown">;

// @ts-expect-error invalid union path
export type InvalidUnionPathValue = PathValue<UnionValues, "payload.2">;
