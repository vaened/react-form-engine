/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { Path } from "../../path";
import { PathIndex } from "../path/PathIndex";
import { PathKind } from "../path/types";
import { PathRegistry } from "../state/PathRegistry";
import { InvalidRootValue } from "./errors";
import { FormValue } from "./FormValue";

/** Shape of docs/FormValue.example.json. */
type Invoice = {
  invoice: {
    series: string;
    client: {
      name: string;
      phones: string[];
      addresses: { city: string; reference: string }[];
    };
  };
};

const CITY_0 = "invoice.client.addresses.0.city";
const CITY_1 = "invoice.client.addresses.1.city";
const PHONE_0 = "invoice.client.phones.0";
const PHONE_1 = "invoice.client.phones.1";
const ADDRESSES = "invoice.client.addresses";

const sample = (): Invoice => ({
  invoice: {
    series: "F001",
    client: {
      name: "Ada Lovelace",
      phones: ["+51 999 999 999", "+51 988 888 888"],
      addresses: [
        { city: "Lima", reference: "Frente al parque principal" },
        { city: "Arequipa", reference: "A dos cuadras de la plaza" },
      ],
    },
  },
});

describe("FormValue", () => {
  let index: PathIndex<Invoice>;
  let value: FormValue<Invoice>;

  beforeEach(() => {
    index = new PathIndex<Invoice>(new PathRegistry<Path<Invoice>>());
    value = new FormValue<Invoice>(sample(), sample());
  });

  const field = (path: Path<Invoice>) => index.register(path, PathKind.Field);

  describe("root", () => {
    it("rejects a root that is not an object", () => {
      expect(() => new FormValue([] as never)).toThrow(InvalidRootValue);
      expect(() => new FormValue(null as never)).toThrow(InvalidRootValue);
    });

    it("clones the values when no defaults are given, instead of sharing the reference", () => {
      const only = sample();
      const single = new FormValue<Invoice>(only);

      expect(single.defaults).toEqual(only);
      expect(single.defaults).not.toBe(only);
    });

    it("keeps defaults untouched by a later write, even when none were given explicitly", () => {
      const only = sample();
      const single = new FormValue<Invoice>(only);

      single.write(field("invoice.client.name"), "Grace Hopper");

      expect(single.defaults.invoice.client.name).toBe("Ada Lovelace");
    });
  });

  describe("reading", () => {
    it("reads a field nested under objects", () => {
      expect(value.read(field("invoice.series"))).toBe("F001");
      expect(value.read(field("invoice.client.name"))).toBe("Ada Lovelace");
    });

    it("reads a field inside an array of objects", () => {
      expect(value.read(field(CITY_0))).toBe("Lima");
      expect(value.read(field(CITY_1))).toBe("Arequipa");
    });

    it("reads an item of an array of scalars", () => {
      expect(value.read(field(PHONE_0))).toBe("+51 999 999 999");
      expect(value.read(field(PHONE_1))).toBe("+51 988 888 888");
    });

    it("resolves undefined instead of creating when the path is not navigable", () => {
      const client = index.register("invoice.client", PathKind.Object);
      const name = field("invoice.client.name");

      value.write(client, null);

      expect(value.read(name)).toBeUndefined();
      expect(value.value.invoice.client).toBeNull();
    });
  });

  describe("writing", () => {
    it("writes a field nested under objects", () => {
      value.write(field("invoice.client.name"), "Grace Hopper");

      expect(value.value.invoice.client.name).toBe("Grace Hopper");
    });

    it("writes a field inside an array of objects", () => {
      value.write(field(CITY_1), "Cusco");

      expect(value.value.invoice.client.addresses[1].city).toBe("Cusco");
      expect(value.value.invoice.client.addresses[0].city).toBe("Lima");
    });

    it("writes an item of an array of scalars", () => {
      value.write(field(PHONE_1), "+51 900 000 000");

      expect(value.value.invoice.client.phones).toEqual(["+51 999 999 999", "+51 900 000 000"]);
    });

    it("leaves an explicitly assigned null in place", () => {
      const client = index.register("invoice.client", PathKind.Object);

      value.write(client, null);

      expect(value.value.invoice.client).toBeNull();
    });

    it("refuses to write over the root", () => {
      expect(() => value.write(index.root(), {})).toThrow(InvalidRootValue);
    });

    it("writes a whole object node", () => {
      const client = index.register("invoice.client", PathKind.Object);

      value.write(client, { name: "Grace Hopper", phones: [], addresses: [] });

      expect(value.value.invoice.client).toEqual({ name: "Grace Hopper", phones: [], addresses: [] });
      expect(value.value.invoice.series).toBe("F001");
    });

    it("writes a whole array node", () => {
      const addresses = index.register(ADDRESSES, PathKind.Array);

      value.write(addresses, [{ city: "Trujillo", reference: "Centro" }]);

      expect(value.value.invoice.client.addresses).toEqual([{ city: "Trujillo", reference: "Centro" }]);
    });

    it("does not leave a descendant pointing at the replaced object", () => {
      const client = index.register("invoice.client", PathKind.Object);
      const city = field(CITY_0);

      value.write(city, "Cusco");
      value.write(client, { name: "Grace Hopper" });
      value.write(city, "Trujillo");

      expect(value.value.invoice.client).toEqual({
        name: "Grace Hopper",
        addresses: [{ city: "Trujillo" }],
      });
    });
  });

  describe("creating the path", () => {
    it("rebuilds a branch that was nulled", () => {
      const client = index.register("invoice.client", PathKind.Object);
      const name = field("invoice.client.name");

      value.write(client, null);
      value.write(name, "Grace Hopper");

      expect(value.value.invoice.client).toEqual({ name: "Grace Hopper" });
    });

    it("creates a branch that never existed in the initial value", () => {
      const empty = new FormValue<Invoice>({} as Invoice);

      empty.write(field("invoice.client.name"), "Ada");

      expect(empty.value).toEqual({ invoice: { client: { name: "Ada" } } });
    });

    it("creates an array where the entry says array, and an object where it says object", () => {
      const empty = new FormValue<Invoice>({} as Invoice);

      index.register(ADDRESSES, PathKind.Array);
      empty.write(field(CITY_0), "Lima");

      expect(Array.isArray(empty.value.invoice.client.addresses)).toBe(true);
      expect(empty.value.invoice.client.addresses[0]).toEqual({ city: "Lima" });
    });
  });

  describe("defaults", () => {
    it("reads the base value an entry is compared against", () => {
      const city = field(CITY_0);

      value.write(city, "Cusco");

      expect(value.read(city)).toBe("Cusco");
      expect(value.default(city)).toBe("Lima");
    });

    it("never creates anything while reading a default", () => {
      const empty = new FormValue<Invoice>({} as Invoice, {} as Invoice);

      expect(empty.default(field("invoice.client.name"))).toBeUndefined();
      expect(empty.defaults).toEqual({});
    });
  });

  describe("the container cache", () => {
    /** What the store does in one transaction: the index and the value together. */
    const move = <TItem>(items: TItem[], from: number, to: number) => {
      const [item] = items.splice(from, 1);

      items.splice(to, 0, item);
    };

    it("does not go stale after a move, because the item object is the same", () => {
      const addresses = index.register(ADDRESSES, PathKind.Array);
      const lima = field(CITY_0);

      field(CITY_1);
      value.write(lima, "Lima editada");

      index.move(addresses.id, 1, 0);
      move(value.value.invoice.client.addresses, 1, 0);

      value.write(lima, "Lima otra vez");

      expect(value.value.invoice.client.addresses).toEqual([
        { city: "Arequipa", reference: "A dos cuadras de la plaza" },
        { city: "Lima otra vez", reference: "Frente al parque principal" },
      ]);
    });

    it("follows the position for an item of an array of scalars after a move", () => {
      const phones = index.register("invoice.client.phones", PathKind.Array);
      const first = field(PHONE_0);

      field(PHONE_1);

      index.move(phones.id, 1, 0);
      move(value.value.invoice.client.phones, 1, 0);

      value.write(first, "cambiado");

      expect(value.value.invoice.client.phones).toEqual(["+51 988 888 888", "cambiado"]);
    });

    /**
     * A node whose parent is the root is reached without descending into any
     * container, so the descent that replaces it never passes through the one
     * being remembered.
     */
    it("does not survive replacing a node that hangs from the root", () => {
      const invoice = index.register("invoice", PathKind.Object);
      const series = field("invoice.series");

      expect(value.read(series)).toBe("F001");

      value.write(invoice, { series: "F002" });

      expect(value.read(series)).toBe("F002");
    });

    it("does not survive replacing a node deeper down either", () => {
      const client = index.register("invoice.client", PathKind.Object);
      const name = field("invoice.client.name");

      expect(value.read(name)).toBe("Ada Lovelace");

      value.write(client, { name: "Grace Hopper" });

      expect(value.read(name)).toBe("Grace Hopper");
    });

    it("is dropped by clear", () => {
      const city = field(CITY_0);

      value.write(city, "Cusco");
      value.clear();
      value.write(city, "Trujillo");

      expect(value.value.invoice.client.addresses[0].city).toBe("Trujillo");
    });

    it("does not survive replacing the root", () => {
      const city = field(CITY_0);

      value.write(city, "Cusco");
      value.replace(sample());

      expect(value.read(city)).toBe("Lima");
    });
  });

  describe("work actually avoided", () => {
    const REFERENCE_0 = "invoice.client.addresses.0.reference";

    /** Every descent from the root reads `invoice` exactly once. */
    let descents: number;

    beforeEach(() => {
      const raw = sample();

      descents = 0;
      value = new FormValue<Invoice>(
        {
          get invoice() {
            descents += 1;
            return raw.invoice;
          },
        } as Invoice,
        sample(),
      );
    });

    it("does not walk the value again when the same field is written twice", () => {
      const city = field(CITY_0);

      value.write(city, "Cusco");
      expect(descents).toBe(1);

      value.write(city, "Trujillo");
      expect(descents).toBe(1);
    });

    it("does not walk the value again between a write and a read of the same field", () => {
      const city = field(CITY_0);

      value.write(city, "Cusco");
      expect(value.read(city)).toBe("Cusco");
      expect(descents).toBe(1);
    });

    it("shares the container between fields of the same object", () => {
      const city = field(CITY_0);
      const reference = field(REFERENCE_0);

      value.write(city, "Cusco");
      value.write(reference, "Junto al mercado");

      expect(descents).toBe(1);
    });

    it("walks again when the write lands in a different container", () => {
      const city = field(CITY_0);
      const name = field("invoice.client.name");

      value.write(city, "Cusco");
      value.write(name, "Grace Hopper");

      expect(descents).toBe(2);
    });

    it("walks again after clear", () => {
      const city = field(CITY_0);

      value.write(city, "Cusco");
      value.clear();
      value.write(city, "Trujillo");

      expect(descents).toBe(2);
    });

    it("does not poison the cache when reading a default in between", () => {
      const city = field(CITY_0);

      value.write(city, "Cusco");
      expect(value.default(city)).toBe("Lima");

      value.write(city, "Trujillo");

      expect(descents).toBe(1);
      expect(value.read(city)).toBe("Trujillo");
    });
  });

  describe("nested arrays", () => {
    type Grid = {
      invoice: {
        grid: number[][];
        rows: { tags: { label: string }[] }[];
      };
    };

    const LABEL = "invoice.rows.0.tags.1.label";

    let nested: PathIndex<Grid>;
    let matrix: FormValue<Grid>;

    const raw = (): Grid => ({
      invoice: {
        grid: [
          [1, 2],
          [3, 4],
        ],
        rows: [{ tags: [{ label: "uno" }, { label: "dos" }] }, { tags: [{ label: "tres" }] }],
      },
    });

    beforeEach(() => {
      nested = new PathIndex<Grid>(new PathRegistry<Path<Grid>>());
      matrix = new FormValue<Grid>(raw(), raw());
    });

    it("reads through two consecutive positional steps", () => {
      const cell = nested.register("invoice.grid.1.0", PathKind.Field);

      expect(matrix.read(cell)).toBe(3);
    });

    it("writes through two consecutive positional steps", () => {
      const cell = nested.register("invoice.grid.1.0", PathKind.Field);

      matrix.write(cell, 99);

      expect(matrix.value.invoice.grid).toEqual([
        [1, 2],
        [99, 4],
      ]);
    });

    it("reaches a named array nested inside an unnamed item", () => {
      const label = nested.register(LABEL, PathKind.Field);

      expect(matrix.read(label)).toBe("dos");

      matrix.write(label, "editado");

      expect(matrix.value.invoice.rows[0].tags[1].label).toBe("editado");
      expect(matrix.value.invoice.rows[1].tags[0].label).toBe("tres");
    });

    it("keeps writing to the same item after the outer array moves", () => {
      const rows = nested.register("invoice.rows", PathKind.Array);
      const label = nested.register(LABEL, PathKind.Field);

      nested.register("invoice.rows.1.tags.0.label", PathKind.Field);
      nested.move(rows.id, 1, 0);

      const items = matrix.value.invoice.rows;
      const [moved] = items.splice(1, 1);

      items.splice(0, 0, moved);
      matrix.write(label, "sigue siendo dos");

      expect(matrix.value.invoice.rows[1].tags[1].label).toBe("sigue siendo dos");
    });

    it("builds both levels when neither exists yet", () => {
      const empty = new FormValue<Grid>({} as Grid);

      nested.register("invoice.grid", PathKind.Array);
      nested.register("invoice.grid.0", PathKind.Array);
      empty.write(nested.register("invoice.grid.0.1", PathKind.Field), 7);

      expect(empty.value.invoice.grid).toEqual([[undefined, 7]]);
    });
  });

  describe("replacing the root", () => {
    it("rejects a replacement that is not an object", () => {
      expect(() => value.replace([] as never)).toThrow(InvalidRootValue);
      expect(() => value.replace(null as never)).toThrow(InvalidRootValue);
    });

    it("swaps the live value while leaving the defaults alone", () => {
      const city = field(CITY_0);

      value.write(city, "Cusco");
      value.replace(sample());

      expect(value.read(city)).toBe("Lima");
      expect(value.default(city)).toBe("Lima");
    });

    it("exposes the new object by reference", () => {
      const next = sample();

      value.replace(next);

      expect(value.value).toBe(next);
    });

    it("writes into the replacement, not the discarded value", () => {
      const discarded = value.value;
      const city = field(CITY_0);

      value.write(city, "Cusco");
      value.replace(sample());
      value.write(city, "Trujillo");

      expect(value.value.invoice.client.addresses[0].city).toBe("Trujillo");
      expect(discarded.invoice.client.addresses[0].city).toBe("Cusco");
    });
  });
});
