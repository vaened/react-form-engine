/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormStore, FormValues as StoreFormValues } from "../FormStore";
import type { FormValues, HostNativeObject, NodePath, Path, PathValue, Primitive } from "../path";
import { MappedNodeControl } from "./MappedNodeControl";
import type { ControlProjection, FocusedValue, ProjectionValue } from "./types";

/**
 * A control over a scoped domain of form values.
 *
 * It may represent the whole form or a structural node. Its scope is defined
 * by the paths that are visible and operable from its current context.
 *
 * Every path received by its operations is interpreted relative to that
 * context.
 *
 * The control provides access to the FormStore, but does not own or copy its
 * values or state.
 */
export interface NodeControl<TValues extends FormValues> {
  /**
   * Registers a path inside the current context without assigning or changing
   * its value.
   *
   * The path uses dot notation and is interpreted relative to the control.
   *
   * @example
   * control.register("person.name");
   */
  register<TPath extends Path<TValues>>(path: TPath): void;

  /**
   * Removes a path from the registration lifecycle without deleting or
   * changing its value.
   *
   * The path is interpreted relative to the current context.
   *
   * @example
   * control.unregister("person.name");
   */
  unregister<TPath extends Path<TValues>>(path: TPath): void;

  /**
   * Writes a value to a path in the current context without changing its
   * registration.
   *
   * The value type is determined by the selected path.
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
  lens<TPath extends NodePath<TValues>>(selection: TPath): NodeControl<FocusedValue<TValues, TPath>>;
  lens<TProjection extends ControlProjection<TValues>>(
    selection: TProjection,
  ): NodeControl<ProjectionValue<TValues, TProjection>>;
}

/**
 * A control bound to one exact field.
 *
 * Unlike NodeControl, it does not expose a path domain: the target field is
 * already contained by the control and every operation acts directly on it.
 *
 * Its methods therefore receive no paths, and the control cannot derive other
 * controls through lens.
 *
 * This allows a reusable component to depend only on FieldControl<TValue>,
 * without knowing the root form type or the field's absolute path.
 */
export interface FieldControl<TValue> {
  /**
   * Registers this field without assigning or changing its value.
   *
   * @example
   * control.register();
   */
  register(): void;

  /**
   * Removes this field from the registration lifecycle while preserving its
   * current value.
   *
   * @example
   * control.unregister();
   */
  unregister(): void;

  /**
   * Writes this field's value without changing whether it is registered.
   *
   * @example
   * control.set("Ada");
   */
  set(value: TValue): void;
}

type NodeControlValue<TValue> = TValue extends unknown
  ? TValue extends null | undefined
    ? never
    : TValue extends Primitive | HostNativeObject
      ? never
      : TValue extends FormValues
        ? TValue
        : never
  : never;

type ArrayControlValue<TValue> = TValue extends unknown ? (TValue extends readonly unknown[] ? TValue : never) : never;

type FieldControlValue<TValue> = TValue extends unknown
  ? TValue extends null | undefined
    ? never
    : TValue extends Primitive | HostNativeObject
      ? TValue
      : TValue extends object
        ? never
        : TValue
  : never;

/**
 * Selects the control contract that corresponds to a value.
 *
 * Structural form objects expose a NodeControl, while atomic values expose a
 * FieldControl. Null and undefined preserve the classification of the
 * non-nullish value they accompany.
 *
 * Arrays cannot form a control domain. Their structure is managed through the
 * specialized array API, which exposes controls for individual items instead.
 *
 * A union that mixes structural and atomic values resolves to never because a
 * single control cannot safely expose both operation contracts.
 */
export type Control<TValue> = [TValue] extends [never]
  ? never
  : [ArrayControlValue<TValue>] extends [never]
    ? [NodeControlValue<TValue>] extends [never]
      ? [FieldControlValue<TValue>] extends [never]
        ? never
        : FieldControl<TValue>
      : [FieldControlValue<TValue>] extends [never]
        ? NodeControl<NodeControlValue<TValue>>
        : never
    : never;

function createRoot<TValues extends StoreFormValues>(store: FormStore<TValues>): NodeControl<TValues> {
  return MappedNodeControl.from(store);
}

export const Control = {
  createRoot,
};
