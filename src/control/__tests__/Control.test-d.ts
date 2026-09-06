import { FormStore } from "../../FormStore";
import type { Equal, Expect } from "../../path/__tests__/type-assertions";
import { Control, type FieldControl, type NodeControl } from "../Control";

interface InterfaceAddress {
  city: string;
  reference: string;
}

interface InterfaceClient {
  addresses: InterfaceAddress[];
  documentNumber: string;
  email: string;
  name: string;
  phones: string[];
}

interface InterfaceDetail {
  description: string;
  discount: number;
  quantity: number;
  unitPrice: number;
}

interface InterfaceForm {
  invoice: {
    client: InterfaceClient;
    createdAt: string;
    details: InterfaceDetail[];
    number: string;
    series: string;
  };
}

type InterfaceControlExpectation = Expect<Equal<Control<InterfaceForm>, NodeControl<InterfaceForm>>>;

declare const interfaceControlExpectation: InterfaceControlExpectation;

void interfaceControlExpectation;

const interfaceStore = new FormStore<InterfaceForm>({
  values: {
    invoice: {
      client: {
        addresses: [
          {
            city: "Lima",
            reference: "Frente al parque principal",
          },
        ],
        documentNumber: "12345678",
        email: "ada@example.com",
        name: "Ada Lovelace",
        phones: ["+51 999 999 999"],
      },
      createdAt: "2026-08-28T12:00:00.000Z",
      details: [
        {
          description: "Consulting service",
          discount: 10,
          quantity: 2,
          unitPrice: 120,
        },
      ],
      number: "000001",
      series: "F001",
    },
  },
});

const interfaceForm = Control.createRoot(interfaceStore);
const interfaceClient = interfaceForm.lens("invoice.client");

type InterfaceRootExpectation = Expect<Equal<typeof interfaceForm, NodeControl<InterfaceForm>>>;
type InterfaceLensExpectation = Expect<Equal<typeof interfaceClient, NodeControl<InterfaceClient>>>;

declare const interfaceRootExpectation: InterfaceRootExpectation;
declare const interfaceLensExpectation: InterfaceLensExpectation;

void interfaceRootExpectation;
void interfaceLensExpectation;

interfaceForm.register("invoice.client.name");
interfaceForm.set("invoice.client.addresses.0.city", "Arequipa");
interfaceForm.set("invoice.details.0.quantity", 3);
interfaceClient.set("email", "grace@example.com");

// @ts-expect-error the path must exist in the interface form
interfaceForm.register("invoice.client.missing");

// @ts-expect-error the value must match the interface path exactly
interfaceForm.set("invoice.details.0.quantity", "3");

type ClientValues = {
  name: string;
  contact: {
    email: string;
  };
};

type Address = {
  city: string;
  reference: string;
};

type InvoiceValues = {
  invoice: {
    client: ClientValues;
  };
};

type NodeExpectation = Expect<Equal<Control<InvoiceValues>, NodeControl<InvoiceValues>>>;
type ObjectItemExpectation = Expect<Equal<Control<Address>, NodeControl<Address>>>;
type ArrayDomainExpectation = Expect<Equal<Control<readonly Address[]>, never>>;
type ScalarArrayDomainExpectation = Expect<Equal<Control<readonly string[]>, never>>;
type NestedArrayDomainExpectation = Expect<Equal<Control<readonly (readonly string[])[]>, never>>;
type StringFieldExpectation = Expect<Equal<Control<string>, FieldControl<string>>>;
type DateFieldExpectation = Expect<Equal<Control<Date>, FieldControl<Date>>>;
type BlobFieldExpectation = Expect<Equal<Control<Blob>, FieldControl<Blob>>>;
type FileFieldExpectation = Expect<Equal<Control<File>, FieldControl<File>>>;
type FileListFieldExpectation = Expect<Equal<Control<FileList>, FieldControl<FileList>>>;
type AtomicUnionExpectation = Expect<
  Equal<Control<string | number | null | undefined>, FieldControl<string | number | null | undefined>>
>;
type NullableNodeExpectation = Expect<Equal<Control<ClientValues | null | undefined>, NodeControl<ClientValues>>>;
type MixedDomainExpectation = Expect<Equal<Control<ClientValues | string>, never>>;
type NeverExpectation = Expect<Equal<Control<never>, never>>;

declare const nodeExpectation: NodeExpectation;
declare const objectItemExpectation: ObjectItemExpectation;
declare const arrayDomainExpectation: ArrayDomainExpectation;
declare const scalarArrayDomainExpectation: ScalarArrayDomainExpectation;
declare const nestedArrayDomainExpectation: NestedArrayDomainExpectation;
declare const stringFieldExpectation: StringFieldExpectation;
declare const dateFieldExpectation: DateFieldExpectation;
declare const blobFieldExpectation: BlobFieldExpectation;
declare const fileFieldExpectation: FileFieldExpectation;
declare const fileListFieldExpectation: FileListFieldExpectation;
declare const atomicUnionExpectation: AtomicUnionExpectation;
declare const nullableNodeExpectation: NullableNodeExpectation;
declare const mixedDomainExpectation: MixedDomainExpectation;
declare const neverExpectation: NeverExpectation;

void nodeExpectation;
void objectItemExpectation;
void arrayDomainExpectation;
void scalarArrayDomainExpectation;
void nestedArrayDomainExpectation;
void stringFieldExpectation;
void dateFieldExpectation;
void blobFieldExpectation;
void fileFieldExpectation;
void fileListFieldExpectation;
void atomicUnionExpectation;
void nullableNodeExpectation;
void mixedDomainExpectation;
void neverExpectation;

declare const form: Control<InvoiceValues>;
declare const name: Control<string | null>;
declare const address: Control<Address>;
declare const arrayControl: Control<readonly Address[]>;

form.register("invoice.client.name");
form.unregister("invoice.client.contact.email");
form.set("invoice.client.name", "Grace");

const client = form.lens("invoice.client");
client.set("contact.email", "grace@example.com");

name.register();
name.unregister();
name.set("Grace");
name.set(null);

address.set("city", "Lima");

type ClientLensExpectation = Expect<Equal<typeof client, NodeControl<ClientValues>>>;

declare const clientLensExpectation: ClientLensExpectation;

void clientLensExpectation;

// @ts-expect-error node controls require a relative path to register
form.register();

// @ts-expect-error node controls require a relative path to unregister
form.unregister();

// @ts-expect-error node controls require a path before the value
form.set("Grace");

// @ts-expect-error the path must exist in the node domain
form.register("invoice.missing");

// @ts-expect-error the value must match the selected node path
form.set("invoice.client.name", 123);

// @ts-expect-error lens accepts only structural node paths
form.lens("invoice.client.name");

// @ts-expect-error field controls already contain their exact path
name.register("invoice.client.name");

// @ts-expect-error field controls already contain their exact path
name.unregister("invoice.client.name");

// @ts-expect-error field controls accept only their value
name.set("invoice.client.name", "Grace");

// @ts-expect-error field controls preserve their exact value type
name.set(123);

// @ts-expect-error field controls cannot derive another control
name.lens("anything");

// @ts-expect-error object item field values remain typed
address.set("city", 123);

// @ts-expect-error an array cannot form a control domain
arrayControl.register("0.city");

/**
 * A control carries the exact type of the location it points at, and a
 * location that only holds strings never accepted anything else. Standing in
 * for one that does would let a component write past what the form declares.
 */
declare const seriesControl: FieldControl<string>;
declare const anyOfBoth: FieldControl<string | number>;

// @ts-expect-error a control over a string is not a control that also takes numbers
const widened: FieldControl<string | number> = seriesControl;

// the other way round is safe: the field takes both, and only strings are written
const narrowed: FieldControl<string> = anyOfBoth;

void widened;
void narrowed;

/**
 * A node control is invariant where a field control is only contravariant: it
 * writes through `set` and reads through `lens`, so neither direction stands in
 * for the other without lying on one of the two.
 */
declare const narrowNode: NodeControl<{ name: string }>;
declare const wideNode: NodeControl<{ name: string | number }>;

// @ts-expect-error a control over a string field is not one whose field also takes numbers
const widenedNode: NodeControl<{ name: string | number }> = narrowNode;

// @ts-expect-error and lensing the wider one would hand back more than the narrower promises
const narrowedNode: NodeControl<{ name: string }> = wideNode;

void widenedNode;
void narrowedNode;
