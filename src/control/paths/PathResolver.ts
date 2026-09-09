/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, Path } from "../../path";

export interface PathResolver<TLocalValues extends FormValues, TFormValues extends FormValues> {
  resolve<TPath extends Path<TLocalValues>>(path: TPath): Path<TFormValues>;

  /**
   * The resolver a control derives when it narrows to one of its own paths.
   *
   * A narrowed domain is not always the domain plus a prefix: a control built
   * over renamed paths answers for names that lead wherever the map says, and
   * the one narrowed out of it inherits that. Each resolver therefore answers
   * for what narrowing means to it, rather than being taken apart from outside.
   */
  scope<TScoped extends FormValues>(path: Path<TLocalValues>): PathResolver<TScoped, TFormValues>;
}
