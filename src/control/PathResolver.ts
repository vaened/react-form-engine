/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, Path } from "../path";

export interface PathResolver<TLocalValues extends FormValues, TFormValues extends FormValues> {
  resolve<TPath extends Path<TLocalValues>>(path: TPath): Path<TFormValues>;
}
