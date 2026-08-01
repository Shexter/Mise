/**
 * Approximate string similarity for alias matching: a character-trigram Dice
 * coefficient with a length-ratio penalty. Pure and dependency-free — roughly
 * thirty lines that run fine over a few thousand aliases on a phone.
 *
 * Works on normalised strings (see `normalise.ts`). Operates on characters,
 * so CJK strings score the same way Latin ones do.
 */

/**
 * The confidence bands for approximate matches (decision 32 — OPEN).
 * Above `MATCH_ACCEPT`: accept silently. Between the two: accept but flag
 * for one-tap confirmation. Below `MATCH_CONFIRM`: treat as unresolved.
 * Placeholders, deliberately named and kept in one place so tuning against
 * real receipts is a one-line change.
 */
export const MATCH_ACCEPT = 0.85;
export const MATCH_CONFIRM = 0.6;

/**
 * Character trigrams with boundary padding (two spaces in front, one behind,
 * pg_trgm style) so short strings still produce a usable set.
 */
export function trigrams(value: string): Set<string> {
  const padded = `  ${value} `;
  const grams = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i += 1) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

/**
 * Similarity in [0, 1]. Dice over trigram sets, discounted when the strings
 * differ badly in length — which is what stops `soy` matching
 * `soy sauce dark` on containment alone.
 */
export function similarity(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  if (a === b) return 1;

  const gramsA = trigrams(a);
  const gramsB = trigrams(b);
  let shared = 0;
  for (const gram of gramsA) {
    if (gramsB.has(gram)) shared += 1;
  }
  const dice = (2 * shared) / (gramsA.size + gramsB.size);

  const ratio =
    Math.min(a.length, b.length) / Math.max(a.length, b.length);
  // Only differences past 2:1 are penalised; abbreviation is normal on
  // receipts and a mild mismatch should not drag a good trigram score down.
  const penalty = Math.min(1, ratio * 2);

  return dice * penalty;
}
