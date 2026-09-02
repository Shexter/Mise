import type { ImageSourcePropType } from "react-native";

/**
 * Cooking-technique artwork, and the matcher that decides when a step has
 * earned one.
 *
 * The vocabulary is bounded at twelve on purpose. Recipe steps are free text and
 * unbounded, so per-step art is not generable; what is generable is a small set
 * of recognisable actions, matched conservatively. A step that matches nothing
 * renders as the numbered text it already was — which is a complete state, not a
 * missing one. Filling the slot with an approximately-related picture would say
 * something about the step that the step does not say.
 *
 * The registry is a generated block of static `require()` literals, rewritten by
 * `scripts/generate-illustrations.ts --promote` and held to
 * `assets/illustrations/manifest.json` by `test/illustration-registries.test.ts`.
 */

export const TECHNIQUE_IDS = [
  "chop",
  "saute",
  "boil",
  "roast",
  "steam",
  "simmer",
  "marinate",
  "blend",
  "bake",
  "grill",
  "rest",
  "serve",
] as const;

export type TechniqueId = (typeof TECHNIQUE_IDS)[number];

export const TECHNIQUE_ILLUSTRATIONS: Record<TechniqueId, ImageSourcePropType> = {
  "bake": require("../../assets/illustrations/technique/bake.webp"),
  "blend": require("../../assets/illustrations/technique/blend.webp"),
  "boil": require("../../assets/illustrations/technique/boil.webp"),
  "chop": require("../../assets/illustrations/technique/chop.webp"),
  "grill": require("../../assets/illustrations/technique/grill.webp"),
  "marinate": require("../../assets/illustrations/technique/marinate.webp"),
  "rest": require("../../assets/illustrations/technique/rest.webp"),
  "roast": require("../../assets/illustrations/technique/roast.webp"),
  "saute": require("../../assets/illustrations/technique/saute.webp"),
  "serve": require("../../assets/illustrations/technique/serve.webp"),
  "simmer": require("../../assets/illustrations/technique/simmer.webp"),
  "steam": require("../../assets/illustrations/technique/steam.webp"),
};

/** What the artwork depicts, for the rare caller that needs to announce it. */
export const TECHNIQUE_LABELS: Record<TechniqueId, string> = {
  chop: "Chopping",
  saute: "Sautéing",
  boil: "Boiling",
  roast: "Roasting",
  steam: "Steaming",
  simmer: "Simmering",
  marinate: "Marinating",
  blend: "Blending",
  bake: "Baking",
  grill: "Grilling",
  rest: "Resting",
  serve: "Serving",
};

export function isTechniqueId(value: unknown): value is TechniqueId {
  return typeof value === "string" && (TECHNIQUE_IDS as readonly string[]).includes(value);
}

/**
 * Phrases that identify a technique when the step *leads* with them.
 *
 * Leading position is what makes these safe. Cooking instructions are
 * imperative, so the first verb is the step's actual action: "Slice the onions"
 * is a knife step even though "slice" is a noun elsewhere.
 */
const TECHNIQUE_VERBS: Record<TechniqueId, readonly string[]> = {
  chop: ["chop", "finely chop", "roughly chop", "dice", "mince", "slice", "thinly slice", "julienne", "cube"],
  saute: ["saute", "sautee", "stir fry", "pan fry", "fry"],
  boil: ["boil", "parboil", "blanch"],
  roast: ["roast"],
  steam: ["steam"],
  simmer: ["simmer", "poach"],
  marinate: ["marinate", "marinade"],
  blend: ["blend", "puree", "blitz"],
  bake: ["bake"],
  grill: ["grill", "griddle", "sear", "broil", "char"],
  rest: ["rest", "let rest", "let it rest", "leave to rest", "allow to rest"],
  serve: ["serve", "plate", "plate up", "dish up", "garnish"],
};

/**
 * Phrases safe to match anywhere in a step.
 *
 * Deliberately narrower than the verb table, because mid-sentence words are
 * usually describing an ingredient rather than the action: "add the chopped
 * tomatoes and simmer" is a simmer step, so `chop` carries no mentions at all.
 * The guards that matter are here rather than in the algorithm:
 *
 * - `rest` never matches bare "rest", which appears in "the rest of the sauce".
 * - `bake` never matches "baking", which appears in "baking powder", "baking
 *   soda", "baking tray", and "baking paper".
 * - `serve` never matches bare "serving", which appears in "per serving".
 * - `roast` never matches bare "roast", which appears in "the roast chicken".
 */
const TECHNIQUE_MENTIONS: Record<TechniqueId, readonly string[]> = {
  chop: [],
  saute: ["saute", "sauteed", "sauteing", "stir fry", "stir frying"],
  boil: ["boil", "boiling", "to a boil", "to the boil"],
  roast: ["roasting", "roast for", "roast until"],
  steam: ["steam", "steaming", "steamer", "steam for"],
  simmer: ["simmer", "simmering", "simmer for", "simmer until", "poaching"],
  marinate: ["marinate", "marinating", "marinade", "marinate for"],
  blend: ["blend", "blending", "blend until", "puree"],
  bake: ["bake", "bake for", "bake until"],
  grill: ["grill", "grilling", "grill for", "searing", "seared", "under the grill"],
  rest: ["rest for", "to rest", "resting", "rest covered", "rest before"],
  serve: ["serve with", "serve immediately", "serve hot", "to serve", "and serve"],
};

/**
 * Words a step may open with before its real verb. A closed list: anything not
 * on it is treated as the verb, so an unrecognised opening word simply means no
 * leading match rather than a wrong one.
 */
const LEADING_ADVERBIALS = new Set([
  "then", "next", "meanwhile", "now", "first", "finally", "gently", "carefully",
  "immediately", "once", "afterwards", "lastly", "optionally", "quickly", "slowly",
]);

/** The longest verb phrase in either table, so the leading scan knows its window. */
const MAX_PHRASE_WORDS = 3;

/**
 * Lowercase, strip diacritics, and reduce everything else to single spaces, so
 * "Sauté" and "saute" are one key and "stir-fry" and "stir fry" are one phrase.
 * Phrase matching rather than stemming: a stemmer maps "the rest of the sauce"
 * onto `rest`, which is exactly the mistake this file exists to avoid.
 */
export function normalizeStepText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function leadingTechnique(normalized: string): TechniqueId | null {
  const words = normalized.split(" ").filter(Boolean);
  let start = 0;
  while (start < words.length && LEADING_ADVERBIALS.has(words[start]!)) start += 1;
  if (start >= words.length) return null;

  // Longest phrase first, so "stir fry" is not shadowed by a one-word match.
  for (let length = MAX_PHRASE_WORDS; length >= 1; length -= 1) {
    const candidate = words.slice(start, start + length).join(" ");
    if (candidate.length === 0) continue;
    for (const id of TECHNIQUE_IDS) {
      if (TECHNIQUE_VERBS[id].includes(candidate)) return id;
    }
  }
  return null;
}

function mentionedTechniques(normalized: string): TechniqueId[] {
  const padded = ` ${normalized} `;
  return TECHNIQUE_IDS.filter((id) =>
    TECHNIQUE_MENTIONS[id].some((phrase) => padded.includes(` ${phrase} `)),
  );
}

export interface TechniqueCandidate {
  /** A technique already stored against the step, if the step type carries one. */
  techniqueId?: string | null;
  instruction: string;
}

/**
 * The technique a step depicts, or `null` when no safe answer exists.
 *
 * Three ordered rules, each stricter than guessing:
 * 1. An explicitly stored technique id wins outright — stored intent beats
 *    inference, and the step text is not consulted.
 * 2. Otherwise the step's leading verb, which is the action an imperative
 *    instruction is actually about.
 * 3. Otherwise a mention scan, and only when it finds exactly one technique.
 *    Two mentions means the step spans two actions and picking either would
 *    misrepresent it; zero means the step is not one of the twelve.
 *
 * Pure and deterministic: the same step always resolves to the same technique.
 */
export function resolveTechnique(candidate: TechniqueCandidate): TechniqueId | null {
  if (isTechniqueId(candidate.techniqueId)) return candidate.techniqueId;

  const normalized = normalizeStepText(candidate.instruction ?? "");
  if (normalized.length === 0) return null;

  const leading = leadingTechnique(normalized);
  if (leading !== null) return leading;

  const mentioned = mentionedTechniques(normalized);
  return mentioned.length === 1 ? mentioned[0]! : null;
}

/** Every phrase the matcher knows, for the test that proves none is shared. */
export const TECHNIQUE_PHRASE_TABLES = {
  verbs: TECHNIQUE_VERBS,
  mentions: TECHNIQUE_MENTIONS,
} as const;
