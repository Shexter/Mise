/**
 * WCAG 2.1 relative-luminance contrast, used to pick the readable text token
 * for a filled badge rather than assuming white always works. Palettes range
 * from cream to near-black, so the correct answer differs per theme.
 */

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Accepts `#rgb` and `#rrggbb`. Returns null for anything else. */
export function relativeLuminance(hex: string): number | null {
  const raw = hex.trim().replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(full.slice(i, i + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** 1 when the colours are identical, 21 for black on white. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return 1;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The candidate that reads most clearly on `background`. */
export function readableOn(background: string, candidates: readonly string[]): string {
  let best = candidates[0] ?? background;
  let bestRatio = -1;
  for (const candidate of candidates) {
    const ratio = contrastRatio(background, candidate);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  return best;
}
