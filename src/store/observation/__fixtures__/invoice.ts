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

/**
 * The canonical form, registered for real.
 *
 * The chain now reads the shape instead of being handed made-up parents, so the
 * ids have to come from somewhere that actually knows what is inside what.
 */
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
