/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

export type Path = string;

declare const pathIdBrand: unique symbol;

export type PathId<TPath extends Path = Path> = number & {
  readonly [pathIdBrand]: TPath;
};

export interface PathIdentifier<TPath extends Path = Path> {
  register(path: TPath): PathId<TPath>;

  identify(path: TPath): PathId<TPath>;

  describe(id: PathId<TPath>): TPath;
}

export class PathRegistry<TPath extends Path = Path> implements PathIdentifier<TPath> {
  #nextId = 1;

  readonly #ids = new Map<TPath, PathId<TPath>>();
  readonly #paths: Array<TPath | undefined> = [];

  register(path: TPath): PathId<TPath> {
    PathRegistry.assertValid(path);

    const existing = this.#ids.get(path);

    if (existing !== undefined) {
      return existing;
    }

    const id = this.#nextId as PathId<TPath>;

    this.#nextId += 1;

    this.#ids.set(path, id);
    this.#paths[id as number] = path;

    return id;
  }

  identify(path: TPath): PathId<TPath> {
    const id = this.#ids.get(path);

    if (id === undefined) {
      throw new Error(`Path "${path}" has not been registered.`);
    }

    return id;
  }

  describe(id: PathId<TPath>): TPath {
    const path = this.#paths[id as number];

    if (path === undefined) {
      throw new Error(`Path id "${id}" has not been registered.`);
    }

    return path;
  }

  unregister(path: TPath): boolean {
    const id = this.#ids.get(path);

    if (id === undefined) {
      return false;
    }

    this.#ids.delete(path);
    delete this.#paths[id as number];

    return true;
  }

  clear(): void {
    this.#ids.clear();
    this.#paths.length = 0;
    this.#nextId = 1;
  }

  static assertValid(path: Path): void {
    if (!path) {
      throw new Error("Path cannot be empty.");
    }

    if (path.startsWith(".") || path.endsWith(".") || path.includes("..")) {
      throw new Error(`Invalid path "${path}".`);
    }
  }
}
