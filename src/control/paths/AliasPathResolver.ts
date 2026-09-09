/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, Path } from "../../path";
import { SingleEntryCache } from "../../SingleEntryCache";
import type { PathId, PathIdentifier } from "../../store/state/PathRegistry";
import type { PathResolver, Reach } from "./PathResolver";

export type ControlAliasMap<TLocalValues extends FormValues, TFormValues extends FormValues> = Partial<
  Record<Path<TLocalValues>, Path<TFormValues>>
>;

export class AliasPathResolver<TLocalValues extends FormValues, TFormValues extends FormValues>
  implements PathResolver<TLocalValues, TFormValues>
{
  readonly #identifier: PathIdentifier<Path<TFormValues>>;
  readonly #aliases: ControlAliasMap<TLocalValues, TFormValues>;
  readonly #beneath: Path<TFormValues> | undefined;
  readonly #grouped: ReadonlyMap<Path<TLocalValues>, readonly Path<TLocalValues>[]>;
  readonly #lastResolution: SingleEntryCache<Path<TLocalValues>, Path<TFormValues>>;
  readonly #cache = new Map<Path<TLocalValues>, PathId<Path<TFormValues>>>();

  constructor(
    identifier: PathIdentifier<Path<TFormValues>>,
    aliases: ControlAliasMap<TLocalValues, TFormValues>,
    beneath?: Path<TFormValues>,
  ) {
    if (Object.keys(aliases).length === 0 && beneath === undefined) {
      throw new Error("Control aliases cannot be empty.");
    }

    this.#identifier = identifier;
    this.#aliases = aliases;
    this.#beneath = beneath;
    this.#lastResolution = new SingleEntryCache();
    this.#grouped = this.#gather();
  }

  get aliases(): Readonly<ControlAliasMap<TLocalValues, TFormValues>> {
    return this.#aliases;
  }

  resolve<TPath extends Path<TLocalValues>>(path: TPath): Path<TFormValues> {
    const entry = this.#lastResolution.get(path);

    if (entry !== undefined) {
      return entry;
    }

    const cachedPathId = this.#cache.get(path);

    if (cachedPathId !== undefined) {
      const cachedPath = this.#identifier.describe(cachedPathId);
      this.#lastResolution.set(path, cachedPath);

      return cachedPath;
    }

    const resolved = this.#lookup(path);

    if (resolved === undefined) {
      throw new Error(`Path \`${path}\` is outside this control aliases.`);
    }

    return this.#remember(path, resolved, this.#identifier.register(resolved));
  }

  reach(path: Path<TLocalValues>): Reach<TLocalValues, TFormValues> {
    const members = this.#grouped.get(path);

    return members === undefined ? { kind: "alias", path: this.resolve(path) } : { kind: "group", members };
  }

  /**
   * Which names hold others together, and which others each one holds.
   *
   * Read once, because the map never changes after this: asking it on every
   * write would walk the whole map on the path a keystroke takes.
   *
   * A name that also answers for a place of the form is listed among its own
   * members, so writing them still leaves the place to answer for whatever no
   * member covers.
   */
  #gather(): ReadonlyMap<Path<TLocalValues>, readonly Path<TLocalValues>[]> {
    const grouped = new Map<Path<TLocalValues>, Path<TLocalValues>[]>();

    for (const local of Object.keys(this.#aliases) as Path<TLocalValues>[]) {
      let name = local as string;

      while (true) {
        const lastDotIndex = name.lastIndexOf(".");

        if (lastDotIndex === -1) {
          break;
        }

        name = name.slice(0, lastDotIndex);

        const holder = name as Path<TLocalValues>;
        const members = grouped.get(holder);

        if (members !== undefined) {
          members.push(local);
          continue;
        }

        grouped.set(holder, this.#lookup(holder) === undefined ? [local] : [holder, local]);
      }
    }

    return grouped;
  }

  /**
   * Narrowing keeps the map rather than collapsing it into a prefix: the names
   * a projection invented lead wherever it said, and only some of them lead
   * under whatever the narrowed name itself resolves to.
   *
   * What the map holds is read once, here, so a control already derived answers
   * the same afterwards however the map it came from is handled.
   */
  scope<TScoped extends FormValues>(path: Path<TLocalValues>): PathResolver<TScoped, TFormValues> {
    const under = `${path}.`;
    const inherited: Record<string, Path<TFormValues>> = {};

    for (const [local, real] of Object.entries(this.#aliases) as [string, Path<TFormValues>][]) {
      if (local.startsWith(under)) {
        inherited[local.slice(under.length)] = real;
      }
    }

    const beneath = this.#lookup(path);

    if (beneath === undefined && Object.keys(inherited).length === 0) {
      throw new Error(`Path \`${path}\` is outside this control aliases.`);
    }

    // Cutting a prefix off a local path is where it stops being one and
    // becomes text, so the compiler cannot follow the remainder back to the
    // path it spells inside the narrowed domain.
    return new AliasPathResolver<TScoped, TFormValues>(
      this.#identifier,
      inherited as ControlAliasMap<TScoped, TFormValues>,
      beneath,
    );
  }

  /** The real path a local one names, by its own entry, by the nearest entry it
   * hangs from, or by what this control was narrowed beneath. */
  #lookup(path: Path<TLocalValues>): Path<TFormValues> | undefined {
    const exact = this.#aliases[path];

    if (exact) {
      return exact;
    }

    let prefix = path as string;

    while (true) {
      const lastDotIndex = prefix.lastIndexOf(".");

      if (lastDotIndex === -1) {
        break;
      }

      prefix = prefix.slice(0, lastDotIndex);

      const formPrefix = this.#aliases[prefix as Path<TLocalValues>];

      if (formPrefix) {
        return `${formPrefix}${(path as string).slice(prefix.length)}` as Path<TFormValues>;
      }
    }

    return this.#beneath === undefined ? undefined : (`${this.#beneath}.${path}` as Path<TFormValues>);
  }

  #remember<TPath extends Path<TLocalValues>>(
    path: TPath,
    resolvedPath: Path<TFormValues>,
    id: PathId<Path<TFormValues>>,
  ): Path<TFormValues> {
    this.#lastResolution.set(path, resolvedPath);
    this.#cache.set(path, id);

    return resolvedPath;
  }
}
