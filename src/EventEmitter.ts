/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

export type Unsubscribe = () => void;

type Handler<TPayload> = (payload: TPayload) => void;

type Handlers<TEvents> = {
  [TType in keyof TEvents]?: Set<Handler<TEvents[TType]>>;
};

/**
 * Who wants to hear about what, keyed by the event map a holder declares.
 *
 * Handing back how to stop listening is the only way out: a subscriber that
 * comes and goes never has to hold on to what it passed in, and nothing else
 * can drop a listener it did not add.
 */
export class EventEmitter<TEvents extends Record<string, unknown>> {
  readonly #handlers: Handlers<TEvents> = {};

  on<TType extends keyof TEvents>(type: TType, handler: Handler<TEvents[TType]>): Unsubscribe {
    const handlers = this.#handlers[type] ?? new Set<Handler<TEvents[TType]>>();

    this.#handlers[type] = handlers;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }

  /**
   * The set is walked as it stands: a handler that unsubscribes while this runs
   * may still be reached, and one that subscribes will be.
   */
  emit<TType extends keyof TEvents>(type: TType, payload: TEvents[TType]): void {
    const handlers = this.#handlers[type];

    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      handler(payload);
    }
  }
}
