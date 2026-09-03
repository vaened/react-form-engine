/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

export class UnknownObservation extends Error {
  constructor(id: number) {
    super(`Nothing is observing entry "${id}".`);
    this.name = "UnknownObservation";
  }
}

/** The root is where every walk ends, so it can never leave the chain. */
export class RootObservationRequired extends Error {
  constructor() {
    super("The root observation cannot be removed.");
    this.name = "RootObservationRequired";
  }
}

/** A parent that already left would take its whole subtree out of the chain. */
export class DetachedObservationParent extends Error {
  constructor(id: number) {
    super(`Entry "${id}" already left the chain and cannot be given children.`);
    this.name = "DetachedObservationParent";
  }
}

/**
 * Taking a child away from a parent it never reported to would leave it
 * reporting somewhere it does not belong, and whatever travels up the chain
 * would reach the wrong place.
 */
export class UnexpectedObservationParent extends Error {
  constructor(id: number) {
    super(`Entry "${id}" does not currently report to the given parent.`);
    this.name = "UnexpectedObservationParent";
  }
}

/** Taking the same child over twice would move it, and count it, twice. */
export class DuplicatedObservationChild extends Error {
  constructor(id: number) {
    super(`Entry "${id}" appears more than once among the children being taken over.`);
    this.name = "DuplicatedObservationChild";
  }
}
