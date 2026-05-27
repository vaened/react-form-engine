import type { ControlType } from "../../index";
import { Control, FormStore } from "../../index";
import type { Equal, Expect } from "../../path/__tests__/type-assertions";

type InvoiceValues = {
  invoice: {
    client: {
      contact: {
        email: string;
        phone: string;
      };
      person: {
        documentNumber: string;
        name: string;
      };
    };
    createdAt: Date;
    serial: {
      number: string;
      series: string;
    };
  };
};

const store = new FormStore<InvoiceValues>({
  values: {
    invoice: {
      client: {
        contact: {
          email: "ada@example.com",
          phone: "999",
        },
        person: {
          documentNumber: "123",
          name: "Ada",
        },
      },
      createdAt: new Date(),
      serial: {
        number: "1",
        series: "F001",
      },
    },
  },
});

const form = Control.createRoot(store);

void form.lens({ holi: "invoice.client.contact" });
const projected = form.lens({
  contact: "invoice.client.contact",
  person: "invoice.client.person",
  serial: "invoice.serial",
});
const nested = form.lens({
  client: {
    contact: "invoice.client.contact",
    person: "invoice.client.person",
  },
  serial: "invoice.serial",
});
const personFields = projected.lens({
  document: "person.documentNumber",
  name: "person.name",
});
const person = projected.lens("person");

type FormExpectation = Expect<Equal<typeof form, ControlType<InvoiceValues>>>;
type ProjectedExpectation = Expect<
  Equal<
    typeof projected,
    ControlType<{
      contact: {
        email: string;
        phone: string;
      };
      person: {
        documentNumber: string;
        name: string;
      };
      serial: {
        number: string;
        series: string;
      };
    }>
  >
>;
type NestedExpectation = Expect<
  Equal<
    typeof nested,
    ControlType<{
      client: {
        contact: {
          email: string;
          phone: string;
        };
        person: {
          documentNumber: string;
          name: string;
        };
      };
      serial: {
        number: string;
        series: string;
      };
    }>
  >
>;
type PersonFieldsExpectation = Expect<
  Equal<
    typeof personFields,
    ControlType<{
      document: string;
      name: string;
    }>
  >
>;
type PersonExpectation = Expect<
  Equal<
    typeof person,
    ControlType<{
      documentNumber: string;
      name: string;
    }>
  >
>;

declare const formExpectation: FormExpectation;
declare const projectedExpectation: ProjectedExpectation;
declare const nestedExpectation: NestedExpectation;
declare const personFieldsExpectation: PersonFieldsExpectation;
declare const personExpectation: PersonExpectation;

void formExpectation;
void projectedExpectation;
void nestedExpectation;
void personFieldsExpectation;
void personExpectation;

form.register("invoice.client.person.name");
form.unregister("invoice.client.person.name");
form.set("invoice.client.person.name", "Grace");

projected.register("person.name");
projected.register("contact.phone");
projected.unregister("person.name");
projected.unregister("serial.number");
projected.set("person.name", "Grace");
projected.set("contact.phone", "111");
projected.set("serial.series", "F002");

nested.register("client.person.name");
nested.unregister("client.contact.email");
nested.set("client.person.name", "Grace");
nested.set("client.contact.email", "grace@example.com");

personFields.register("name");
personFields.unregister("document");
personFields.set("name", "Grace");
personFields.set("document", "456");

person.register("name");
person.unregister("documentNumber");
person.set("name", "Grace");
person.set("documentNumber", "456");

// @ts-expect-error projected control does not expose full global path
projected.register("invoice.client.person.name");

// @ts-expect-error projected control does not expose full global path
projected.unregister("invoice.client.person.name");

// @ts-expect-error nested projection requires client prefix
nested.register("person.name");

// @ts-expect-error nested projection requires client prefix
nested.unregister("person.name");

// @ts-expect-error remapped projected control only exposes aliases
personFields.register("person.name");

// @ts-expect-error remapped projected control only exposes aliases
personFields.unregister("person.name");

// @ts-expect-error focused control only exposes subtree paths
person.register("person.name");

// @ts-expect-error focused control only exposes subtree paths
person.unregister("person.name");

// @ts-expect-error projected control does not expose full global path
projected.set("invoice.client.person.name", "Grace");

// @ts-expect-error nested projection requires client prefix
nested.set("person.name", "Grace");

// @ts-expect-error remapped projected control only exposes aliases
personFields.set("person.name", "Grace");

// @ts-expect-error focused control only exposes subtree paths
person.set("person.name", "Grace");

// @ts-expect-error wrong value type
projected.set("serial.number", 123);

// @ts-expect-error lens only accepts node paths
projected.lens("person.name");
