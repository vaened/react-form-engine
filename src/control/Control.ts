/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormStore, FormValues as StoreFormValues } from "../FormStore";
import type { FormValues, Path, PathValue } from "../path";
import { GraphControl } from "./GraphControl";
import type { ControlProjection, ProjectionValue } from "./types";

export interface Control<TValues extends FormValues> {
  set<TPath extends Path<TValues>>(path: TPath, value: PathValue<TValues, TPath>): void;
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
