/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormStore, FormValues as StoreFormValues } from "../FormStore";
import type { FormValues, NodePath, Path, PathValue } from "../path";
import { GraphControl } from "./GraphControl";
import type { ControlProjection, FocusedValue, ProjectionValue } from "./types";

export interface Control<TValues extends FormValues> {
  register<TPath extends Path<TValues>>(path: TPath): void;
  unregister<TPath extends Path<TValues>>(path: TPath): void;
  set<TPath extends Path<TValues>>(path: TPath, value: PathValue<TValues, TPath>): void;
  lens<TPath extends NodePath<TValues>>(path: TPath): Control<FocusedValue<TValues, TPath>>;
  pick<const TProjection extends ControlProjection<TValues>>(
    projection: TProjection,
  ): Control<ProjectionValue<TValues, TProjection>>;
}

function createRoot<TValues extends StoreFormValues>(store: FormStore<TValues>): Control<TValues> {
  return GraphControl.from(store);
}

export const Control = {
  createRoot,
};
