/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "./EventEmitter";

type Events = {
  opened: number;
  closed: readonly string[];
};

describe("EventEmitter", () => {
  let events: EventEmitter<Events>;

  beforeEach(() => {
    events = new EventEmitter<Events>();
  });

  it("hands the payload to a handler that asked for that event", () => {
    const handler = vi.fn();

    events.on("opened", handler);
    events.emit("opened", 7);

    expect(handler).toHaveBeenCalledWith(7);
  });

  it("reaches every handler on the same event, in the order they arrived", () => {
    const order: string[] = [];

    events.on("opened", () => order.push("first"));
    events.on("opened", () => order.push("second"));

    events.emit("opened", 1);

    expect(order).toEqual(["first", "second"]);
  });

  it("leaves handlers of another event alone", () => {
    const closed = vi.fn();

    events.on("closed", closed);
    events.emit("opened", 1);

    expect(closed).not.toHaveBeenCalled();
  });

  it("says nothing to nobody when an event has no handlers", () => {
    expect(() => events.emit("opened", 1)).not.toThrow();
  });

  it("stops reaching a handler once it unsubscribes", () => {
    const handler = vi.fn();

    const off = events.on("opened", handler);

    events.emit("opened", 1);
    off();
    events.emit("opened", 2);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes only what it was handed, leaving the rest listening", () => {
    const kept = vi.fn();

    const off = events.on("opened", vi.fn());
    events.on("opened", kept);

    off();
    events.emit("opened", 1);

    expect(kept).toHaveBeenCalledTimes(1);
  });

  it("takes a second unsubscribe as nothing left to do", () => {
    const handler = vi.fn();
    const off = events.on("opened", handler);

    off();
    off();
    events.emit("opened", 1);

    expect(handler).not.toHaveBeenCalled();
  });

  it("counts the same handler once, however many times it subscribes", () => {
    const handler = vi.fn();

    events.on("opened", handler);
    events.on("opened", handler);

    events.emit("opened", 1);

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
