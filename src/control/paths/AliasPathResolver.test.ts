import { describe, expect, it, vi } from "vitest";
import type { Path } from "../../path";
import type { PathId, PathIdentifier } from "../../store/state/PathRegistry";
import { PathRegistry } from "../../store/state/PathRegistry";
import type { ControlAliasMap } from "./AliasPathResolver";
import { AliasPathResolver } from "./AliasPathResolver";

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

function createIdentifierMock(): PathIdentifier<Path<FormValues>> & {
  register: ReturnType<typeof vi.fn>;
  identify: ReturnType<typeof vi.fn>;
  describe: ReturnType<typeof vi.fn>;
} {
  const pathId = 1 as PathId<Path<FormValues>>;
  const register = vi.fn(() => pathId);
  const identify = vi.fn(() => pathId);
  const describe = vi.fn(() => "invoice.client.person.name" as Path<FormValues>);

  return {
    register,
    identify,
    describe,
  };
}

describe("AliasPathResolver", () => {
  it("rejects empty alias dictionaries", () => {
    expect(() => new AliasPathResolver<LocalValues, FormValues>(new PathRegistry<Path<FormValues>>(), {})).toThrow(
      "Control aliases cannot be empty.",
    );
  });

  it("exposes the original alias dictionary", () => {
    const aliases = {
      person: "invoice.client.person",
      serial: "invoice.serial",
    } as const;

    const mapper = new AliasPathResolver<LocalValues, FormValues>(new PathRegistry<Path<FormValues>>(), aliases);

    expect(mapper.aliases).toBe(aliases);
    expect(mapper.aliases).toEqual(aliases);
  });

  it("returns exact matches directly", () => {
    const mapper = new AliasPathResolver<LocalValues, FormValues>(new PathRegistry<Path<FormValues>>(), {
      person: "invoice.client.person",
      "person.name": "invoice.client.person.name",
      serial: "invoice.serial",
    });

    expect(mapper.resolve("person.name")).toBe("invoice.client.person.name");
    expect(mapper.resolve("serial")).toBe("invoice.serial");
  });

  it("registers the resolved exact path in the identifier", () => {
    const identifier = createIdentifierMock();
    const mapper = new AliasPathResolver<LocalValues, FormValues>(identifier, {
      person: "invoice.client.person",
      "person.name": "invoice.client.person.name",
    });

    expect(mapper.resolve("person.name")).toBe("invoice.client.person.name");

    expect(identifier.register).toHaveBeenCalledTimes(1);
    expect(identifier.register).toHaveBeenCalledWith("invoice.client.person.name");
    expect(identifier.describe).not.toHaveBeenCalled();
  });

  it("resolves nested paths from the closest registered prefix", () => {
    const mapper = new AliasPathResolver<LocalValues, FormValues>(new PathRegistry<Path<FormValues>>(), {
      person: "invoice.client.person",
      serial: "invoice.serial",
    });

    expect(mapper.resolve("person.name")).toBe("invoice.client.person.name");
    expect(mapper.resolve("person.documentNumber")).toBe("invoice.client.person.documentNumber");
    expect(mapper.resolve("serial.series")).toBe("invoice.serial.series");
  });

  it("prefers the most specific registered prefix", () => {
    const mapper = new AliasPathResolver<LocalValues, FormValues>(new PathRegistry<Path<FormValues>>(), {
      client: "invoice.client",
      "client.person": "invoice.client.person",
    });

    expect(mapper.resolve("client.person.name")).toBe("invoice.client.person.name");
  });

  it("caches resolved paths after the first successful prefix lookup", () => {
    const aliases: ControlAliasMap<LocalValues, FormValues> = {
      person: "invoice.client.person",
    };
    const mapper = new AliasPathResolver<LocalValues, FormValues>(new PathRegistry<Path<FormValues>>(), aliases);

    expect(mapper.resolve("person.name")).toBe("invoice.client.person.name");

    aliases.person = "invoice.client.contact";

    expect(mapper.resolve("person.name")).toBe("invoice.client.person.name");
    expect(mapper.resolve("person.documentNumber")).toBe("invoice.client.contact.documentNumber");
  });

  it("returns cached paths through describe without recomputing the alias", () => {
    const identifier = createIdentifierMock();
    const aliases: ControlAliasMap<LocalValues, FormValues> = {
      person: "invoice.client.person",
    };
    const mapper = new AliasPathResolver<LocalValues, FormValues>(identifier, aliases);

    expect(mapper.resolve("person.name")).toBe("invoice.client.person.name");

    aliases.person = "invoice.client.contact";

    expect(mapper.resolve("person.name")).toBe("invoice.client.person.name");
    expect(identifier.register).toHaveBeenCalledTimes(1);
    expect(identifier.register).toHaveBeenCalledWith("invoice.client.person.name");
    expect(identifier.describe).toHaveBeenCalledTimes(1);
    expect(identifier.describe).toHaveBeenCalledWith(1 as PathId<Path<FormValues>>);
  });

  it("registers the composed real path after resolving a prefix alias", () => {
    const identifier = createIdentifierMock();
    const mapper = new AliasPathResolver<LocalValues, FormValues>(identifier, {
      person: "invoice.client.person",
    });

    expect(mapper.resolve("person.documentNumber")).toBe("invoice.client.person.documentNumber");

    expect(identifier.register).toHaveBeenCalledTimes(1);
    expect(identifier.register).toHaveBeenCalledWith("invoice.client.person.documentNumber");
  });

  it("throws when the incoming path is outside the registered aliases", () => {
    const mapper = new AliasPathResolver<LocalValues, FormValues>(new PathRegistry<Path<FormValues>>(), {
      person: "invoice.client.person",
    });

    expect(() => mapper.resolve("serial.number")).toThrow("Path `serial.number` is outside this control aliases.");
  });
});
