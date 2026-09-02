/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

/**
 * A place inside the form value that can hold other values.
 *
 * Writing needs one of these plus a key: an object addressed by property name,
 * or an array addressed by position.
 */
export type ValueContainer = Record<string, unknown> | unknown[];
