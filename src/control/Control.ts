/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormStore, FormValues as StoreFormValues } from "../FormStore";
import type { FormValues, Path, PathValue } from "../path";
import { GraphControl } from "./GraphControl";
import type { LensResult, LensSelection } from "./types";

/**
 * A control lens over form values.
 *
 * A control may coincide with the whole form or with a structural subtree, but
 * it is not defined by that shape. It is defined by the scoped field domain it
 * exposes: the set of field paths that are visible and operable from a given
 * scope.
 *
 * Those paths are always interpreted relative to that scope.
 *
 * A control is a lens over form state, not the owner of that state.
 */
export interface Control<TValues extends FormValues> {
  /**
   * Registers a field path inside the current control scope.
   *
   * @example
   * control.register("person.name");
   */
  register<TPath extends Path<TValues>>(path: TPath): void;

  /**
   * Unregisters a field path inside the current control scope.
   *
   * @example
   * control.unregister("person.name");
   */
  unregister<TPath extends Path<TValues>>(path: TPath): void;

  /**
   * Writes a value to a field path inside the current control scope.
   *
   * @example
   * control.set("person.name", "Ada");
   */
  set<TPath extends Path<TValues>>(path: TPath, value: PathValue<TValues, TPath>): void;

  /**
   * Derives a new control lens from the current control scope.
   *
   * Pass a node path to focus a subtree and work from that node as the new scope.
   *
   * @example
   * const person = control.lens("person");
   * person.set("name", "Ada");
   *
   * Pass a projection object to compose a new lens from one or more paths in the
   * current scope.
   *
   * @example
   * const summary = control.lens({
   *   name: "person.name",
   *   serial: "invoice.serial.number",
   * });
   *
   * summary.set("name", "Ada");
   */
  lens<TSelection extends LensSelection<TValues>>(selection: TSelection): LensResult<TValues, TSelection>;
}

function createRoot<TValues extends StoreFormValues>(store: FormStore<TValues>): Control<TValues> {
  return GraphControl.from(store);
}

export const Control = {
  createRoot,
};
