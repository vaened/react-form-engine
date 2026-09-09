/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

/**
 * A name of a projection both stands for a place of the form and holds other
 * names under it.
 *
 * Such a name can only be watched as the place it names, which reports whatever
 * changes beneath it — including the very locations the projection was told to
 * replace.
 */
export class OverlappingAlias extends Error {
  constructor(local: string, holder: string) {
    super(
      `Alias \`${local}\` hangs from \`${holder}\`, which this control already maps. ` +
        `A name cannot both stand for a place and hold others: spell out the members of \`${holder}\` instead.`,
    );
    this.name = "OverlappingAlias";
  }
}
