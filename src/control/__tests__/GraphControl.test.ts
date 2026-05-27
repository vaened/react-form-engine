import { describe, expect, it, vi } from "vitest";

import type { FormStore } from "../../FormStore";
import type { Control } from "../Control";
import { GraphControl } from "../GraphControl";
import type { ControlAliasMap } from "../paths/AliasPathResolver";

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
    serial: {
      number: string;
      series: string;
    };
  };
};

type ProjectedValues = {
  client: {
    person: {
      documentNumber: string;
      name: string;
    };
  };
  person: {
    documentNumber: string;
    name: string;
  };
  serial: {
    number: string;
    series: string;
  };
};

function createStoreMock(): FormStore<InvoiceValues> & {
  register: ReturnType<typeof vi.fn>;
  unregister: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
} {
  return {
    register: vi.fn(),
    unregister: vi.fn(),
    set: vi.fn(),
  } as unknown as FormStore<InvoiceValues> & {
    register: ReturnType<typeof vi.fn>;
    unregister: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
}

describe("GraphControl", () => {
  it("passes direct paths through when created without aliases", () => {
    const store = createStoreMock();
    const control: Control<InvoiceValues> = GraphControl.from(store);

    control.register("invoice.client.person.name");
    control.unregister("invoice.serial.series");
    control.set("invoice.client.person.name", "Grace");

    expect(store.register).toHaveBeenCalledWith("invoice.client.person.name");
    expect(store.unregister).toHaveBeenCalledWith("invoice.serial.series");
    expect(store.set).toHaveBeenCalledWith("invoice.client.person.name", "Grace");
  });

  it("resolves aliased paths before calling the store", () => {
    const store = createStoreMock();
    const aliases: ControlAliasMap<ProjectedValues, InvoiceValues> = {
      client: "invoice.client",
      person: "invoice.client.person",
      serial: "invoice.serial",
    };
    const control: Control<ProjectedValues> = GraphControl.from(store, aliases);

    control.register("person.name");
    control.unregister("serial.number");
    control.set("person.documentNumber", "123");

    expect(store.register).toHaveBeenCalledWith("invoice.client.person.name");
    expect(store.unregister).toHaveBeenCalledWith("invoice.serial.number");
    expect(store.set).toHaveBeenCalledWith("invoice.client.person.documentNumber", "123");
  });

  it("composes alias projections across nested lenses", () => {
    const store = createStoreMock();
    const control: Control<ProjectedValues> = GraphControl.from(store, {
      client: "invoice.client",
      person: "invoice.client.person",
      serial: "invoice.serial",
    });

    const personFields = control.lens({
      document: "person.documentNumber",
      name: "person.name",
    });

    personFields.register("name");
    personFields.unregister("document");
    personFields.set("name", "Ada");

    expect(store.register).toHaveBeenCalledWith("invoice.client.person.name");
    expect(store.unregister).toHaveBeenCalledWith("invoice.client.person.documentNumber");
    expect(store.set).toHaveBeenCalledWith("invoice.client.person.name", "Ada");
  });

  it("keeps resolved projection aliases stable after the parent alias map changes", () => {
    const store = createStoreMock();
    const aliases: ControlAliasMap<ProjectedValues, InvoiceValues> = {
      client: "invoice.client",
      person: "invoice.client.person",
      serial: "invoice.serial",
    };
    const control: Control<ProjectedValues> = GraphControl.from(store, aliases);
    const personFields = control.lens({
      document: "person.documentNumber",
      name: "person.name",
    });

    aliases.person = "invoice.client.contact" as never;

    personFields.register("name");
    personFields.unregister("document");
    personFields.set("name", "Ada");

    expect(store.register).toHaveBeenCalledWith("invoice.client.person.name");
    expect(store.unregister).toHaveBeenCalledWith("invoice.client.person.documentNumber");
    expect(store.set).toHaveBeenCalledWith("invoice.client.person.name", "Ada");
  });

  it("focuses a subtree with lens from a direct control", () => {
    const store = createStoreMock();
    const control: Control<InvoiceValues> = GraphControl.from(store);
    const person = control.lens("invoice.client.person");

    person.register("name");
    person.unregister("documentNumber");
    person.set("name", "Grace");

    expect(store.register).toHaveBeenCalledWith("invoice.client.person.name");
    expect(store.unregister).toHaveBeenCalledWith("invoice.client.person.documentNumber");
    expect(store.set).toHaveBeenCalledWith("invoice.client.person.name", "Grace");
  });

  it("focuses a subtree with lens from an aliased control using the resolved real prefix once", () => {
    const store = createStoreMock();
    const aliases: ControlAliasMap<ProjectedValues, InvoiceValues> = {
      client: "invoice.client",
      person: "invoice.client.person",
      serial: "invoice.serial",
    };
    const control: Control<ProjectedValues> = GraphControl.from(store, aliases);
    const person = control.lens("person");

    aliases.person = "invoice.client.contact" as never;

    person.register("name");
    person.unregister("documentNumber");
    person.set("name", "Ada");

    expect(store.register).toHaveBeenCalledWith("invoice.client.person.name");
    expect(store.unregister).toHaveBeenCalledWith("invoice.client.person.documentNumber");
    expect(store.set).toHaveBeenCalledWith("invoice.client.person.name", "Ada");
  });

  it("focuses a deep subtree from an aliased control using the resolved real prefix once", () => {
    const store = createStoreMock();
    const aliases: ControlAliasMap<ProjectedValues, InvoiceValues> = {
      client: "invoice.client",
      person: "invoice.client.person",
      serial: "invoice.serial",
    };
    const control: Control<ProjectedValues> = GraphControl.from(store, aliases);
    const person = control.lens("client.person");

    aliases.client = "invoice.otherClient" as never;

    person.register("name");
    person.unregister("documentNumber");
    person.set("name", "Ada");

    expect(store.register).toHaveBeenCalledWith("invoice.client.person.name");
    expect(store.unregister).toHaveBeenCalledWith("invoice.client.person.documentNumber");
    expect(store.set).toHaveBeenCalledWith("invoice.client.person.name", "Ada");
  });

  it("allows lens chaining across nested nodes", () => {
    const store = createStoreMock();
    const control: Control<InvoiceValues> = GraphControl.from(store);
    const client = control.lens("invoice.client");
    const person = client.lens("person");

    person.register("name");
    person.unregister("documentNumber");
    person.set("name", "Grace");

    expect(store.register).toHaveBeenCalledWith("invoice.client.person.name");
    expect(store.unregister).toHaveBeenCalledWith("invoice.client.person.documentNumber");
    expect(store.set).toHaveBeenCalledWith("invoice.client.person.name", "Grace");
  });

  it("composes nested lens over lens over lens to the final real store paths", () => {
    const store = createStoreMock();
    const control: Control<InvoiceValues> = GraphControl.from(store);
    const projected = control.lens({
      client: "invoice.client",
      serial: "invoice.serial",
    });
    const personProjection = projected.lens({
      person: "client.person",
    });
    const fields = personProjection.lens({
      document: "person.documentNumber",
      name: "person.name",
    });

    fields.register("name");
    fields.unregister("document");
    fields.set("name", "Grace");

    expect(store.register).toHaveBeenCalledWith("invoice.client.person.name");
    expect(store.unregister).toHaveBeenCalledWith("invoice.client.person.documentNumber");
    expect(store.set).toHaveBeenCalledWith("invoice.client.person.name", "Grace");
  });

  it("composes lens over lens from an aliased control to the final real store paths", () => {
    const store = createStoreMock();
    const aliases: ControlAliasMap<ProjectedValues, InvoiceValues> = {
      client: "invoice.client",
      person: "invoice.client.person",
      serial: "invoice.serial",
    };
    const control: Control<ProjectedValues> = GraphControl.from(store, aliases);
    const client = control.lens("client");
    const person = client.lens("person");

    aliases.client = "invoice.otherClient" as never;

    person.register("name");
    person.unregister("documentNumber");
    person.set("name", "Grace");

    expect(store.register).toHaveBeenCalledWith("invoice.client.person.name");
    expect(store.unregister).toHaveBeenCalledWith("invoice.client.person.documentNumber");
    expect(store.set).toHaveBeenCalledWith("invoice.client.person.name", "Grace");
  });

  it("throws when a projection path is outside the current control scope", () => {
    const store = createStoreMock();
    const control: Control<ProjectedValues> = GraphControl.from(store, {
      client: "invoice.client",
      person: "invoice.client.person",
      serial: "invoice.serial",
    });

    expect(() =>
      control.lens({
        contact: "contact" as never,
      }),
    ).toThrow("Path `contact` is outside this control aliases.");
  });

  it("throws when a lens node path is outside the current control scope", () => {
    const store = createStoreMock();
    const control: Control<ProjectedValues> = GraphControl.from(store, {
      client: "invoice.client",
      person: "invoice.client.person",
      serial: "invoice.serial",
    });

    expect(() => control.lens("contact" as never)).toThrow("Path `contact` is outside this control aliases.");
  });

  it("throws when the projection is empty", () => {
    const store = createStoreMock();
    const control: Control<InvoiceValues> = GraphControl.from(store);

    expect(() => control.lens({} as never)).toThrow("Control projection cannot be empty.");
  });
});
