/** Pure state helper for single-expanded repeated editors. */
export function nextExpandedId(current: string | null, requested: string): string | null {
  return current === requested ? null : requested;
}
