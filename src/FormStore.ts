/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { Path, PathValue } from "./path";
import { type PathIdentifier, PathRegistry } from "./store/state/PathRegistry";

export type FormValues = Record<string, unknown>;

export type FormMode = "full" | "patch";

export type FieldState = {
  flags: number;
  errors: unknown[];
};

type PathNode = {
  children: Map<string, PathNode>;
  parent: PathNode | null;
  state?: FieldState;
};

function createFieldState(): FieldState {
  return {
    errors: [],
    flags: 0,
  };
}

export type FormStoreOptions<TValues extends FormValues> = {
  values: TValues;
  defaults?: TValues;
  mode?: FormMode;
};

export class FormStore<TValues extends FormValues> {
  readonly #registry: PathRegistry<Path<TValues>>;
  readonly #mode: FormMode;
  readonly #nodes = new Map<string, PathNode>();
  readonly #root: PathNode;

  #values: TValues;
  #defaults: TValues;
  #states = new Map<string, FieldState>();

  constructor(options: FormStoreOptions<TValues>) {
    this.#mode = options.mode ?? "full";
    this.#values = options.values;
    this.#defaults = options.defaults ?? options.values;
    this.#registry = new PathRegistry<Path<TValues>>();
    this.#root = {
      children: new Map(),
      parent: null,
    };
  }

  get mode(): FormMode {
    return this.#mode;
  }

  get values(): TValues {
    return this.#values;
  }

  get defaults(): TValues {
    return this.#defaults;
  }

  get states(): ReadonlyMap<string, FieldState> {
    return this.#states;
  }

  get identifier(): PathIdentifier<Path<TValues>> {
    return this.#registry;
  }

  register<TPath extends Path<TValues>>(path: TPath): FieldState {
    const existingState = this.#states.get(path);

    if (existingState) {
      return existingState;
    }

    const node = this.#ensureNode(path);
    const state = createFieldState();

    node.state = state;
    this.#states.set(path, state);

    return state;
  }

  unregister<TPath extends Path<TValues>>(path: TPath): void {
    const node = this.#nodes.get(path);

    if (!node?.state) {
      return;
    }

    delete node.state;
    this.#states.delete(path);
  }

  getState<TPath extends Path<TValues>>(path: TPath): FieldState | undefined {
    return this.#states.get(path);
  }

  set<TPath extends Path<TValues>>(path: TPath, value: PathValue<TValues, TPath>): void {
    FormStore.setAtPath(this.#values, path, value);
  }

  #ensureNode(path: string): PathNode {
    const existingNode = this.#nodes.get(path);

    if (existingNode) {
      return existingNode;
    }

    const segments = path.split(".");

    let currentNode = this.#root;
    let currentPath = "";

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}.${segment}` : segment;

      let nextNode = currentNode.children.get(segment);

      if (!nextNode) {
        nextNode = {
          children: new Map(),
          parent: currentNode,
        };

        currentNode.children.set(segment, nextNode);
        this.#nodes.set(currentPath, nextNode);
      }

      if (!nextNode) {
        throw new Error(`Failed to create path node for \`${currentPath}\`.`);
      }

      currentNode = nextNode;
    }

    return currentNode;
  }

  static setAtPath<TValue>(target: unknown, path: string, value: TValue): void {
    const segments = path.split(".");

    if (segments.length === 0) {
      return;
    }

    let current = target as Record<string, unknown>;

    for (const segment of segments.slice(0, -1)) {
      current = current[segment] as Record<string, unknown>;
    }

    const lastSegment = segments[segments.length - 1];

    if (lastSegment === undefined) {
      return;
    }

    current[lastSegment] = value;
  }
}
