/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormStore, FormValues } from "../FormStore";
import type { FieldPath, Path, PathValue } from "../path";
import type { FieldControl } from "./Control";

export class BoundFieldControl<TFormValues extends FormValues, TPath extends FieldPath<TFormValues> & Path<TFormValues>>
  implements FieldControl<PathValue<TFormValues, TPath>>
{
  readonly #store: FormStore<TFormValues>;
  readonly #path: TPath;

  private constructor(store: FormStore<TFormValues>, path: TPath) {
    this.#store = store;
    this.#path = path;
  }

  static from<TFormValues extends FormValues, TPath extends FieldPath<TFormValues> & Path<TFormValues>>(
    store: FormStore<TFormValues>,
    path: TPath,
  ): BoundFieldControl<TFormValues, TPath> {
    return new BoundFieldControl(store, path);
  }

  register(): void {
    this.#store.register(this.#path);
  }

  unregister(): void {
    this.#store.unregister(this.#path);
  }

  set(value: PathValue<TFormValues, TPath>): void {
    this.#store.set(this.#path, value);
  }
}
