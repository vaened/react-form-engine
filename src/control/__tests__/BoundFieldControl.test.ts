import { describe, expect, it, vi } from "vitest";

import { FormStore } from "../../FormStore";
import { BoundFieldControl } from "../BoundFieldControl";

type InvoiceValues = {
  invoice: {
    client: {
      name: string;
    };
  };
};

function createStore(): FormStore<InvoiceValues> {
  return new FormStore<InvoiceValues>({
    defaults: {
      invoice: {
        client: {
          name: "Ada",
        },
      },
    },
  });
}

describe("BoundFieldControl", () => {
  it("binds the registration lifecycle to its exact field path", () => {
    const store = createStore();
    const register = vi.spyOn(store, "register");
    const control = BoundFieldControl.from(store, "invoice.client.name");

    const release = control.register();

    expect(register).toHaveBeenCalledWith("invoice.client.name");
    expect(store.state("invoice.client.name")).toBeDefined();

    release();
    expect(store.state("invoice.client.name")).toBeUndefined();
  });

  it("writes to its exact field path without receiving the path again", () => {
    const store = createStore();
    const set = vi.spyOn(store, "set");
    const control = BoundFieldControl.from(store, "invoice.client.name");

    control.set("Grace");

    expect(set).toHaveBeenCalledWith("invoice.client.name", "Grace");
    expect(store.values.invoice.client.name).toBe("Grace");
  });
});
