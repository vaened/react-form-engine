/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { Equal, Expect } from "../../path/__tests__/type-assertions";
import type { PathIndex } from "./PathIndex";
import type { Split, WalkOf } from "./types";
import { PathKind } from "./types";

type Values = {
  invoice: {
    client: { name: string; addresses: { city: string }[] };
  };
};

declare const index: PathIndex<Values>;

type Segments = [
  Expect<Equal<Split<"invoice">, ["invoice"]>>,
  Expect<Equal<Split<"invoice.client.name">, ["invoice", "client", "name"]>>,
];

/** A walk spells the path it is handed in with, and nothing else compiles. */
const spellsThePath = (): void => {
  index.ensure("invoice.client.name", PathKind.Field, [
    { segment: "invoice" },
    { segment: "client" },
    { segment: "name" },
  ]);

  index.ensure("invoice.client.name", PathKind.Field, [
    { segment: "invoice", observed: PathKind.Object },
    { segment: "client", observed: PathKind.Object },
    { segment: "name", observed: PathKind.Field },
  ]);

  index.ensure("invoice.client.addresses.0.city", PathKind.Field, [
    { segment: "invoice" },
    { segment: "client" },
    { segment: "addresses", observed: PathKind.Array },
    { segment: "0" },
    { segment: "city" },
  ]);
};

const refusesAnyOtherWalk = (): void => {
  index.ensure("invoice.client.name", PathKind.Field, [
    { segment: "invoice" },
    // @ts-expect-error this walk spells another path
    { segment: "series" },
    { segment: "name" },
  ]);

  // @ts-expect-error a walk that stops short of the path
  index.ensure("invoice.client.name", PathKind.Field, [{ segment: "invoice" }, { segment: "client" }]);

  index.ensure("invoice.client", PathKind.Object, [
    { segment: "invoice" },
    { segment: "client" },
    // @ts-expect-error a walk that runs past the path
    { segment: "name" },
  ]);

  // @ts-expect-error what splitting a string gives back spells nothing in particular
  index.ensure("invoice.client.name", PathKind.Field, split);
};

declare const split: readonly { segment: string }[];

/** A position nobody knows yet still names the path it sits in. */
const takesAnUnknownPosition = (at: number): void => {
  index.ensure(`invoice.client.addresses.${at}.city`, PathKind.Field, [
    { segment: "invoice" },
    { segment: "client" },
    { segment: "addresses" },
    { segment: `${at}` },
    { segment: "city" },
  ]);
};

const walkIsOptional = (): void => {
  index.ensure("invoice.client.name", PathKind.Field);
  index.register("invoice.client.name", PathKind.Field);
};

const refusesAPathTheFormDoesNotHave = (): void => {
  // @ts-expect-error not a path of these values
  index.ensure("invoice.client.nope", PathKind.Field);
};

type Walks = [Expect<Equal<WalkOf<"a.b">, readonly [{ readonly segment: "a" }, { readonly segment: "b" }]>>];

export type All = [Segments, Walks];
export { refusesAnyOtherWalk, refusesAPathTheFormDoesNotHave, spellsThePath, takesAnUnknownPosition, walkIsOptional };
