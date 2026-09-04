/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { PathIndexEntry } from "../path/types";

/**
 * How a value lands on a location.
 *
 * Whatever it writes, it hands back the entries it actually wrote. That is the
 * only thing a caller needs to know about the difference between one way of
 * landing a value and another, and it is what has to be reconciled afterwards.
 */
export interface ValueWrite {
  write(entry: PathIndexEntry, value: unknown): readonly PathIndexEntry[];
}
