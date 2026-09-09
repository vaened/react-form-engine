/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormStore, FormWrites, FormValues as StoreFormValues } from "../FormStore";
import type { FormValues, NodePath, Path, PathValue } from "../path";
import type { NodeControl } from "./Control";
import { EmptyProjection, PathOutsideControl } from "./errors";
import { AliasPathResolver, type ControlAliasMap } from "./paths/AliasPathResolver";
import { PassthroughPathResolver } from "./paths/PassthroughPathResolver";
import type { PathResolver } from "./paths/PathResolver";
import type { ControlProjection, FocusedValue, LensSelection, ProjectionValue, WithoutOverrides } from "./types";

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
   *
   * The places it reaches are gathered before any of them is written, so what
   * the caller meant as one change arrives as one, rather than as the run of
   * writes it happens to take. A name that stands for one place skips that:
   * building a map to take it apart again buys nothing.
   */
  #write(path: Path<TLocalValues>, value: unknown): void {
    const reach = this.#pathResolver.reach(path);

    if (reach.kind === "alias") {
      this.#store.set(reach.path, value as PathValue<TFormValues, Path<TFormValues>>);
      return;
    }

    this.#store.assign(this.#planned(path, value));
  }

  /** Where every part of a value lands, without writing any of it yet. */
  #planned(path: Path<TLocalValues>, value: unknown): FormWrites<TFormValues> {
    const writes: FormWrites<TFormValues> = {};

    const visit = (at: Path<TLocalValues>, current: unknown): void => {
      const reach = this.#pathResolver.reach(at);

      if (reach.kind === "alias") {
        writes[reach.path] = current as FormWrites<TFormValues>[Path<TFormValues>];
        return;
      }

      if (!MappedNodeControl.#openable(current)) {
        throw new PathOutsideControl(at);
      }

      for (const key of Object.keys(current)) {
        visit(MappedNodeControl.#under(at, key), current[key]);
      }
    };

    visit(path, value);

    return writes;
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
  lens<const TProjection extends ControlProjection<TLocalValues>>(
    selection: TProjection & WithoutOverrides<TLocalValues, TProjection>,
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

      for (const key of Object.keys(value)) {
        const localPath = localPathPrefix ? `${localPathPrefix}.${key}` : key;
        visit(value[key], localPath);
      }
    };

    visit(projection);

    if (Object.keys(aliases).length === 0) {
      throw new EmptyProjection();
    }

    return aliases as ControlAliasMap<ProjectionValue<TLocalValues, TProjection>, TFormValues>;
  }
}
