/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, Path } from "../../path";

/**
 * What a local name stands for: one path of the form, or the names it merely
 * holds together when it stands for none of its own.
 */
export type Reach<TLocalValues extends FormValues, TFormValues extends FormValues> =
  | { readonly kind: "alias"; readonly path: Path<TFormValues> }
  | { readonly kind: "group"; readonly members: readonly Path<TLocalValues>[] };

export interface PathResolver<TLocalValues extends FormValues, TFormValues extends FormValues> {
  resolve<TPath extends Path<TLocalValues>>(path: TPath): Path<TFormValues>;

  /**
   * Whether a name answers for a place of the form or only gathers others.
   *
   * A projection may invent a name for members that live in unrelated branches,
   * and such a name has no place of its own to hand over. Telling the two apart
   * is what lets an operation on it become the operations on its members.
   */
  reach(path: Path<TLocalValues>): Reach<TLocalValues, TFormValues>;

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
