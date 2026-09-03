/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { Path } from "../../../path";
import { PathIndex } from "../../path/PathIndex";
import { type EntryId, PathKind } from "../../path/types";
import { PathRegistry } from "../../state/PathRegistry";

/** Shape of docs/FormValue.example.json. */
export type Invoice = {
  invoice: {
    createdAt: string;
    series: string;
    number: string;
    client: {
      documentNumber: string;
      name: string;
      email: string;
      phones: string[];
      addresses: { city: string; reference: string }[];
    };
    details: { description: string; quantity: number; unitPrice: number; discount: number }[];
  };
};

/** The literal value of `docs/FormValue.example.json`. */
export const sampleInvoice = (): Invoice => ({
  invoice: {
    createdAt: "2026-08-28T12:00:00.000Z",
    series: "F001",
    number: "000001",
    client: {
      documentNumber: "12345678",
      name: "Ada Lovelace",
      email: "ada@example.com",
      phones: ["+51 999 999 999", "+51 988 888 888"],
      addresses: [
        { city: "Lima", reference: "Frente al parque principal" },
        { city: "Arequipa", reference: "A dos cuadras de la plaza" },
      ],
    },
    details: [
      { description: "Consulting service", quantity: 2, unitPrice: 120, discount: 10 },
      { description: "Technical support", quantity: 1, unitPrice: 80, discount: 0 },
    ],
  },
});

/** The canonical form of `docs/FormValue.example.json`, registered for real. */
export class InvoiceStructure {
  readonly index = new PathIndex<Invoice>(new PathRegistry<Path<Invoice>>());

  readonly root = this.index.root().id;
  readonly client = this.#node("invoice.client", PathKind.Object);
  readonly email = this.#node("invoice.client.email", PathKind.Field);
  readonly name = this.#node("invoice.client.name", PathKind.Field);
  readonly addresses = this.#node("invoice.client.addresses", PathKind.Array);
  readonly address0 = this.#node("invoice.client.addresses.0", PathKind.Object);
  readonly city0 = this.#node("invoice.client.addresses.0.city", PathKind.Field);
  readonly reference0 = this.#node("invoice.client.addresses.0.reference", PathKind.Field);
  readonly address1 = this.#node("invoice.client.addresses.1", PathKind.Object);
  readonly city1 = this.#node("invoice.client.addresses.1.city", PathKind.Field);
  readonly details = this.#node("invoice.details", PathKind.Array);

  #node(path: Path<Invoice>, kind: PathKind.Object | PathKind.Array | PathKind.Field): EntryId {
    return this.index.register(path, kind).id;
  }
}
