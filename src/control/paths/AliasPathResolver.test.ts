import { describe, expect, it, vi } from "vitest";
import type { Path } from "../../path";
import type { PathId, PathIdentifier } from "../../store/state/PathRegistry";
import { PathRegistry } from "../../store/state/PathRegistry";
import { OverlappingAlias } from "../errors";
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
  resolve: ReturnType<typeof vi.fn>;
  identify: ReturnType<typeof vi.fn>;
  describe: ReturnType<typeof vi.fn>;
  rootId: PathId<Path<FormValues>>;
} {
  const pathId = 1 as PathId<Path<FormValues>>;
  const register = vi.fn(() => pathId);
  const resolve = vi.fn(() => pathId);
  const identify = vi.fn(() => pathId);
  const describe = vi.fn(() => "invoice.client.person.name" as Path<FormValues>);

  return {
    rootId: 0 as PathId<Path<FormValues>>,
    register,
    resolve,
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
      "person.name": "invoice.client.person.name",
      serial: "invoice.serial",
    });

    expect(mapper.resolve("person.name")).toBe("invoice.client.person.name");
    expect(mapper.resolve("serial")).toBe("invoice.serial");
  });

  it("registers the resolved exact path in the identifier", () => {
    const identifier = createIdentifierMock();
    const mapper = new AliasPathResolver<LocalValues, FormValues>(identifier, {
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
      serial: "invoice.serial",
    };
    const mapper = new AliasPathResolver<LocalValues, FormValues>(identifier, aliases);

    expect(mapper.resolve("person.name")).toBe("invoice.client.person.name");
    expect(mapper.resolve("serial.number")).toBe("invoice.serial.number");

    aliases.person = "invoice.client.contact";

    expect(mapper.resolve("person.name")).toBe("invoice.client.person.name");
    expect(identifier.register).toHaveBeenCalledTimes(2);
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

    expect(() => mapper.resolve("serial.number")).toThrow("is outside this control aliases");
  });
});

describe("AliasPathResolver overrides", () => {
  const registry = () => new PathRegistry<Path<FormValues>>();

  it("refuses a name that hangs from another name of the map", () => {
    expect(
      () =>
        new AliasPathResolver<LocalValues, FormValues>(registry(), {
          person: "invoice.client.person",
          "person.name": "invoice.serial.series",
        }),
    ).toThrow(OverlappingAlias);
  });

  it("refuses it however deep the two names sit", () => {
    expect(
      () =>
        new AliasPathResolver<LocalValues, FormValues>(registry(), {
          "client.person": "invoice.client.person",
          "client.person.name": "invoice.serial.series",
        } as ControlAliasMap<LocalValues, FormValues>),
    ).toThrow(OverlappingAlias);
  });

  it("refuses it whichever of the two was written first", () => {
    expect(
      () =>
        new AliasPathResolver<LocalValues, FormValues>(registry(), {
          "person.name": "invoice.serial.series",
          person: "invoice.client.person",
        }),
    ).toThrow(OverlappingAlias);
  });

  it("allows names that merely share a holder", () => {
    expect(
      () =>
        new AliasPathResolver<LocalValues, FormValues>(registry(), {
          "person.name": "invoice.client.person.name",
          "person.documentNumber": "invoice.serial.number",
        }),
    ).not.toThrow();
  });

  it("allows a name that only looks like a prefix of another", () => {
    expect(
      () =>
        new AliasPathResolver<LocalValues, FormValues>(registry(), {
          person: "invoice.client.person",
          personal: "invoice.serial",
        } as ControlAliasMap<LocalValues, FormValues>),
    ).not.toThrow();
  });
});

describe("AliasPathResolver repeated questions", () => {
  /** Typing into one field asks for the same name over and over, so the last
   * answer is kept whole rather than rebuilt from its identity. */
  it("answers the same name again without going through the identifier", () => {
    const identifier = createIdentifierMock();
    const resolver = new AliasPathResolver<LocalValues, FormValues>(identifier, {
      person: "invoice.client.person",
    });

    resolver.resolve("person.name");
    identifier.describe.mockClear();

    expect(resolver.resolve("person.name")).toBe("invoice.client.person.name");
    expect(identifier.describe).not.toHaveBeenCalled();
  });

  it("goes back through the identifier once another name is asked in between", () => {
    const identifier = createIdentifierMock();
    const resolver = new AliasPathResolver<LocalValues, FormValues>(identifier, {
      person: "invoice.client.person",
    });

    resolver.resolve("person.name");
    resolver.resolve("person.documentNumber");
    identifier.describe.mockClear();

    resolver.resolve("person.name");

    expect(identifier.describe).toHaveBeenCalledTimes(1);
  });
});

describe("AliasPathResolver reach", () => {
  const registry = () => new PathRegistry<Path<FormValues>>();

  it("answers alias for a name nothing hangs from", () => {
    const resolver = new AliasPathResolver<LocalValues, FormValues>(registry(), {
      person: "invoice.client.person",
    });

    expect(resolver.reach("person")).toEqual({ kind: "alias", path: "invoice.client.person" });
  });

  it("answers alias for a name reached through a registered prefix", () => {
    const resolver = new AliasPathResolver<LocalValues, FormValues>(registry(), {
      person: "invoice.client.person",
    });

    expect(resolver.reach("person.name")).toEqual({ kind: "alias", path: "invoice.client.person.name" });
  });

  it("answers group for a name the map only holds others under", () => {
    const resolver = new AliasPathResolver<LocalValues, FormValues>(registry(), {
      "person.name": "invoice.client.person.name",
      "person.documentNumber": "invoice.serial.number",
    });

    expect(resolver.reach("person")).toEqual({
      kind: "group",
      members: ["person.name", "person.documentNumber"],
    });
  });

  it("holds names at every depth, not only the ones written right under", () => {
    const resolver = new AliasPathResolver<LocalValues, FormValues>(registry(), {
      "client.person.name": "invoice.client.person.name",
      "client.contact.email": "invoice.client.contact.email",
      "client.person.documentNumber": "invoice.serial.number",
    } as ControlAliasMap<LocalValues, FormValues>);

    expect(resolver.reach("client")).toEqual({
      kind: "group",
      members: ["client.person.name", "client.contact.email", "client.person.documentNumber"],
    });
    expect(resolver.reach("client.person")).toEqual({
      kind: "group",
      members: ["client.person.name", "client.person.documentNumber"],
    });
    expect(resolver.reach("client.contact")).toEqual({
      kind: "group",
      members: ["client.contact.email"],
    });
  });

  it("refuses a name the map neither answers for nor holds others under", () => {
    const resolver = new AliasPathResolver<LocalValues, FormValues>(registry(), {
      person: "invoice.client.person",
    });

    expect(() => resolver.reach("serial")).toThrow("is outside this control aliases");
  });
});

describe("AliasPathResolver scope", () => {
  const registry = () => new PathRegistry<Path<FormValues>>();

  it("inherits the names hanging from the one it narrows to, without the prefix", () => {
    const resolver = new AliasPathResolver<LocalValues, FormValues>(registry(), {
      "person.name": "invoice.client.person.name",
      "person.documentNumber": "invoice.serial.number",
      "serial.series": "invoice.serial.series",
    } as ControlAliasMap<LocalValues, FormValues>);

    const narrowed = resolver.scope<LocalValues["person"]>("person");

    expect(narrowed.resolve("name")).toBe("invoice.client.person.name");
    expect(narrowed.resolve("documentNumber")).toBe("invoice.serial.number");
  });

  it("remembers the place it was narrowed beneath for whatever it did not inherit", () => {
    const resolver = new AliasPathResolver<LocalValues, FormValues>(registry(), {
      person: "invoice.client.person",
    });

    const narrowed = resolver.scope<LocalValues["person"]>("person");

    expect(narrowed.resolve("name")).toBe("invoice.client.person.name");
    expect(narrowed.resolve("documentNumber")).toBe("invoice.client.person.documentNumber");
  });

  it("reads the map once, so a later change to it leaves the narrowed one alone", () => {
    const aliases: ControlAliasMap<LocalValues, FormValues> = {
      "person.name": "invoice.serial.series",
    };
    const narrowed = new AliasPathResolver<LocalValues, FormValues>(registry(), aliases).scope<LocalValues["person"]>(
      "person",
    );

    aliases["person.name"] = "invoice.serial.number";

    expect(narrowed.resolve("name")).toBe("invoice.serial.series");
  });

  it("narrows again from a name it inherited", () => {
    const resolver = new AliasPathResolver<LocalValues, FormValues>(registry(), {
      "client.person.name": "invoice.client.person.name",
    } as ControlAliasMap<LocalValues, FormValues>);

    const person = resolver.scope<LocalValues["client"]>("client").scope<LocalValues["person"]>("person");

    expect(person.resolve("name")).toBe("invoice.client.person.name");
  });

  it("keeps answering group after narrowing", () => {
    const resolver = new AliasPathResolver<LocalValues, FormValues>(registry(), {
      "client.person.name": "invoice.client.person.name",
      "client.person.documentNumber": "invoice.serial.number",
    } as ControlAliasMap<LocalValues, FormValues>);

    const client = resolver.scope<LocalValues["client"]>("client");

    expect(client.reach("person")).toEqual({
      kind: "group",
      members: ["person.name", "person.documentNumber"],
    });
  });

  it("refuses to narrow to a name the map does not cover", () => {
    const resolver = new AliasPathResolver<LocalValues, FormValues>(registry(), {
      person: "invoice.client.person",
    });

    expect(() => resolver.scope("serial")).toThrow("is outside this control aliases");
  });
});
