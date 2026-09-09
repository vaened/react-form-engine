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
    this.#each(path, (real) => this.#store.register(real));
  }

  unregister<TPath extends Path<TLocalValues>>(path: TPath): void {
    this.#each(path, (real) => this.#store.unregister(real));
  }

  set<TPath extends Path<TLocalValues>>(path: TPath, value: PathValue<TLocalValues, TPath>): void {
    this.#write(path, value);
  }

  /**
   * A name the projection only groups is written by writing the value it was
   * given: the members it gathers may live in unrelated branches of the form,
   * so there is no single place to hand the whole value to. Descending by the
   * value rather than by the map is also what leaves untouched whatever the
   * caller did not name.
   */
  #write(path: Path<TLocalValues>, value: unknown): void {
    const reach = this.#pathResolver.reach(path);

    if (reach.kind === "alias") {
      this.#store.set(reach.path, value as PathValue<TFormValues, Path<TFormValues>>);
      return;
    }

    if (!MappedNodeControl.#openable(value)) {
      throw new Error(`Path \`${path}\` is outside this control aliases.`);
    }

    for (const key of Object.keys(value)) {
      this.#write(MappedNodeControl.#under(path, key), value[key]);
    }
  }

  /**
   * Joining two names is where a path stops being one and becomes text, so the
   * compiler cannot follow the pieces back to the path they spell. A name the
   * map does not answer for is refused by `reach` a moment later.
   */
  static #under<TValues extends FormValues>(path: Path<TValues>, key: string): Path<TValues> {
    return `${path}.${key}` as Path<TValues>;
  }

  /** Every real path a local name stands for, whether one or many. */
  #each(path: Path<TLocalValues>, visit: (real: Path<TFormValues>) => void): void {
    const reach = this.#pathResolver.reach(path);

    if (reach.kind === "alias") {
      visit(reach.path);
      return;
    }

    for (const member of reach.members) {
      visit(this.#pathResolver.resolve(member));
    }
  }

  static #openable(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  lens<TPath extends NodePath<TLocalValues>>(selection: TPath): NodeControl<FocusedValue<TLocalValues, TPath>>;
  lens<TProjection extends ControlProjection<TLocalValues>>(
    selection: TProjection,
  ): NodeControl<ProjectionValue<TLocalValues, TProjection>>;
  lens(selection: LensSelection<TLocalValues>) {
    return typeof selection === "string" ? this.#focus(selection) : this.#project(selection);
  }

  #focus<TPath extends NodePath<TLocalValues>>(path: TPath): NodeControl<FocusedValue<TLocalValues, TPath>> {
    return new MappedNodeControl(
      this.#store,
      this.#pathResolver.scope<FocusedValue<TLocalValues, TPath>>(path as Path<TLocalValues>),
    );
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
