/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { FormStore } from "./FormStore";

type Address = { city: string };

type Invoice = {
  invoice: {
    series: string;
    createdAt: Date;
    client: { name: string; addresses: Address[] };
  };
};

const store = new FormStore<Invoice>({
  defaults: { invoice: { series: "F001", createdAt: new Date(), client: { name: "Ada", addresses: [] } } },
});

// reading is what it is for
const series: string = store.values.invoice.series;
const city: string | undefined = store.values.invoice.client.addresses[0]?.city;

void series;
void city;

/**
 * A form is filled in so that what it holds can be handed to whatever it was
 * filled in for, so the value has to still be the type its owner declared —
 * every one of these is the ordinary thing to do with a form.
 */
declare function createInvoice(data: Invoice): Promise<void>;
declare function saveClient(client: Invoice["invoice"]["client"]): void;
declare function listAddresses(props: { addresses: Address[] }): unknown;
declare function formatDate(at: Date): string;

void createInvoice(store.values);
saveClient(store.values.invoice.client);
listAddresses({ addresses: store.values.invoice.client.addresses });
void formatDate(store.values.invoice.createdAt);

void createInvoice(store.defaults);
