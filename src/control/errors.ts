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
/**
 * A path was asked of a control whose map neither answers for it nor holds
 * anything under it.
 *
 * A control answers only for the names its map spells. Reaching past them is
 * reaching outside the domain the control was derived to cover.
 */
export class PathOutsideControl extends Error {
  constructor(path: string) {
    super(`Path \`${path}\` is outside this control aliases.`);
    this.name = "PathOutsideControl";
  }
}

/** A control was derived over a map that names nothing. */
export class EmptyAliasMap extends Error {
  constructor() {
    super("Control aliases cannot be empty.");
    this.name = "EmptyAliasMap";
  }
}

/** A lens was given a projection that names nothing. */
export class EmptyProjection extends Error {
  constructor() {
    super("Control projection cannot be empty.");
    this.name = "EmptyProjection";
  }
}

export class OverlappingAlias extends Error {
  constructor(local: string, holder: string) {
    super(
      `Alias \`${local}\` hangs from \`${holder}\`, which this control already maps. ` +
        `A name cannot both stand for a place and hold others: spell out the members of \`${holder}\` instead.`,
    );
    this.name = "OverlappingAlias";
  }
}
