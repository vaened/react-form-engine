/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { PathIndexEntry } from "../path/types";

/**
 * How a value lands on a location.
 *
 * Whatever it writes, it answers with each location it actually wrote. That is
 * the only thing a caller needs to know about the difference between one way of
 * landing a value and another, and it is what has to be reconciled afterwards.
 *
 * How many those are is not something the caller can work out on its own: the
 * same value lands on one location or on the several it carries, depending on
 * how the form was built.
 */
export interface ValueWrite {
  write(entry: PathIndexEntry, value: unknown): readonly PathIndexEntry[];
}
