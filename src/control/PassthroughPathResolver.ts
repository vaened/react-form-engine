/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, Path } from "../path";
import type { PathResolver } from "./PathResolver";

export class PassthroughPathResolver<TValues extends FormValues> implements PathResolver<TValues, TValues> {
  resolve<TPath extends Path<TValues>>(path: TPath): Path<TValues> {
    return path;
  }
}
