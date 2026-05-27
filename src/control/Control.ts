/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormStore, FormValues as StoreFormValues } from "../FormStore";
import type { FormValues, Path, PathValue } from "../path";
import { GraphControl } from "./GraphControl";
import type { LensResult, LensSelection } from "./types";

export interface Control<TValues extends FormValues> {
  register<TPath extends Path<TValues>>(path: TPath): void;
  unregister<TPath extends Path<TValues>>(path: TPath): void;
  set<TPath extends Path<TValues>>(path: TPath, value: PathValue<TValues, TPath>): void;
  lens<TSelection extends LensSelection<TValues>>(selection: TSelection): LensResult<TValues, TSelection>;
}

function createRoot<TValues extends StoreFormValues>(store: FormStore<TValues>): Control<TValues> {
  return GraphControl.from(store);
}

export const Control = {
  createRoot,
};
