import { describe, expect, it } from "vitest";

import type { ControlAliasMap } from "../AliasPathResolver";
import { AliasPathResolver } from "../AliasPathResolver";

type LocalValues = {
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
  person: {
    documentNumber: string;
    name: string;
  };
  serial: {
    number: string;
    series: string;
  };
};

type FormValues = {
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

describe("AliasPathResolver", () => {
  it("rejects empty alias dictionaries", () => {
    expect(() => new AliasPathResolver<LocalValues, FormValues>({})).toThrow("Control aliases cannot be empty.");
  });

  it("exposes the original alias dictionary", () => {
    const aliases = {
      person: "invoice.client.person",
      serial: "invoice.serial",
    } as const;

    const mapper = new AliasPathResolver<LocalValues, FormValues>(aliases);

    expect(mapper.aliases).toBe(aliases);
    expect(mapper.aliases).toEqual(aliases);
  });

  it("returns exact matches directly", () => {
    const mapper = new AliasPathResolver<LocalValues, FormValues>({
      person: "invoice.client.person",
      "person.name": "invoice.client.person.name",
      serial: "invoice.serial",
    });

    expect(mapper.resolve("person.name")).toBe("invoice.client.person.name");
    expect(mapper.resolve("serial")).toBe("invoice.serial");
  });

  it("resolves nested paths from the closest registered prefix", () => {
    const mapper = new AliasPathResolver<LocalValues, FormValues>({
      person: "invoice.client.person",
      serial: "invoice.serial",
    });

    expect(mapper.resolve("person.name")).toBe("invoice.client.person.name");
    expect(mapper.resolve("person.documentNumber")).toBe("invoice.client.person.documentNumber");
    expect(mapper.resolve("serial.series")).toBe("invoice.serial.series");
  });

  it("prefers the most specific registered prefix", () => {
    const mapper = new AliasPathResolver<LocalValues, FormValues>({
      client: "invoice.client",
      "client.person": "invoice.client.person",
    });

    expect(mapper.resolve("client.person.name")).toBe("invoice.client.person.name");
  });

  it("caches resolved paths after the first successful prefix lookup", () => {
    const aliases: ControlAliasMap<LocalValues, FormValues> = {
      person: "invoice.client.person",
    };
    const mapper = new AliasPathResolver<LocalValues, FormValues>(aliases);

    expect(mapper.resolve("person.name")).toBe("invoice.client.person.name");

    aliases.person = "invoice.client.contact";

    expect(mapper.resolve("person.name")).toBe("invoice.client.person.name");
    expect(mapper.resolve("person.documentNumber")).toBe("invoice.client.contact.documentNumber");
  });

  it("throws when the incoming path is outside the registered aliases", () => {
    const mapper = new AliasPathResolver<LocalValues, FormValues>({
      person: "invoice.client.person",
    });

    expect(() => mapper.resolve("serial.number")).toThrow("Path `serial.number` is outside this control aliases.");
  });
});
