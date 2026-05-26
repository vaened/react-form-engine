/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, Path, PathValue } from "../path";

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
