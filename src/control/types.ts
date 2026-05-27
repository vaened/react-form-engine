/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, NodePath, Path, PathValue } from "../path";

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
