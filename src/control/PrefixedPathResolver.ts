/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, NodePath, Path } from "../path";
import type { PathResolver } from "./PathResolver";

export class PrefixedPathResolver<TLocalValues extends FormValues, TFormValues extends FormValues>
  implements PathResolver<TLocalValues, TFormValues>
{
  readonly #realPrefix: Path<TFormValues>;

  constructor(realPrefix: Path<TFormValues>) {
    this.#realPrefix = realPrefix;
  }

  resolve<TPath extends Path<TLocalValues> | NodePath<TLocalValues>>(path: TPath): Path<TFormValues> {
    return `${this.#realPrefix}.${path}` as Path<TFormValues>;
  }
}
