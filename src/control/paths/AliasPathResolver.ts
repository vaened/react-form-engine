/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, Path } from "../../path";
import { SingleEntryCache } from "../../SingleEntryCache";
import type { PathId, PathIdentifier } from "../../store/state/PathRegistry";
import type { PathResolver } from "./PathResolver";

export type ControlAliasMap<TLocalValues extends FormValues, TFormValues extends FormValues> = Partial<
  Record<Path<TLocalValues>, Path<TFormValues>>
>;

export class AliasPathResolver<TLocalValues extends FormValues, TFormValues extends FormValues>
  implements PathResolver<TLocalValues, TFormValues>
{
  readonly #identifier: PathIdentifier<Path<TFormValues>>;
  readonly #aliases: ControlAliasMap<TLocalValues, TFormValues>;
  readonly #lastResolution: SingleEntryCache<Path<TLocalValues>, Path<TFormValues>>;
  readonly #cache = new Map<Path<TLocalValues>, PathId<Path<TFormValues>>>();

  constructor(identifier: PathIdentifier<Path<TFormValues>>, aliases: ControlAliasMap<TLocalValues, TFormValues>) {
    if (Object.keys(aliases).length === 0) {
      throw new Error("Control aliases cannot be empty.");
    }

    this.#identifier = identifier;
    this.#aliases = aliases;
    this.#lastResolution = new SingleEntryCache();
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

    const exactMatch = this.#aliases[path];

    if (exactMatch) {
      const id = this.#identifier.register(exactMatch);

      return this.#remember(path, exactMatch, id);
    }

    let prefix = path as string;

    while (true) {
      const lastDotIndex = prefix.lastIndexOf(".");

      if (lastDotIndex === -1) {
        break;
      }

      prefix = prefix.slice(0, lastDotIndex);

      const formPrefix = this.#aliases[prefix as Path<TLocalValues>];

      if (!formPrefix) {
        continue;
      }

      const resolvedPath = `${formPrefix}${(path as string).slice(prefix.length)}` as Path<TFormValues>;
      const id = this.#identifier.register(resolvedPath);

      return this.#remember(path, resolvedPath, id);
    }

    throw new Error(`Path \`${path}\` is outside this control aliases.`);
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
