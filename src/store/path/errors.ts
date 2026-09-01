/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { PathKind } from "./types";

export class InvalidPathSegment extends Error {
  constructor(segment: string) {
    super(`Invalid path segment: "${segment}".`);
    this.name = "InvalidPathSegment";
  }
}

export class UnknownPathId extends Error {
  constructor(id: number) {
    super(`Unknown path id: "${id}".`);
    this.name = "UnknownPathId";
  }
}

export class UnknownEntryId extends Error {
  constructor(id: number) {
    super(`Unknown entry id: "${id}".`);
    this.name = "UnknownEntryId";
  }
}

export class UnknownChildPath extends Error {
  constructor(parent: string, segment: string) {
    super(`Unknown child "${segment}" under path "${parent}".`);
    this.name = "UnknownChildPath";
  }
}

export class PathKindConflict extends Error {
  constructor(path: string, current: PathKind, expected: PathKind) {
    super(`Path "${path}" is already registered as "${current}", not "${expected}".`);
    this.name = "PathKindConflict";
  }
}

export class InvalidArrayIndex extends Error {
  constructor(path: string, segment: string) {
    super(`Segment "${segment}" of path "${path}" is not a valid array index.`);
    this.name = "InvalidArrayIndex";
  }
}

/**
 * A position was addressed beyond the current length of an array.
 *
 * Registration only appends: a path may claim the next free position, never a
 * gap. Resolution throws when the occupant it asks for no longer exists.
 */
export class MissingArrayPosition extends Error {
  constructor(index: number, length: number) {
    super(`Array position "${index}" does not exist. Current length is ${length}.`);
    this.name = "MissingArrayPosition";
  }
}

export class NotAnArrayEntry extends Error {
  constructor(id: number) {
    super(`Entry "${id}" is not an array.`);
    this.name = "NotAnArrayEntry";
  }
}
