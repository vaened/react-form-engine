/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, NodePath, Path, PathValue } from "../path";
import type { Control } from "./Control";

export type ControlProjection<TValues extends FormValues> = {
  readonly [TKey: string]: Path<TValues> | ControlProjection<TValues>;
};

export type ProjectionValue<TValues extends FormValues, TProjection extends ControlProjection<TValues>> = {
  [TKey in keyof TProjection]: TProjection[TKey] extends Path<TValues>
    ? PathValue<TValues, TProjection[TKey]>
    : TProjection[TKey] extends ControlProjection<TValues>
      ? ProjectionValue<TValues, TProjection[TKey]>
      : never;
};

export type FocusedValue<TValues extends FormValues, TPath extends NodePath<TValues>> = Extract<
  PathValue<TValues, TPath>,
  FormValues
>;

export type LensSelection<TValues extends FormValues> = NodePath<TValues> | ControlProjection<TValues>;

export type LensResult<TValues extends FormValues, TSelection extends LensSelection<TValues>> =
  TSelection extends NodePath<TValues>
    ? Control<FocusedValue<TValues, TSelection>>
    : TSelection extends ControlProjection<TValues>
      ? Control<ProjectionValue<TValues, TSelection>>
      : never;
