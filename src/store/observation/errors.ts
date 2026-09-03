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

export class RootHasNoParent extends Error {
  constructor() {
    super("The root observation has nothing above it.");
    this.name = "RootHasNoParent";
  }
}
