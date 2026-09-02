/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

export enum StateFlag {
  Dirty = 1 << 0,
  Touched = 1 << 1,
  Invalid = 1 << 2,
  Validating = 1 << 3,
}

export function hasFlag(flags: number, flag: StateFlag): boolean {
  return (flags & flag) === flag;
}

export function setFlag(flags: number, flag: StateFlag, value: boolean): number {
  return value ? flags | flag : flags & ~flag;
}
