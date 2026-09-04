/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { PathIndexEntry } from "../path/types";

/**
 * How a value lands on a location.
 *
 * Whatever it writes, it hands over each location it actually wrote. That is
 * the only thing a caller needs to know about the difference between one way of
 * landing a value and another, and it is what has to be reconciled afterwards.
 *
 * It visits rather than collects, because this runs on every write.
 */
export interface ValueWrite {
  write(entry: PathIndexEntry, value: unknown, visit: (written: PathIndexEntry) => void): void;
}
