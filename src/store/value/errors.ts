/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

export class InvalidRootValue extends Error {
  constructor() {
    super("The root value of a form must be an object.");
    this.name = "InvalidRootValue";
  }
}

export class PathInsideValue extends Error {
  constructor(path: string, holder: string) {
    super(`Path "${path}" goes inside "${holder}", which the form holds as one value.`);
    this.name = "PathInsideValue";
  }
}

export class CircularPatchValue extends Error {
  constructor(path: string) {
    super(`The value assigned to "${path}" reaches itself, so it has no end to write.`);
    this.name = "CircularPatchValue";
  }
}
