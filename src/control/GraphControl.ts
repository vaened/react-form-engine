/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormStore, FormValues as StoreFormValues } from "../FormStore";
import type { FormValues, Path, PathValue } from "../path";
import { AliasPathResolver, type ControlAliasMap } from "./AliasPathResolver";
import type { Control } from "./Control";
import { PassthroughPathResolver } from "./PassthroughPathResolver";
import type { PathResolver } from "./PathResolver";
import type { ControlProjection, ProjectionValue } from "./types";

export class GraphControl<TLocalValues extends FormValues, TFormValues extends StoreFormValues = StoreFormValues>
  implements Control<TLocalValues>
{
  readonly #store: FormStore<TFormValues>;
  readonly #pathResolver: PathResolver<TLocalValues, TFormValues>;

  private constructor(store: FormStore<TFormValues>, pathResolver: PathResolver<TLocalValues, TFormValues>) {
    this.#store = store;
    this.#pathResolver = pathResolver;
  }

  static from<TValues extends StoreFormValues>(store: FormStore<TValues>): GraphControl<TValues, TValues>;
  static from<TLocalValues extends FormValues, TFormValues extends StoreFormValues = StoreFormValues>(
    store: FormStore<TFormValues>,
    aliases: ControlAliasMap<TLocalValues, TFormValues>,
  ): GraphControl<TLocalValues, TFormValues>;
  static from<TLocalValues extends FormValues, TFormValues extends StoreFormValues = StoreFormValues>(
    store: FormStore<TFormValues>,
    aliases?: ControlAliasMap<TLocalValues, TFormValues>,
  ): GraphControl<TLocalValues, TFormValues> {
    const pathResolver = aliases ? new AliasPathResolver(aliases) : new PassthroughPathResolver<TLocalValues>();
    return new GraphControl(store, pathResolver as PathResolver<TLocalValues, TFormValues>);
  }

  set<TPath extends Path<TLocalValues>>(path: TPath, value: PathValue<TLocalValues, TPath>): void {
    this.#store.set(this.#pathResolver.resolve(path), value as PathValue<TFormValues, Path<TFormValues>>);
  }

  pick<const TProjection extends ControlProjection<TLocalValues>>(
    projection: TProjection,
  ): Control<ProjectionValue<TLocalValues, TProjection>> {
    return GraphControl.from(this.#store, this.#build(projection));
  }

  #build<const TProjection extends ControlProjection<TLocalValues>>(
    projection: TProjection,
  ): ControlAliasMap<ProjectionValue<TLocalValues, TProjection>, TFormValues> {
    const aliases: Record<string, string> = {};

    const visit = (value: ControlProjection<TLocalValues> | Path<TLocalValues>, localPathPrefix?: string): void => {
      if (typeof value === "string") {
        aliases[localPathPrefix ?? value] = this.#pathResolver.resolve(value);
        return;
      }

      for (const [key, child] of Object.entries(value)) {
        const localPath = localPathPrefix ? `${localPathPrefix}.${key}` : key;
        visit(child as ControlProjection<TLocalValues> | Path<TLocalValues>, localPath);
      }
    };

    visit(projection);

    if (Object.keys(aliases).length === 0) {
      throw new Error("Control projection cannot be empty.");
    }

    return aliases as ControlAliasMap<ProjectionValue<TLocalValues, TProjection>, TFormValues>;
  }
}
