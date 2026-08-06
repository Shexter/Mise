import {
  createDietaryRule,
  deleteDietaryRule,
  getCanonicalById,
  listDerivativeEdges,
  listDietaryRules,
  updateDietaryRuleKind,
  type NewDietaryRule,
} from '@/db/queries';
import { expandRules, type ExclusionSet } from '@/logic/dietary';
import { confirmMatch, resolveIngredientReferences } from '@/logic/resolution';
import { normalise } from '@/logic/normalise';
import type { DietaryRule, DietaryRuleKind } from '@/types';

/**
 * Binds the dietary rule CRUD in `queries.ts` to the app's one resolution
 * entry point (task 4.2: "do not add a second matching path"). The same
 * shape as `suggestionService.ts` and `depletionService.ts` — pure logic
 * elsewhere, wiring here.
 */

export type AddDietaryRuleResult =
  | { status: 'added'; rule: DietaryRule }
  | {
      status: 'needs_confirmation';
      raw: string;
      norm: string;
      canonicalId: string;
      confidence: number;
    };

/**
 * Records a rule. Resolution never blocks recording — an allergen the
 * catalogue cannot place is the worst case to refuse (task 4.4), so a
 * `resolved` or `unresolved` outcome both add the rule immediately, the
 * second keeping only the normalised text as its (weaker) match key.
 * `needs_confirmation` is the one outcome that pauses: the caller shows the
 * ask-band prompt and calls `confirmDietaryRule` or `addDietaryRuleAsText`
 * with the user's answer.
 */
export async function addDietaryRule(
  text: string,
  kind: DietaryRuleKind,
): Promise<AddDietaryRuleResult> {
  const [outcome] = await resolveIngredientReferences([{ raw: text }], 'dietary');
  if (!outcome) {
    return { status: 'added', rule: await createRule(kind, null, text, normalise(text)) };
  }

  if (outcome.status === 'resolved') {
    return {
      status: 'added',
      rule: await createRule(kind, outcome.canonicalId, text, outcome.norm),
    };
  }

  if (outcome.status === 'needs_confirmation') {
    return {
      status: 'needs_confirmation',
      raw: outcome.raw,
      norm: outcome.norm,
      canonicalId: outcome.canonicalId,
      confidence: outcome.confidence,
    };
  }

  // Unresolved: recorded anyway, by normalised name only (task 4.4).
  return { status: 'added', rule: await createRule(kind, null, text, outcome.norm) };
}

/** The user confirmed an ask-band match. Learns the alias, same as everywhere else confirmation happens. */
export async function confirmDietaryRule(
  text: string,
  kind: DietaryRuleKind,
  canonicalId: string,
): Promise<DietaryRule> {
  await confirmMatch(text, canonicalId);
  return createRule(kind, canonicalId, text, normalise(text));
}

/** The user rejected the ask-band match. Recorded by name only, same as an unresolved rule. */
export async function addDietaryRuleAsText(
  text: string,
  kind: DietaryRuleKind,
): Promise<DietaryRule> {
  return createRule(kind, null, text, normalise(text));
}

function createRule(
  kind: DietaryRuleKind,
  canonicalId: string | null,
  text: string,
  normalisedText: string,
): Promise<DietaryRule> {
  const input: NewDietaryRule = { kind, canonicalId, text, normalisedText };
  return createDietaryRule(input);
}

export { listDietaryRules, deleteDietaryRule, updateDietaryRuleKind };

/**
 * The display names of every derivative a rule additionally covers, beyond
 * the ingredient itself — "Milk also excludes butter, ghee, ..." (task 7.4).
 * Empty for a dislike, a rule with no known derivatives, or a rule that
 * never resolved to a canonical at all (a name-only match has no closure to
 * walk). The closure is already computed for exclusion; this just reads it
 * back and resolves display names, so showing it costs nothing extra.
 */
export async function ruleCoverage(rule: DietaryRule): Promise<string[]> {
  if (rule.canonicalId === null) return [];
  const map = await derivativeMap();
  const closure = expandRules([rule], map, [rule.kind]).canonicalIds;
  const names: string[] = [];
  for (const id of closure) {
    if (id === rule.canonicalId) continue;
    const canonical = await getCanonicalById(id);
    if (canonical) names.push(canonical.displayName);
  }
  return names;
}

/** The catalogue's derivative edges, reshaped for `expandRules`. Small graph — loaded whole. */
async function derivativeMap(): Promise<Map<string, string[]>> {
  const edges = await listDerivativeEdges();
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    const children = map.get(edge.parentId);
    if (children) children.push(edge.childId);
    else map.set(edge.parentId, [edge.childId]);
  }
  return map;
}

/**
 * What allergen and restriction rules exclude — the set `applyDietary`
 * checks a suggestion against. Both kinds carry the same enforcement policy
 * (proposal: "it filters hard, like an allergen, but the app may state it
 * plainly").
 */
export async function getExclusionSet(
  rules: readonly DietaryRule[],
): Promise<ExclusionSet> {
  return expandRules(rules, await derivativeMap(), ['allergen', 'restriction']);
}

/** Every canonical id down-ranked by the user's dislikes, expanded through derivatives. */
export async function dislikedCanonicalIds(
  rules: readonly DietaryRule[],
): Promise<ReadonlySet<string>> {
  return expandRules(rules, await derivativeMap(), ['dislike']).canonicalIds;
}

/** Whether the user has recorded at least one allergen — gates the unknown-excludes rule. */
export function hasAllergenRules(rules: readonly DietaryRule[]): boolean {
  return rules.some((rule) => rule.kind === 'allergen');
}
