import { FormStore } from "../../FormStore";
import type { Equal, Expect } from "../../path/__tests__/type-assertions";
import { BoundFieldControl } from "../BoundFieldControl";
import type { FieldControl } from "../Control";

type InvoiceValues = {
  invoice: {
    amount: number;
    client: {
      name: string;
    };
  };
};

const store = new FormStore<InvoiceValues>({
  defaults: {
    invoice: {
      amount: 100,
      client: {
        name: "Ada",
      },
    },
  },
});

const name = BoundFieldControl.from(store, "invoice.client.name");
const amount = BoundFieldControl.from(store, "invoice.amount");

type NameExpectation = Expect<Equal<typeof name, BoundFieldControl<InvoiceValues, "invoice.client.name">>>;
type NameContractExpectation = Expect<Equal<typeof name extends FieldControl<string> ? true : false, true>>;
type AmountContractExpectation = Expect<Equal<typeof amount extends FieldControl<number> ? true : false, true>>;

declare const nameExpectation: NameExpectation;
declare const nameContractExpectation: NameContractExpectation;
declare const amountContractExpectation: AmountContractExpectation;

void nameExpectation;
void nameContractExpectation;
void amountContractExpectation;

name.set("Grace");
amount.set(200);

// @ts-expect-error a bound field control cannot target a structural node
BoundFieldControl.from(store, "invoice.client");

// @ts-expect-error a bound field control requires an existing field path
BoundFieldControl.from(store, "invoice.missing");

// @ts-expect-error the field path is already bound to the control
name.register("invoice.client.name");

// @ts-expect-error the field path is already bound to the control
name.unregister("invoice.client.name");

// @ts-expect-error a bound field control accepts only the field value
name.set("invoice.client.name", "Grace");

// @ts-expect-error a field control cannot derive another control
name.lens("anything");

// @ts-expect-error exact field value is string
name.set(123);

// @ts-expect-error exact field value is number
amount.set("200");
