/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, Path } from "../path";

export type ControlAliasMap<TLocalValues extends FormValues, TFormValues extends FormValues> = Partial<
  Record<Path<TLocalValues>, Path<TFormValues>>
>;

export class PathAliasMapper<TLocalValues extends FormValues, TFormValues extends FormValues> {
  readonly #aliases: ControlAliasMap<TLocalValues, TFormValues>;
  readonly #cache = new Map<Path<TLocalValues>, Path<TFormValues>>();

  constructor(aliases: ControlAliasMap<TLocalValues, TFormValues>) {
    if (Object.keys(aliases).length === 0) {
      throw new Error("Control aliases cannot be empty.");
    }

    this.#aliases = aliases;
  }

  get aliases(): Readonly<ControlAliasMap<TLocalValues, TFormValues>> {
    return this.#aliases;
  }

  resolve<TPath extends Path<TLocalValues>>(path: TPath): Path<TFormValues> {
    const cachedPath = this.#cache.get(path);

    if (cachedPath) {
      return cachedPath;
    }

    const exactMatch = this.#aliases[path];

    if (exactMatch) {
      this.#cache.set(path, exactMatch);
      return exactMatch;
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

      this.#cache.set(path, resolvedPath);

      return resolvedPath;
    }

    throw new Error(`Path \`${path}\` is outside this control aliases.`);
  }
}
