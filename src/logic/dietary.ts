import { normalise } from '@/logic/normalise';
import type { DietaryRule, DietaryRuleKind, Suggestion, SuggestionMissing, SuggestionUse } from '@/types';

/**
 * What the user cannot or will not eat, and whether a suggestion violates it
 * (`add-dietary-profile`). Pure — no database, no network — so the fixture
 * corpus in `__fixtures__/dietary.ts` can exercise every case without a
 * provider or a test database.
 *
 * The absolute/preference split lives entirely in which `kinds` are passed
 * to `expandRules`: allergens and restrictions build the exclusion set that
 * `applyDietary` drops a suggestion for; dislikes build a separate set that
 * `dishScore.ts` weights instead (decision: extend the real scorer rather
 * than build a second ranking mechanism beside it).
 */

export interface ExclusionSet {
  /** Every canonical id a rule names, expanded through the derivative closure. */
  canonicalIds: ReadonlySet<string>;
  /** Normalised text of rules that did not resolve to a canonical — the weaker, name-only match. */
  unresolvedText: ReadonlySet<string>;
}

/**
 * Expands a rule set into what it excludes. `derivatives` is the catalogue's
 * parent → children edges, already fetched — this function does not touch
 * the database, so the closure it walks is a plain in-memory map, not a
 * second implementation of the recursive SQL query in `queries.ts`
 * (`expandDerivatives`), which remains the source of truth for the graph
 * itself.
 */
export function expandRules(
  rules: readonly DietaryRule[],
  derivatives: ReadonlyMap<string, readonly string[]>,
  kinds: readonly DietaryRuleKind[],
): ExclusionSet {
  const canonicalIds = new Set<string>();
  const unresolvedText = new Set<string>();

  for (const rule of rules) {
    if (!kinds.includes(rule.kind)) continue;
    if (rule.canonicalId === null) {
      unresolvedText.add(rule.normalisedText);
      continue;
    }
    for (const id of closureOf(rule.canonicalId, derivatives)) {
      canonicalIds.add(id);
    }
  }

  return { canonicalIds, unresolvedText };
}

function closureOf(
  seed: string,
  derivatives: ReadonlyMap<string, readonly string[]>,
): Set<string> {
  const seen = new Set<string>([seed]);
  const queue = [seed];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of derivatives.get(current) ?? []) {
      if (seen.has(child)) continue; // cycle-safe, same guarantee as the SQL closure
      seen.add(child);
      queue.push(child);
    }
  }
  return seen;
}

export interface DietaryVerdict {
  excluded: boolean;
  /** What explains the exclusion — a canonical id or an ingredient's name. Null when not excluded. */
  reason: string | null;
}

const NOT_EXCLUDED: DietaryVerdict = { excluded: false, reason: null };

/**
 * Whether a suggestion violates an exclusion set. Checks `uses` by exact
 * canonical identity (task 6.4 — what the model now returns), and `missing`
 * both by canonical identity and, for a rule that never resolved, by
 * normalised name. An ingredient in `missing` with no canonical id at all
 * excludes only when at least one allergen rule exists (`hasAllergenRules`)
 * — the unknown-excludes-for-allergens-only asymmetry the design argues
 * for: a lost suggestion costs less than a missed exclusion, but only where
 * the cost of being wrong is a safety matter.
 */
export function applyDietary(
  suggestion: Pick<Suggestion, 'uses' | 'missing'>,
  exclusionSet: ExclusionSet,
  hasAllergenRules: boolean,
): DietaryVerdict {
  for (const use of suggestion.uses as readonly SuggestionUse[]) {
    if (exclusionSet.canonicalIds.has(use.canonicalId)) {
      return { excluded: true, reason: use.canonicalId };
    }
  }

  for (const item of suggestion.missing as readonly SuggestionMissing[]) {
    if (item.canonicalId !== null) {
      if (exclusionSet.canonicalIds.has(item.canonicalId)) {
        return { excluded: true, reason: item.canonicalId };
      }
      continue;
    }
    if (exclusionSet.unresolvedText.has(normalise(item.name))) {
      return { excluded: true, reason: item.name };
    }
    if (hasAllergenRules) {
      return { excluded: true, reason: `unresolved ingredient: ${item.name}` };
    }
  }

  return NOT_EXCLUDED;
}
