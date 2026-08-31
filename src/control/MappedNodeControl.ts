/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormStore, FormValues as StoreFormValues } from "../FormStore";
import type { FormValues, NodePath, Path, PathValue } from "../path";
import type { NodeControl } from "./Control";
import { AliasPathResolver, type ControlAliasMap } from "./paths/AliasPathResolver";
import { PassthroughPathResolver } from "./paths/PassthroughPathResolver";
import type { PathResolver } from "./paths/PathResolver";
import { PrefixedPathResolver } from "./paths/PrefixedPathResolver";
import type { ControlProjection, FocusedValue, LensSelection, ProjectionValue } from "./types";

export class MappedNodeControl<TLocalValues extends FormValues, TFormValues extends StoreFormValues = StoreFormValues>
  implements NodeControl<TLocalValues>
{
  readonly #store: FormStore<TFormValues>;
  readonly #pathResolver: PathResolver<TLocalValues, TFormValues>;

  private constructor(store: FormStore<TFormValues>, pathResolver: PathResolver<TLocalValues, TFormValues>) {
    this.#store = store;
    this.#pathResolver = pathResolver;
  }

  static from<TValues extends StoreFormValues>(store: FormStore<TValues>): MappedNodeControl<TValues, TValues>;
  static from<TLocalValues extends FormValues, TFormValues extends StoreFormValues = StoreFormValues>(
    store: FormStore<TFormValues>,
    aliases: ControlAliasMap<TLocalValues, TFormValues>,
  ): MappedNodeControl<TLocalValues, TFormValues>;
  static from<TLocalValues extends FormValues, TFormValues extends StoreFormValues = StoreFormValues>(
    store: FormStore<TFormValues>,
    aliases?: ControlAliasMap<TLocalValues, TFormValues>,
  ): MappedNodeControl<TLocalValues, TFormValues> {
    const pathResolver = aliases
      ? new AliasPathResolver(store.identifier, aliases)
      : new PassthroughPathResolver<TLocalValues>();
    return new MappedNodeControl(store, pathResolver as PathResolver<TLocalValues, TFormValues>);
  }

  register<TPath extends Path<TLocalValues>>(path: TPath): void {
    this.#store.register(this.#pathResolver.resolve(path));
  }

  unregister<TPath extends Path<TLocalValues>>(path: TPath): void {
    this.#store.unregister(this.#pathResolver.resolve(path));
  }

  set<TPath extends Path<TLocalValues>>(path: TPath, value: PathValue<TLocalValues, TPath>): void {
    this.#store.set(this.#pathResolver.resolve(path), value as PathValue<TFormValues, Path<TFormValues>>);
  }

  lens<TPath extends NodePath<TLocalValues>>(selection: TPath): NodeControl<FocusedValue<TLocalValues, TPath>>;
  lens<TProjection extends ControlProjection<TLocalValues>>(
    selection: TProjection,
  ): NodeControl<ProjectionValue<TLocalValues, TProjection>>;
  lens(selection: LensSelection<TLocalValues>) {
    return typeof selection === "string" ? this.#focus(selection) : this.#project(selection);
  }

  #focus<TPath extends NodePath<TLocalValues>>(path: TPath): NodeControl<FocusedValue<TLocalValues, TPath>> {
    const realPrefix = this.#pathResolver.resolve(path as Path<TLocalValues>);
    const pathResolver = new PrefixedPathResolver<FocusedValue<TLocalValues, TPath>, TFormValues>(realPrefix);

    return new MappedNodeControl(this.#store, pathResolver);
  }

  #project<TProjection extends ControlProjection<TLocalValues>>(
    projection: TProjection,
  ): NodeControl<ProjectionValue<TLocalValues, TProjection>> {
    return MappedNodeControl.from(this.#store, this.#build(projection));
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
