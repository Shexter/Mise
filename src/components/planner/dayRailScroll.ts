/**
 * Where the day rail has to sit for the selected day to be fully visible.
 *
 * Seven day tiles rarely fit a phone, so the rail scrolls. Left alone it opens
 * at offset zero, which puts Monday on screen and clips whatever is selected
 * near the other end — on a Sunday that is today, the one day the page is about.
 *
 * Content coordinates throughout: the tile's `x` is its offset inside the
 * scroll content, which is the space `scrollTo({ x })` reads. It is not the
 * window coordinate a drag gesture reports, and the two must not be mixed.
 */

export interface DayRailGeometry {
  /** The selected tile's offset inside the scroll content. */
  tileX: number;
  tileWidth: number;
  /** The visible width of the rail. */
  viewportWidth: number;
  /** The full width of all tiles plus padding. */
  contentWidth: number;
}

/**
 * Centres the selected tile where the week allows it, and sits flush against an
 * end where it does not — so the first and last days of a week are reachable
 * rather than centred into empty space.
 *
 * Returns `0` when everything already fits, which is the correct resting place
 * for a rail with nothing to scroll.
 */
export function dayRailOffset({
  tileX,
  tileWidth,
  viewportWidth,
  contentWidth,
}: DayRailGeometry): number {
  const furthest = Math.max(0, contentWidth - viewportWidth);
  if (furthest === 0) return 0;
  const centred = tileX + tileWidth / 2 - viewportWidth / 2;
  return Math.min(Math.max(0, centred), furthest);
}
