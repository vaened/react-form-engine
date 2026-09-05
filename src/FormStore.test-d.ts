/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { FormStore } from "./FormStore";

type Invoice = {
  invoice: {
    series: string;
    client: { name: string; addresses: { city: string }[] };
  };
};

const store = new FormStore<Invoice>({
  values: { invoice: { series: "F001", client: { name: "Ada", addresses: [] } } },
});

// reading is what it is for
const series: string = store.values.invoice.series;
const city: string | undefined = store.values.invoice.client.addresses[0]?.city;

void series;
void city;

// @ts-expect-error a value is changed through set, never by reaching into it
store.values.invoice.series = "F002";

// @ts-expect-error however deep it is
store.values.invoice.client.name = "Grace Hopper";

// @ts-expect-error and an array under it is no way in either
store.values.invoice.client.addresses.push({ city: "Lima" });

// @ts-expect-error the base a form compares against is not editable at all
store.defaults.invoice.series = "F002";
