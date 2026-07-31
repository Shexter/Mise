import {
  getAllCanonicals,
  insertCanonicalItem,
  recordUserResolution,
} from '@/db/queries';
import type { CanonicalProposal } from '@/logic/match';
import { normalise } from '@/logic/normalise';
import { MATCH_ACCEPT, MATCH_CONFIRM, similarity } from '@/logic/similarity';
import type { CanonicalItem } from '@/types';

/* -------------------------------------------------------------------------- */
/* Duplicate-guarded canonical creation                                        */
/* -------------------------------------------------------------------------- */

export type DuplicateCheck =
  | { verdict: 'distinct' }
  | { verdict: 'duplicate'; existing: CanonicalItem; score: number }
  | { verdict: 'ask'; existing: CanonicalItem; score: number };

/**
 * The gate in front of canonical creation (decision: reuse the matcher).
 * Scores the proposed display name against every existing canonical name.
 * Above `MATCH_ACCEPT` the existing row should be reused; between the
 * thresholds the user must confirm they are distinct.
 */
export async function checkForDuplicate(
  displayName: string,
): Promise<DuplicateCheck> {
  const proposed = normalise(displayName);
  let best: { item: CanonicalItem; score: number } | null = null;
  for (const item of await getAllCanonicals()) {
    const score = similarity(proposed, normalise(item.displayName));
    if (!best || score > best.score) best = { item, score };
  }
  if (!best || best.score < MATCH_CONFIRM) return { verdict: 'distinct' };
  if (best.score >= MATCH_ACCEPT) {
    return { verdict: 'duplicate', existing: best.item, score: best.score };
  }
  return { verdict: 'ask', existing: best.item, score: best.score };
}

export type CreateCanonicalResult =
  | { kind: 'created'; item: CanonicalItem }
  | { kind: 'reused'; item: CanonicalItem }
  | { kind: 'needs_confirmation'; existing: CanonicalItem; score: number };

/**
 * Creates a canonical ingredient from a confirmed proposal, unless an
 * equivalent one already exists. `userConfirmedDistinct` is the "yes, these
 * are different" answer from the ask band — creation between the thresholds
 * without it returns `needs_confirmation` instead of writing anything.
 */
export async function createCanonicalFromProposal(
  proposal: CanonicalProposal,
  options: { userConfirmedDistinct?: boolean } = {},
): Promise<CreateCanonicalResult> {
  const check = await checkForDuplicate(proposal.displayName);
  if (check.verdict === 'duplicate') {
    await recordUserResolution(proposal.displayName, check.existing.id);
    return { kind: 'reused', item: check.existing };
  }
  if (check.verdict === 'ask' && !options.userConfirmedDistinct) {
    return {
      kind: 'needs_confirmation',
      existing: check.existing,
      score: check.score,
    };
  }

  const item = await insertCanonicalItem({
    id: await availableSlug(proposal.displayName),
    displayName: proposal.displayName,
    foodClass: proposal.foodClass,
    defaultLocation: proposal.defaultLocation,
    shelfLifeDays: proposal.shelfLifeDays,
    openLifeDays: proposal.openLifeDays,
    typicalUseQty: proposal.typicalUseQty,
    typicalUseUnit: proposal.typicalUseUnit,
  });
  await recordUserResolution(proposal.displayName, item.id);
  return { kind: 'created', item };
}

/** `Light soy sauce` → `light-soy-sauce`; CJK names keep their script. */
export function slugify(displayName: string): string {
  const slug = normalise(displayName).replace(/\s+/g, '-');
  return slug.length > 0 ? slug : 'item';
}

async function availableSlug(displayName: string): Promise<string> {
  const base = slugify(displayName);
  const taken = new Set((await getAllCanonicals()).map((item) => item.id));
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}
