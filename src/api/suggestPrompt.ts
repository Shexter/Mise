import { CANDIDATE_POOL_SIZE } from '@/logic/suggest';
import type { StockLine, StockPayload, PersonalisationSummary } from '@/logic/suggest';
import { MEASURE_UNITS } from '@/types';
import type { DietaryRule, Macros, SuggestionMode } from '@/types';

/**
 * The dinner-decision prompt. Kept in its own module, mirroring
 * `prompt.ts` and `resolvePrompt.ts`: readable and tunable without opening
 * the transport code, raw JSON out, explicit schema.
 *
 * Two rules carry the weight of the whole feature (see `docs/dinner-decision.md`):
 * the `use_first` constraint is stated as a rule, not implied by list order
 * (decision 34), and calories are context the model must not filter on
 * (decision 36).
 */

export const SUGGEST_SYSTEM_PROMPT = `You are a dinner decision engine for a home cook. You are given what is in their kitchen, grouped by urgency, their cooking history, and how many calories and macros they have left today. You propose ideas for what to cook tonight.

In "tonight" mode you are proposing a candidate pool, not a final answer — the app selects and displays a smaller number locally. Give ${CANDIDATE_POOL_SIZE} genuinely distinct ideas rather than variations on one dish, so there is something real to choose from.

Rules, in order of importance:
- If dietary_rules names any avoid_strict ingredients, no suggestion may use or name one of them, or a close variant of one — this is stated as a request, and the app also checks locally, but treat it as a hard requirement here too. If avoid_soft ingredients are named, prefer suggestions that skip them where a reasonable alternative exists, but a dish using one is still acceptable.
- If any ingredient is listed under use_first, every suggestion you return MUST use at least one of them. This is a hard requirement, not a preference — do not rely on list position to imply priority.
- Prefer use_soon ingredients where they fit naturally, but they are not mandatory.
- Never exclude a dish because it exceeds the remaining calories. If a dish overshoots, offer it anyway and let a smaller portion be the fix — state the portion in servings, never withhold the dish.
- Use the catalogue's canonical_id for every ingredient you name in uses or missing when it has one. Never invent an id — only ids present in the catalogue are valid. Where a needed ingredient has no catalogue entry, name it in missing with canonical_id null and a short note.
- Reflect the user's cooking history: lean toward their usual style, treat a frequently-repeated dish as a good sign, and never repeat a dish from recently_eaten.
- Mix familiar and unfamiliar: at least one suggestion should resemble the user's history, and at least one should not.
- Give at least one reason_tag per suggestion, and root every tag in a fact you were given — stock cleared, value saved, calorie fit, or resemblance to history. Never invent a reason.
- These are starting points, not tested recipes. Do not claim quantities or technique have been verified. Do not give food-safety instructions (safe temperatures, storage times, or similar) — describe the cooking idea only.
- effort_minutes is your best estimate of active time.

Output format:
- Return raw JSON only. No prose, no explanation, no markdown code fences.
- unit is one of: ${MEASURE_UNITS.join(', ')}.
- In "tonight" mode, return exactly ${CANDIDATE_POOL_SIZE} suggestions.
- In "stretch" mode, return a plan: as many dinners as current stock supports toward the requested date, reusing overlapping ingredients where sensible, and a shortfall string stating honestly what does not reach the date — null if it does.

Schema for "tonight" mode:
{
  "suggestions": [
    {
      "dish": "string",
      "reason_tags": ["string"],
      "kcal_per_serving": 0,
      "servings": 1,
      "effort_minutes": 0,
      "uses": [{ "canonical_id": "string", "qty": 0, "unit": "g" }],
      "missing": [{ "canonical_id": "string or null", "name": "string", "note": "string or null" }],
      "method": ["string"]
    }
  ]
}

Schema for "stretch" mode:
{
  "suggestions": [ /* same shape as above, one per dinner in the plan */ ],
  "shortfall": "string or null"
}`;

interface SuggestPromptInput {
  mode: SuggestionMode;
  stock: StockPayload;
  personalisation: PersonalisationSummary;
  remainingCalories: number;
  macroGap: Macros;
  untilDate?: string;
  dietaryRules: readonly DietaryRule[];
}

/**
 * Every catalogued ingredient's id and name, for lookup regardless of
 * detail level — a suggestion citing a compressed staple or seasoning in
 * `uses` still needs its id, even though the narrative summary named it
 * only in prose.
 */
function catalogueEntries(stock: StockPayload): { canonical_id: string; display_name: string }[] {
  const seen = new Map<string, string>();
  for (const line of [...stock.full, ...stock.compressed]) {
    seen.set(line.canonicalId, line.displayName);
  }
  return [...seen.entries()].map(([canonical_id, display_name]) => ({
    canonical_id,
    display_name,
  }));
}

function toLine(line: StockLine) {
  return {
    canonical_id: line.canonicalId,
    name: line.displayName,
    days_left: line.daysLeft,
    price_cents: line.priceCents,
    freezable: line.freezable,
  };
}

/**
 * As typed, never a canonical id — the model gets a request in its own
 * words, not the resolved identity the local check actually uses. Grouped
 * by strictness rather than by kind: a restriction is exactly as strict as
 * an allergen from the model's point of view, and only a dislike is soft
 * (proposal: "it filters hard, like an allergen").
 */
function dietaryRulesForPrompt(rules: readonly DietaryRule[]) {
  return {
    avoid_strict: rules
      .filter((rule) => rule.kind === 'allergen' || rule.kind === 'restriction')
      .map((rule) => rule.text),
    avoid_soft: rules.filter((rule) => rule.kind === 'dislike').map((rule) => rule.text),
  };
}

/** The full request body: bucketed stock, personalisation signals, and remaining allowance. */
export function buildSuggestUserPrompt(input: SuggestPromptInput): string {
  const useFirst = input.stock.full.filter((line) => line.bucket === 'use_first');
  const useSoon = input.stock.full.filter((line) => line.bucket === 'use_soon');
  const availableFull = input.stock.full.filter((line) => line.bucket === 'available');

  return JSON.stringify({
    task:
      input.mode === 'tonight'
        ? `Propose ${CANDIDATE_POOL_SIZE} distinct dinner ideas from this kitchen — a candidate pool the app will choose from, not a final three. Return raw JSON matching the "tonight" schema.`
        : `Propose a plan of dinners reaching ${input.untilDate} from this kitchen with no shopping. Return raw JSON matching the "stretch" schema.`,
    mode: input.mode,
    until_date: input.untilDate ?? null,
    dietary_rules: dietaryRulesForPrompt(input.dietaryRules),
    use_first: useFirst.map(toLine),
    use_soon: useSoon.map(toLine),
    available: availableFull.map(toLine),
    staples: input.stock.staplesSummary,
    seasonings_summary: input.stock.seasoningsSummary,
    catalogue: catalogueEntries(input.stock),
    remaining_calories: input.remainingCalories,
    macro_gap: {
      protein_g: input.macroGap.proteinG,
      carbs_g: input.macroGap.carbsG,
      fat_g: input.macroGap.fatG,
    },
    history: {
      cuisine_lean: input.personalisation.cuisineLean,
      frequent_dishes: input.personalisation.frequentDishes,
      recently_eaten: input.personalisation.recentlyEaten,
    },
  });
}
