/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { FormStore } from "./FormStore";
import type { FormScalar } from "./path";
import type { Scalar } from "./store/value/Scalar";

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

/**
 * What a watcher is handed is the type living at the path it named, absent
 * included, so nobody has to cast what they just asked for by name.
 */
const watchedSeries: string | undefined = store.snapshot("invoice.series");
const watchedClient: Invoice["invoice"]["client"] | undefined = store.snapshot("invoice.client");
const watchedDate: Date | undefined = store.snapshot("invoice.createdAt");
const watchedCity: string | undefined = store.snapshot("invoice.client.addresses.0.city");

void watchedSeries;
void watchedClient;
void watchedDate;
void watchedCity;

// @ts-expect-error a field holding a string is not handed over as a number
const wrongType: number | undefined = store.snapshot("invoice.series");
void wrongType;

// @ts-expect-error nothing lives at that path
void store.snapshot("invoice.missing");

/**
 * A field answers with what a validation found on it; a node has no such thing
 * to answer with, and the compiler is what says so.
 */
const fieldState = store.state("invoice.series");
const nodeState = store.state("invoice.client");

const seriesErrors: readonly unknown[] | undefined = fieldState?.errors;
const clientInvalid: boolean | undefined = nodeState?.isInvalid;

void seriesErrors;
void clientInvalid;

// @ts-expect-error a node derives flags from its children and never what they say
void store.state("invoice.client")?.errors;

// @ts-expect-error an array is a node, however many fields answer for it
void store.state("invoice.client.addresses")?.errors;

// a shape the types end at is a field, so it answers with its own errors
const dateErrors: readonly unknown[] | undefined = store.state("invoice.createdAt")?.errors;
void dateErrors;

/** A scalar the engine is told to hold whole has to be one the types end at too. */
class Money {
  constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}
}

interface Marked extends FormScalar {
  amount: number;
}

// @ts-expect-error nothing marked it terminal, so paths would still walk into it
declare const moneyScalar: Scalar<Money>;
declare const markedScalar: Scalar<Marked>;
declare const dayScalar: Scalar<Date>;

void moneyScalar;
void markedScalar;
void dayScalar;
