/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { FormValues, NodePath, Path, PathValue } from "../path";
import type { NodeControl } from "./Control";

export type ControlProjection<TValues extends FormValues> = {
  readonly [TKey: string]: Path<TValues> | ControlProjection<TValues>;
};

/** Every name a dotted one hangs from: `person.address.city` yields `person` and `person.address`. */
type Holders<TName extends string> = TName extends `${infer THead}.${infer TRest}`
  ? THead | (Holders<TRest> extends never ? never : `${THead}.${Holders<TRest>}`)
  : never;

/**
 * Refuses a projection where one name stands for a place of the form and also
 * holds others under it.
 *
 * Such a name can only be watched as the place it names, which reports whatever
 * changes beneath it — including the very locations the projection was told to
 * replace. Spelling the members out costs a line and leaves every name standing
 * for exactly one place.
 *
 * @example
 * // Refused: `person.name` hangs from `person`.
 * control.lens({ person: "invoice.client", "person.name": "invoice.series" });
 *
 * @example
 * // Say it as a group instead:
 * control.lens({
 *   person: { name: "invoice.series", email: "invoice.client.email" },
 * });
 */
export type WithoutOverrides<TValues extends FormValues, TProjection> = {
  [TKey in keyof TProjection]: TKey extends string
    ? [Extract<Holders<TKey>, keyof TProjection>] extends [never]
      ? TProjection[TKey] extends ControlProjection<TValues>
        ? WithoutOverrides<TValues, TProjection[TKey]>
        : TProjection[TKey]
      : `\`${TKey}\` hangs from \`${Extract<Holders<TKey>, keyof TProjection> & string}\`, which this projection already maps. Spell out its members instead.`
    : TProjection[TKey];
};

export type ProjectionValue<TValues extends FormValues, TProjection extends ControlProjection<TValues>> = {
  [TKey in keyof TProjection]: TProjection[TKey] extends Path<TValues>
    ? PathValue<TValues, TProjection[TKey]>
    : TProjection[TKey] extends ControlProjection<TValues>
      ? ProjectionValue<TValues, TProjection[TKey]>
      : never;
};

export type FocusedValue<TValues extends FormValues, TPath extends NodePath<TValues>> = Extract<
  PathValue<TValues, TPath>,
  FormValues
>;

export type LensSelection<TValues extends FormValues> = NodePath<TValues> | ControlProjection<TValues>;

export type LensResult<TValues extends FormValues, TSelection extends LensSelection<TValues>> =
  TSelection extends NodePath<TValues>
    ? NodeControl<FocusedValue<TValues, TSelection>>
    : TSelection extends ControlProjection<TValues>
      ? NodeControl<ProjectionValue<TValues, TSelection>>
      : never;
