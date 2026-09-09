import { describe, expect, it, vi } from "vitest";

import type { FormStore } from "../../FormStore";
import type { Path } from "../../path";
import { PathRegistry } from "../../store/state/PathRegistry";
import type { Control } from "../Control";
import { EmptyProjection, OverlappingAlias, PathOutsideControl } from "../errors";
import { MappedNodeControl } from "../MappedNodeControl";
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

type StoreMock = FormStore<InvoiceValues> & {
  identifier: PathRegistry<Path<InvoiceValues>>;
  register: ReturnType<typeof vi.fn>;
  unregister: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  assign: ReturnType<typeof vi.fn>;
};

function createStoreMock(): StoreMock {
  return {
    identifier: new PathRegistry<Path<InvoiceValues>>(),
    register: vi.fn(),
    unregister: vi.fn(),
    set: vi.fn(),
    assign: vi.fn(),
  } as StoreMock;
}

describe("MappedNodeControl", () => {
  it("passes direct paths through when created without aliases", () => {
    const store = createStoreMock();
    const control: Control<InvoiceValues> = MappedNodeControl.from(store);

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
    const control: Control<ProjectedValues> = MappedNodeControl.from(store, aliases);

    control.register("person.name");
    control.unregister("serial.number");
    control.set("person.documentNumber", "123");

    expect(store.register).toHaveBeenCalledWith("invoice.client.person.name");
    expect(store.unregister).toHaveBeenCalledWith("invoice.serial.number");
    expect(store.set).toHaveBeenCalledWith("invoice.client.person.documentNumber", "123");
  });

  it("composes alias projections across nested lenses", () => {
    const store = createStoreMock();
    const control: Control<ProjectedValues> = MappedNodeControl.from(store, {
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
    const control: Control<ProjectedValues> = MappedNodeControl.from(store, aliases);
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
    const control: Control<InvoiceValues> = MappedNodeControl.from(store);
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
    const control: Control<ProjectedValues> = MappedNodeControl.from(store, aliases);
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
    const control: Control<ProjectedValues> = MappedNodeControl.from(store, aliases);
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
    const control: Control<InvoiceValues> = MappedNodeControl.from(store);
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
    const control: Control<InvoiceValues> = MappedNodeControl.from(store);
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
    const control: Control<ProjectedValues> = MappedNodeControl.from(store, aliases);
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

  describe("a projection that renames, rather than a window onto one prefix", () => {
    /** The recursive half of a projection: a local group whose members come
     * from unrelated places in the form. */
    it("builds a dotted local path for every level the projection nests", () => {
      const store = createStoreMock();
      const control: Control<InvoiceValues> = MappedNodeControl.from(store);

      const projected = control.lens({
        person: { name: "invoice.client.person.name", code: "invoice.serial.series" },
      });

      projected.set("person.name", "Ada");
      projected.set("person.code", "F001");

      expect(store.set).toHaveBeenCalledWith("invoice.client.person.name", "Ada");
      expect(store.set).toHaveBeenCalledWith("invoice.serial.series", "F001");
    });

    it("focuses a group the projection invented, whose members have no shared real prefix", () => {
      const store = createStoreMock();
      const control: Control<InvoiceValues> = MappedNodeControl.from(store);

      const projected = control.lens({
        person: { name: "invoice.client.person.name", code: "invoice.serial.series" },
      });

      const person = projected.lens("person");

      person.set("name", "Ada");
      person.set("code", "F001");

      expect(store.set).toHaveBeenCalledWith("invoice.client.person.name", "Ada");
      expect(store.set).toHaveBeenCalledWith("invoice.serial.series", "F001");
    });

    it("refuses a map where a name both stands for a place and holds others", () => {
      const store = createStoreMock();
      const aliases: ControlAliasMap<ProjectedValues, InvoiceValues> = {
        person: "invoice.client.person",
        "person.name": "invoice.serial.series",
      };

      expect(() => MappedNodeControl.from(store, aliases)).toThrow(OverlappingAlias);
    });

    it("nests a group inside a group", () => {
      const store = createStoreMock();
      const control: Control<InvoiceValues> = MappedNodeControl.from(store);

      const projected = control.lens({
        client: { person: { name: "invoice.client.person.name" }, mail: "invoice.client.contact.email" },
      });

      projected.lens("client").lens("person").set("name", "Ada");
      projected.lens("client").set("mail", "ada@example.com");

      expect(store.set).toHaveBeenCalledWith("invoice.client.person.name", "Ada");
      expect(store.set).toHaveBeenCalledWith("invoice.client.contact.email", "ada@example.com");
    });
  });

  describe("operating on a name the projection only groups", () => {
    it("sets each member where its own alias points", () => {
      const store = createStoreMock();
      const control: Control<InvoiceValues> = MappedNodeControl.from(store);

      const projected = control.lens({
        card: { who: "invoice.client.person.name", serie: "invoice.serial.series" },
      });

      projected.set("card", { who: "Ada", serie: "F001" });

      expect(store.assign).toHaveBeenCalledWith({
        "invoice.client.person.name": "Ada",
        "invoice.serial.series": "F001",
      });
    });

    it("leaves alone what the value never names", () => {
      const store = createStoreMock();
      const control: Control<InvoiceValues> = MappedNodeControl.from(store);

      const projected = control.lens({
        card: { who: "invoice.client.person.name", serie: "invoice.serial.series" },
      });

      projected.set("card", { who: "Ada" } as never);

      expect(store.assign).toHaveBeenCalledWith({ "invoice.client.person.name": "Ada" });
    });

    it("stops at an alias instead of opening the value under it", () => {
      const store = createStoreMock();
      const control: Control<InvoiceValues> = MappedNodeControl.from(store);
      const person = { documentNumber: "12345678", name: "Ada" };

      const projected = control.lens({ card: { whole: "invoice.client.person" } });

      projected.set("card", { whole: person });

      expect(store.assign).toHaveBeenCalledWith({ "invoice.client.person": person });
    });

    it("refuses the same map when it reaches the control through a projection", () => {
      const store = createStoreMock();
      const control: Control<InvoiceValues> = MappedNodeControl.from(store);

      expect(() =>
        control.lens({
          person: "invoice.client.person",
          "person.name": "invoice.serial.series",
        } as never),
      ).toThrow(OverlappingAlias);
    });

    it("registers and unregisters every member the name groups", () => {
      const store = createStoreMock();
      const control: Control<InvoiceValues> = MappedNodeControl.from(store);

      const projected = control.lens({
        card: { who: "invoice.client.person.name", serie: "invoice.serial.series" },
      });

      projected.register("card");
      projected.unregister("card");

      expect(store.register).toHaveBeenCalledWith("invoice.client.person.name");
      expect(store.register).toHaveBeenCalledWith("invoice.serial.series");
      expect(store.unregister).toHaveBeenCalledWith("invoice.client.person.name");
      expect(store.unregister).toHaveBeenCalledWith("invoice.serial.series");
      expect(store.register).toHaveBeenCalledTimes(2);
    });

    it("still writes a single path when the name is a plain alias", () => {
      const store = createStoreMock();
      const aliases: ControlAliasMap<ProjectedValues, InvoiceValues> = { person: "invoice.client.person" };
      const control: Control<ProjectedValues> = MappedNodeControl.from(store, aliases);
      const person = { documentNumber: "12345678", name: "Ada" };

      control.set("person", person);
      control.register("person");

      expect(store.set).toHaveBeenCalledWith("invoice.client.person", person);
      expect(store.set).toHaveBeenCalledTimes(1);
      expect(store.register).toHaveBeenCalledWith("invoice.client.person");
      expect(store.register).toHaveBeenCalledTimes(1);
    });

    /** The map is flat, so a name reaches every descendant of the projection and
     * not only the members written right under it. */
    /** One change spread over places that have nothing to do with each other is
     * one change, and the store is told so. */
    it("hands a group to the store as a single assignment", () => {
      const store = createStoreMock();
      const control: Control<InvoiceValues> = MappedNodeControl.from(store);
      const projected = control.lens({
        card: { who: "invoice.client.person.name", serie: "invoice.serial.series" },
      });

      projected.set("card", { who: "Ada", serie: "F001" });

      expect(store.assign).toHaveBeenCalledTimes(1);
      expect(store.assign).toHaveBeenCalledWith({
        "invoice.client.person.name": "Ada",
        "invoice.serial.series": "F001",
      });
      expect(store.set).not.toHaveBeenCalled();
    });

    /** A name that stands for one place is one write, and asking the store to
     * batch it would only build an object to take it apart again. */
    it("writes a plain alias with a single set, not an assignment", () => {
      const store = createStoreMock();
      const aliases: ControlAliasMap<ProjectedValues, InvoiceValues> = { person: "invoice.client.person" };
      const control: Control<ProjectedValues> = MappedNodeControl.from(store, aliases);

      control.set("person.name", "Ada");

      expect(store.set).toHaveBeenCalledWith("invoice.client.person.name", "Ada");
      expect(store.assign).not.toHaveBeenCalled();
    });

    it("reaches every leaf of a group nested three levels deep", () => {
      const store = createStoreMock();
      const control: Control<InvoiceValues> = MappedNodeControl.from(store);
      const projected = control.lens({
        a: { b: { c: "invoice.client.person.name", d: "invoice.serial.series" }, e: "invoice.serial.number" },
      });

      projected.set("a", { b: { c: "Ada", d: "F001" }, e: "000001" });
      projected.register("a");

      expect(Object.entries(store.assign.mock.calls[0][0])).toEqual([
        ["invoice.client.person.name", "Ada"],
        ["invoice.serial.series", "F001"],
        ["invoice.serial.number", "000001"],
      ]);
      expect(store.register.mock.calls).toEqual([
        ["invoice.client.person.name"],
        ["invoice.serial.series"],
        ["invoice.serial.number"],
      ]);
    });

    it("reaches only its own leaves from a group in the middle", () => {
      const store = createStoreMock();
      const control: Control<InvoiceValues> = MappedNodeControl.from(store);
      const projected = control.lens({
        a: { b: { c: "invoice.client.person.name", d: "invoice.serial.series" }, e: "invoice.serial.number" },
      });

      projected.set("a.b", { c: "Ada", d: "F001" });
      projected.register("a.b");

      expect(Object.entries(store.assign.mock.calls[0][0])).toEqual([
        ["invoice.client.person.name", "Ada"],
        ["invoice.serial.series", "F001"],
      ]);
      expect(store.register.mock.calls).toEqual([["invoice.client.person.name"], ["invoice.serial.series"]]);
    });

    it("refuses to write a value that cannot be opened into the members", () => {
      const store = createStoreMock();
      const control: Control<InvoiceValues> = MappedNodeControl.from(store);
      const projected = control.lens({ card: { who: "invoice.client.person.name" } });

      expect(() => projected.set("card" as never, "Ada" as never)).toThrow(PathOutsideControl);
      // the group itself is refused, not some position the string was taken apart into
      expect(() => projected.set("card" as never, "Ada" as never)).toThrow("`card` is outside");
      expect(store.set).not.toHaveBeenCalled();
    });

    /** A list has positions, not names, so nothing in it answers to a member. */
    it("refuses a list where the members are expected", () => {
      const store = createStoreMock();
      const control: Control<InvoiceValues> = MappedNodeControl.from(store);
      const projected = control.lens({ card: { who: "invoice.client.person.name" } });

      expect(() => projected.set("card" as never, ["Ada"] as never)).toThrow(PathOutsideControl);
      expect(() => projected.set("card" as never, ["Ada"] as never)).toThrow("`card` is outside");
      expect(store.set).not.toHaveBeenCalled();
    });

    it("refuses a name the map does not cover, however the value looks", () => {
      const store = createStoreMock();
      const control: Control<InvoiceValues> = MappedNodeControl.from(store);
      const projected = control.lens({ card: { who: "invoice.client.person.name" } });

      expect(() => projected.set("card" as never, { nope: 1 } as never)).toThrow();
      expect(() => projected.register("nope" as never)).toThrow();
    });
  });

  it("throws when a projection path is outside the current control scope", () => {
    const store = createStoreMock();
    const control: Control<ProjectedValues> = MappedNodeControl.from(store, {
      client: "invoice.client",
      person: "invoice.client.person",
      serial: "invoice.serial",
    });

    expect(() =>
      control.lens({
        contact: "contact" as never,
      }),
    ).toThrow(PathOutsideControl);
  });

  it("throws when a lens node path is outside the current control scope", () => {
    const store = createStoreMock();
    const control: Control<ProjectedValues> = MappedNodeControl.from(store, {
      client: "invoice.client",
      person: "invoice.client.person",
      serial: "invoice.serial",
    });

    expect(() => control.lens("contact" as never)).toThrow(PathOutsideControl);
  });

  it("throws when the projection is empty", () => {
    const store = createStoreMock();
    const control: Control<InvoiceValues> = MappedNodeControl.from(store);

    expect(() => control.lens({} as never)).toThrow(EmptyProjection);
  });
});
