import type { Fullness, MeasureUnit, StatedQuantity, StorageLocation } from '@/types';

/**
 * Turns a transcript into pantry candidates. Pure: no network, no microphone,
 * no database, no clock.
 *
 * The job is narrower than it looks. This module does not decide what food
 * anything *is* — that is the canonical resolver's job, and duplicating even a
 * little of it here would create a second identity layer that drifts. What it
 * does is cut a sentence into item-sized pieces and read the numbers, which is
 * the part the resolver cannot do because the resolver sees one name at a time.
 *
 * Three rules shape almost every decision below:
 *
 *   1. **A number is not a quantity until something owns it.** "Two 400 gram
 *      cans" is two containers of 400 g; "one dozen is not two dozen" is a
 *      sentence about nothing. The parser tracks what each number attaches to
 *      and drops the ones that attach to nothing.
 *   2. **A hedge survives.** "About half a jar" must not arrive at review as
 *      0.5, because 0.5 is a number the pantry is allowed to show back.
 *   3. **Producing nothing beats producing something wrong.** An unrecognised
 *      phrase goes to `unused`, where the user can see it, rather than becoming
 *      an ingredient named "not that one".
 */

/** One candidate read out of the transcript. */
export interface ParsedVoiceItem {
  /** The words this came from, verbatim, for review. */
  span: string;
  /** The food name as spoken, in its original script. Never romanised. */
  name: string;
  quantity: StatedQuantity;
  /** A storage kind named in or before this phrase. Null when none was. */
  location: StorageLocation | null;
  /** Stated fullness, where the words carried one. */
  fullness: Fullness | null;
  /** True when the amount is what is left rather than what was bought. */
  remaining: boolean;
  /** Stated opened state. Null when the user said nothing about it. */
  opened: boolean | null;
}

export interface ParsedTranscript {
  items: ParsedVoiceItem[];
  /** Phrases that produced no candidate, kept so the user can see the gap. */
  unused: string[];
}

export interface ParseOptions {
  /**
   * Known food names, lowercased, used only to split run-on speech with no
   * punctuation ("milk eggs bread butter"). Without it that phrase stays one
   * candidate, which is a miss rather than an invention — and telling "milk
   * eggs" (two foods) from "spring onion" (one food) is not decidable from the
   * words alone.
   */
  knownNames?: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                  */
/* -------------------------------------------------------------------------- */

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100, dozen: 12,
  // CJK numerals. 兩 is the counting form of 2 and is the one that appears
  // before a measure word.
  一: 1, 二: 2, 兩: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

/** Fractions, and whether saying one is a measurement or a gesture. */
const FRACTION_WORDS: Readonly<Record<string, number>> = {
  half: 0.5, halves: 0.5, quarter: 0.25, quarters: 0.25, third: 1 / 3,
  thirds: 1 / 3, 半: 0.5,
};

interface UnitSpec {
  unit: MeasureUnit;
  /** Multiplier onto the canonical unit — a kilo is 1000 grams. */
  factor: number;
}

const UNIT_WORDS: Readonly<Record<string, UnitSpec>> = {
  g: { unit: 'g', factor: 1 }, gram: { unit: 'g', factor: 1 },
  grams: { unit: 'g', factor: 1 }, gramme: { unit: 'g', factor: 1 },
  grammes: { unit: 'g', factor: 1 }, 克: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 }, kilo: { unit: 'g', factor: 1000 },
  kilos: { unit: 'g', factor: 1000 }, kilogram: { unit: 'g', factor: 1000 },
  kilograms: { unit: 'g', factor: 1000 },
  ml: { unit: 'ml', factor: 1 }, millilitre: { unit: 'ml', factor: 1 },
  millilitres: { unit: 'ml', factor: 1 }, milliliter: { unit: 'ml', factor: 1 },
  milliliters: { unit: 'ml', factor: 1 },
  l: { unit: 'ml', factor: 1000 }, litre: { unit: 'ml', factor: 1000 },
  litres: { unit: 'ml', factor: 1000 }, liter: { unit: 'ml', factor: 1000 },
  liters: { unit: 'ml', factor: 1000 }, 升: { unit: 'ml', factor: 1000 },
  cup: { unit: 'cup', factor: 1 }, cups: { unit: 'cup', factor: 1 },
  tbsp: { unit: 'tbsp', factor: 1 }, tablespoon: { unit: 'tbsp', factor: 1 },
  tablespoons: { unit: 'tbsp', factor: 1 },
  tsp: { unit: 'tsp', factor: 1 }, teaspoon: { unit: 'tsp', factor: 1 },
  teaspoons: { unit: 'tsp', factor: 1 },
  slice: { unit: 'slice', factor: 1 }, slices: { unit: 'slice', factor: 1 },
  piece: { unit: 'piece', factor: 1 }, pieces: { unit: 'piece', factor: 1 },
};

/**
 * Words that name a physical container. Only these create pantry rows — a
 * count with no container word is an amount inside one row, per
 * `src/logic/materialisation.ts`.
 */
const CONTAINER_WORDS: ReadonlySet<string> = new Set([
  'pack', 'packs', 'packet', 'packets', 'package', 'packages',
  'carton', 'cartons', 'can', 'cans', 'tin', 'tins', 'jar', 'jars',
  'bottle', 'bottles', 'bag', 'bags', 'box', 'boxes', 'punnet', 'punnets',
  'tub', 'tubs', 'tray', 'trays', 'bunch', 'bunches', 'head', 'heads',
  'loaf', 'loaves', 'block', 'blocks', 'sachet', 'sachets', 'pot', 'pots',
  'tube', 'tubes', 'bar', 'bars', 'crate', 'crates', 'jug', 'jugs',
  // CJK measure words that genuinely name a container.
  '瓶', '包', '盒', '罐', '袋', '桶', '箱',
]);

/** CJK measure words that count loose things rather than containers. */
const CJK_PIECE_WORDS: ReadonlySet<string> = new Set([
  '個', '个', '顆', '颗', '條', '条', '塊', '块', '片', '根', '把', '隻', '只',
]);

/** Softeners. Their presence makes an amount approximate, never exact. */
const HEDGE_WORDS: ReadonlySet<string> = new Set([
  'about', 'around', 'roughly', 'approximately', 'approx', 'maybe',
  'nearly', 'almost', 'ish', 'or-so',
]);

/** Softeners that also mean the amount itself is unknown. */
const VAGUE_WORDS: ReadonlySet<string> = new Set([
  'some', 'few', 'bit', 'little', 'lots', 'loads', 'plenty', 'several',
]);

const FILLER_WORDS: ReadonlySet<string> = new Set([
  'um', 'uh', 'uhm', 'erm', 'er', 'ah', 'hmm', 'mm', 'like', 'well', 'just',
  'okay', 'ok', 'right', 'yeah', 'yep', 'so', 'anyway', 'lets', 'let',
  '嗯', '呃', '啊',
]);

/** Words that carry no food meaning. A residue made only of these is dropped. */
const STOPWORDS: ReadonlySet<string> = new Set([
  'i', 'ive', 'im', 'we', 'weve', 'you', 'me', 'my', 'our', 'your', 'it',
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'from', 'with', 'there',
  'here', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
  'got', 'get', 'gets', 'and', 'or', 'but', 'that', 'this', 'these', 'those',
  'thing', 'things', 'stuff', 'one', 'ones', 'other', 'another', 'more',
  'not', 'no', 'nope', 'yes', 'also', 'then', 'still', 'what', 'which',
  'who', 'how', 'why', 'when', 'where', 'can', 'could', 'would', 'should',
  'will', 'shall', 'make', 'makes', 'made', 'cook', 'for', 'pass', 'please',
  'dinner', 'lunch', 'breakfast', 'supper', 'meal', 'meals', 'recipe',
  'tonight', 'today', 'tomorrow', 'yesterday', 'left', 'over', 'inside',
]);

/** Markers that supersede whatever was said before them in the same breath. */
const CORRECTION_MARKERS: readonly string[] = [
  'actually', 'sorry', 'i mean', 'i meant', 'make that', 'scratch that',
  'rather', 'instead', 'no wait', 'wait no', 'correction',
];

const LOCATION_PHRASES: readonly { pattern: RegExp; kind: StorageLocation }[] = [
  { pattern: /\b(?:in|inside)\s+(?:the\s+)?(?:deep\s+)?freezer\b/i, kind: 'freezer' },
  { pattern: /\bfreezer\s*[:\-]/i, kind: 'freezer' },
  { pattern: /\b(?:in|inside)\s+(?:the\s+)?(?:fridge|refrigerator|chiller)\b/i, kind: 'fridge' },
  { pattern: /\b(?:fridge|refrigerator)\s*[:\-]/i, kind: 'fridge' },
  { pattern: /\b(?:in|inside)\s+(?:the\s+)?(?:pantry|cupboard|larder|cabinet)\b/i, kind: 'pantry' },
  { pattern: /\b(?:pantry|cupboard)\s*[:\-]/i, kind: 'pantry' },
  { pattern: /\bon\s+(?:the\s+)?(?:counter|countertop|worktop|side|shelf)\b/i, kind: 'counter' },
  { pattern: /\bcounter\s*[:\-]/i, kind: 'counter' },
  { pattern: /冰箱|雪櫃/, kind: 'fridge' },
  { pattern: /冷凍庫|冰格/, kind: 'freezer' },
];

/** Swallowed after a location phrase so "there are" does not become a name. */
const EXISTENTIAL = /^\s*(?:there\s+(?:are|is|was|were)|i\s+(?:have|got|ve got)|we\s+(?:have|got)|ive got)\b/i;

const REMAINING_WORDS = /\b(?:left|remaining|left\s+over|leftover|還剩|剩下)\b/i;
const OPENED_WORDS = /\b(?:opened|half[-\s]used|already\s+open(?:ed)?)\b/i;
const UNOPENED_WORDS = /\b(?:unopened|still\s+sealed|sealed)\b/i;

/** Placeholder that keeps a decimal comma out of the sentence splitter. */
const DECIMAL_MARK = ' ';

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */


/**
 * Rewrites the multi-character Chinese phrases the tokeniser cannot see.
 *
 * CJK is tokenised one character at a time, because that is the only way to
 * read "兩包米粉" without a word segmenter. The cost is that 還有 ("and also")
 * arrives as two characters that mean nothing apart, so the phrases that must
 * survive are folded into their English equivalents first. The user's *food*
 * words are never touched — only connectives, hedges, and measures.
 */
function foldCjkPhrases(text: string): string {
  return text
    .replace(/還有|还有|然後|然后|另外|不對|不对/g, ' , ')
    .replace(/差不多|大概|大約|大约/g, ' about ')
    .replace(/一些|一點|一点/g, ' some ')
    .replace(/公斤/g, ' kg ')
    .replace(/毫升/g, ' ml ')
    .replace(/半/g, ' half ');
}

export function parseVoiceTranscript(
  transcript: string,
  options: ParseOptions = {},
): ParsedTranscript {
  const items: ParsedVoiceItem[] = [];
  const unused: string[] = [];

  let location: StorageLocation | null = null;
  let correctionPending = false;

  for (const rawSegment of segment(foldCjkPhrases(transcript))) {
    const span = rawSegment.trim();
    if (span.length === 0) continue;

    const found = findLocation(span);
    if (found.kind) location = found.kind;

    let text = found.rest;

    const correction = takeCorrection(text);
    if (correction.marked) correctionPending = true;
    text = correction.text;

    if (isNoise(text)) {
      // A segment that is only a correction marker ("sorry") points at the
      // next segment; a segment that is only filler points at nothing.
      if (!correction.marked && found.kind === null && span.length > 0) {
        unused.push(span);
      }
      continue;
    }

    const parsed = readSegment(text, span, location, options);

    for (const item of parsed.items) {
      if (correctionPending && items.length > 0) {
        items[items.length - 1] = item;
        correctionPending = false;
      } else {
        items.push(item);
      }
    }

    // A bare quantity with no name corrects the amount of the thing just said
    // — "eggs, six, actually seven".
    if (parsed.items.length === 0 && parsed.danglingQuantity && items.length > 0) {
      const previous = items[items.length - 1]!;
      const merged = mergeQuantity(previous.quantity, parsed.danglingQuantity);
      items[items.length - 1] = {
        ...previous,
        quantity: merged,
        fullness: fullnessFrom(merged),
        remaining: previous.remaining || parsed.remaining,
      };
      correctionPending = false;
      continue;
    }

    if (parsed.items.length === 0 && !parsed.danglingQuantity) {
      unused.push(span);
      correctionPending = false;
    }
  }

  return { items, unused };
}

/* -------------------------------------------------------------------------- */
/* Segmentation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Cuts the transcript at the places speech actually pauses.
 *
 * A decimal comma is protected first, because "1,5 kilos of potatoes" is one
 * item in half of Europe and two items in none of it.
 */
function segment(transcript: string): string[] {
  const protectedText = transcript.replace(/(\d)\s*,\s*(\d)/g, `$1${DECIMAL_MARK}$2`);
  return protectedText
    .split(/[,;\n、，。！？!?]+|\s+(?:and|plus|then|also|as well as)\s+/i)
    .map((piece) => piece.replace(new RegExp(DECIMAL_MARK, 'g'), ','))
    .filter((piece) => piece.trim().length > 0);
}

function findLocation(span: string): { kind: StorageLocation | null; rest: string } {
  for (const { pattern, kind } of LOCATION_PHRASES) {
    const match = pattern.exec(span);
    if (match) {
      const rest = (span.slice(0, match.index) + ' ' + span.slice(match.index + match[0].length))
        .replace(EXISTENTIAL, ' ')
        .trim();
      return { kind, rest };
    }
  }
  return { kind: null, rest: span };
}

/**
 * Drops everything before the last correction marker.
 *
 * `marked` says the correction pointed backwards — the segment began with the
 * marker, so what follows replaces the previous item rather than this one.
 */
function takeCorrection(text: string): { text: string; marked: boolean } {
  let result = text;
  let marked = false;

  for (const marker of CORRECTION_MARKERS) {
    const pattern = new RegExp(`(^|[\\s—–-])${escapeRegExp(marker)}\\b`, 'gi');
    let match: RegExpExecArray | null;
    let lastEnd = -1;
    while ((match = pattern.exec(result)) !== null) lastEnd = match.index + match[0].length;
    if (lastEnd >= 0) {
      marked = marked || result.slice(0, lastEnd).trim().length === marker.length;
      result = result.slice(lastEnd);
    }
  }

  // A bare "no" only corrects when something follows it in the same segment.
  const bareNo = /(^|\s)no\s+(?=\S)/i;
  if (bareNo.test(result) && !/^no\s+(?:one|other|not)\b/i.test(result.trim())) {
    const index = result.search(bareNo);
    const after = result.slice(index).replace(bareNo, ' ').trim();
    if (after.length > 0 && !isNoise(after)) {
      marked = marked || index === 0;
      result = after;
    }
  }

  return { text: result.replace(/^[\s—–-]+/, ''), marked };
}

/** True when nothing in the text could name or quantify a food. */
function isNoise(text: string): boolean {
  const words = tokenise(text);
  if (words.length === 0) return true;
  return words.every(
    (word) =>
      FILLER_WORDS.has(word) ||
      CORRECTION_MARKERS.includes(word) ||
      (STOPWORDS.has(word) && !NUMBER_WORDS[word]),
  );
}

/* -------------------------------------------------------------------------- */
/* Reading one segment                                                         */
/* -------------------------------------------------------------------------- */

interface SegmentReading {
  items: ParsedVoiceItem[];
  /** A quantity with no name attached — a correction to the previous item. */
  danglingQuantity: StatedQuantity | null;
  remaining: boolean;
}

/**
 * Folds a bare quantity onto the item it corrects.
 *
 * A count with no unit is pieces — "actually seven" after "eggs" means seven
 * eggs — unless the item already had a unit worth keeping.
 */
function mergeQuantity(
  previous: StatedQuantity,
  correction: StatedQuantity,
): StatedQuantity {
  const unit =
    correction.unit ??
    (correction.amount != null ? previous.unit ?? 'piece' : previous.unit);
  return {
    containerCount: correction.containerCount ?? previous.containerCount,
    amount: correction.amount ?? previous.amount,
    unit: correction.amount != null || correction.containerCount != null ? unit : previous.unit,
    approximate: correction.approximate || previous.approximate,
  };
}

/** True when a token group says an amount and nothing else at all. */
function isQuantityOnly(tokens: readonly Token[]): boolean {
  return (
    tokens.length > 0 &&
    tokens.every((token) =>
      ['number', 'fraction', 'unit', 'container', 'piece', 'hedge'].includes(token.kind),
    )
  );
}

interface Token {
  word: string;
  kind: 'number' | 'fraction' | 'unit' | 'container' | 'piece' | 'hedge' | 'vague' | 'glue' | 'word';
  value?: number;
  unit?: UnitSpec;
}

function readSegment(
  text: string,
  span: string,
  location: StorageLocation | null,
  options: ParseOptions,
): SegmentReading {
  const remaining = REMAINING_WORDS.test(text);
  const opened = UNOPENED_WORDS.test(text) ? false : OPENED_WORDS.test(text) ? true : null;

  const cleaned = text
    .replace(REMAINING_WORDS, ' ')
    .replace(OPENED_WORDS, ' ')
    .replace(UNOPENED_WORDS, ' ');

  const groups = splitOnRepeatedCounts(classify(tokenise(cleaned)));

  const items: ParsedVoiceItem[] = [];
  let dangling: StatedQuantity | null = null;

  for (const group of groups) {
    for (const piece of splitByKnownNames(group, options.knownNames)) {
      const reading = readGroup(piece);
      if (reading.name.length > 0) {
        items.push({
          span,
          name: reading.name,
          quantity: reading.quantity,
          location,
          fullness: fullnessFrom(reading.quantity),
          remaining,
          opened,
        });
        continue;
      }
      if (!hasQuantity(reading.quantity) || !isQuantityOnly(piece)) continue;

      if (items.length > 0) {
        // Chinese puts the measure after the noun — "蠔油一瓶" is one bottle of
        // oyster sauce, arriving here as a name group then a quantity group.
        const last = items[items.length - 1]!;
        const merged = mergeQuantity(last.quantity, reading.quantity);
        items[items.length - 1] = {
          ...last,
          quantity: merged,
          fullness: fullnessFrom(merged),
        };
      } else {
        dangling = reading.quantity;
      }
    }
  }

  return { items, danglingQuantity: dangling, remaining };
}

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/([㐀-鿿豈-﫿]+)|[^\p{L}\p{N}.,]+/u)
    .flatMap((piece) => (piece == null ? [] : splitCjk(piece)))
    .map((word) => word.replace(/^[.,]+|[.,]+$/g, ''))
    .filter((word) => word.length > 0);
}

/** CJK has no spaces, so each character is its own token. */
function splitCjk(piece: string): string[] {
  if (!/[㐀-鿿豈-﫿]/.test(piece)) return piece.length > 0 ? [piece] : [];
  return piece.split('');
}

function classify(words: readonly string[]): Token[] {
  return words.map((word): Token => {
    const numeric = parseNumeric(word);
    if (numeric != null) return { word, kind: 'number', value: numeric };
    if (FRACTION_WORDS[word] != null) return { word, kind: 'fraction', value: FRACTION_WORDS[word] };
    if (NUMBER_WORDS[word] != null) return { word, kind: 'number', value: NUMBER_WORDS[word] };
    if (UNIT_WORDS[word]) return { word, kind: 'unit', unit: UNIT_WORDS[word] };
    if (CONTAINER_WORDS.has(word)) return { word, kind: 'container' };
    if (CJK_PIECE_WORDS.has(word)) return { word, kind: 'piece' };
    if (HEDGE_WORDS.has(word)) return { word, kind: 'hedge' };
    if (VAGUE_WORDS.has(word)) return { word, kind: 'vague' };
    if (FILLER_WORDS.has(word) || STOPWORDS.has(word)) return { word, kind: 'glue' };
    return { word, kind: 'word' };
  });
}

function parseNumeric(word: string): number | null {
  if (!/^\d+(?:[.,]\d+)?$/.test(word)) return null;
  return Number.parseFloat(word.replace(',', '.'));
}

/**
 * Splits "three onion two pepper spinach" into three items.
 *
 * A new count only starts a new item once a *name* has been collected since
 * the last one, so "two 400 gram cans" and "a pack of 6" stay whole.
 */
function splitOnRepeatedCounts(tokens: readonly Token[]): Token[][] {
  const groups: Token[][] = [];
  let current: Token[] = [];
  let sawName = false;

  for (const token of tokens) {
    if ((token.kind === 'number' || token.kind === 'fraction') && sawName) {
      groups.push(current);
      current = [];
      sawName = false;
    }
    if (token.kind === 'word') sawName = true;
    current.push(token);
  }
  if (current.length > 0) groups.push(current);
  return groups.filter((group) => group.length > 0);
}

/**
 * Splits run-on speech using known food names. Without a lexicon the group is
 * returned whole — a miss, not an invention.
 */
function splitByKnownNames(
  group: readonly Token[],
  knownNames: readonly string[] | undefined,
): Token[][] {
  if (!knownNames || knownNames.length === 0) return [group as Token[]];

  const nameTokens = group.filter((token) => token.kind === 'word');
  if (nameTokens.length < 2) return [group as Token[]];

  const lexicon = new Set(knownNames.map((name) => name.toLowerCase()));
  const boundaries: Token[][] = [];
  let head: Token[] = [];
  let buffer: Token[] = [];

  for (const token of group) {
    if (token.kind !== 'word') {
      head.push(token);
      continue;
    }
    buffer.push(token);
    const phrase = buffer.map((piece) => piece.word).join(' ');
    if (lexicon.has(phrase)) {
      boundaries.push([...head, ...buffer]);
      head = [];
      buffer = [];
    }
  }

  if (boundaries.length === 0) return [group as Token[]];
  if (head.length > 0 || buffer.length > 0) boundaries.push([...head, ...buffer]);
  return boundaries.filter((piece) => piece.length > 0);
}

interface GroupReading {
  name: string;
  quantity: StatedQuantity;
}

/**
 * Reads one item-sized token group.
 *
 * The shape being recovered is: an optional count, an optional amount with a
 * unit, an optional container, and a name. The container is what decides
 * whether the leading count means rows or pieces, which is the whole reason
 * the two are tracked apart.
 */
function readGroup(tokens: readonly Token[]): GroupReading {
  let hedged = tokens.some((token) => token.kind === 'hedge');
  const vague = tokens.some((token) => token.kind === 'vague');

  const numbers: { value: number; fraction: boolean; index: number }[] = [];
  let unit: UnitSpec | null = null;
  let unitIndex = -1;
  let containerIndex = -1;
  let pieceWordIndex = -1;
  const nameParts: string[] = [];

  for (const [index, token] of tokens.entries()) {
    switch (token.kind) {
      case 'number':
        numbers.push({ value: token.value!, fraction: false, index });
        break;
      case 'fraction':
        numbers.push({ value: token.value!, fraction: true, index });
        break;
      case 'unit':
        if (unit === null) {
          unit = token.unit!;
          unitIndex = index;
        }
        break;
      case 'container':
        if (containerIndex < 0) containerIndex = index;
        break;
      case 'piece':
        if (pieceWordIndex < 0) pieceWordIndex = index;
        break;
      case 'word':
        nameParts.push(token.word);
        break;
      default:
        break;
    }
  }

  const name = joinName(nameParts);
  const hasContainer = containerIndex >= 0;
  // Bound once so the branches below read a value TypeScript can narrow;
  // `unit` is written inside a callback, which defeats flow analysis.
  const measure: UnitSpec | null = unit;

  let containerCount: number | null = null;
  let amount: number | null = null;
  let amountUnit: MeasureUnit | null = null;

  if (vague) {
    // "some butter", "a bit of ginger": present, quantity unknown. Any number
    // in the same breath ("a few") is a gesture, not a count.
    return {
      name,
      quantity: { containerCount: null, amount: null, unit: null, approximate: hedged || vague },
    };
  }

  const leading = numbers[0];

  if (hasContainer) {
    // Numbers before the container word describe the container; numbers after
    // it describe what is inside. "A carton" and "half a carton" both have an
    // article that is a number, so the *article* must not be read as an
    // amount — which is why position decides rather than order of appearance.
    const before = numbers.filter((entry) => entry.index < containerIndex);
    const after = numbers.filter((entry) => entry.index > containerIndex);
    const fraction = before.find((entry) => entry.fraction);

    if (fraction) {
      // "half a carton": one container, about half full. The carton's own
      // size stays unknown, so there is no unit and no exact amount.
      containerCount = 1;
      amount = fraction.value;
      amountUnit = null;
      hedged = true;
    } else if (before.length === 1 && measure && unitIndex < containerIndex) {
      // "a 2 kg bag of rice": the number belongs to the unit, not the count.
      containerCount = 1;
      amount = before[0]!.value * measure.factor;
      amountUnit = measure.unit;
    } else {
      const count = before[0];
      containerCount = count ? Math.round(count.value) : 1;
      const inside = before[1] ?? after[0];
      if (inside && !inside.fraction) {
        amount = inside.value * (measure?.factor ?? 1);
        amountUnit = measure?.unit ?? 'piece';
      }
    }
  } else if (leading) {
    if (measure) {
      amount = leading.value * measure.factor;
      amountUnit = measure.unit;
      if (leading.fraction) {
        // "half a litre" is exactly 500 ml. The fraction qualifies a measure,
        // so it is a measurement rather than a gesture.
        hedged = hedged || false;
      }
    } else if (leading.fraction) {
      // "half a broccoli": a fraction of a whole food, with no measure to make
      // it exact. This is the case that must never harden into a number.
      amount = leading.value;
      amountUnit = null;
      hedged = true;
    } else {
      amount = leading.value;
      amountUnit = pieceWordIndex >= 0 || nameParts.length > 0 ? 'piece' : null;
    }
  }

  if (containerCount == null && pieceWordIndex >= 0 && amount == null) {
    amount = 1;
    amountUnit = 'piece';
  }

  return {
    name,
    quantity: {
      containerCount,
      amount,
      unit: amountUnit,
      approximate: hedged,
    },
  };
}


/** Joins name words, without inserting spaces into a CJK name. */
function joinName(parts: readonly string[]): string {
  return parts
    .reduce((joined, part, index) => {
      if (index === 0) return part;
      const previous = parts[index - 1]!;
      const bothCjk = isCjk(previous) && isCjk(part);
      return joined + (bothCjk ? '' : ' ') + part;
    }, '')
    .trim();
}

function isCjk(value: string): boolean {
  return /^[㐀-鿿豈-﫿]+$/u.test(value);
}

function hasQuantity(quantity: StatedQuantity): boolean {
  return quantity.containerCount != null || quantity.amount != null;
}

/**
 * The fullness a phrase implies, where it implies one.
 *
 * Only a fraction of a container becomes fullness — "half a carton" means the
 * carton is half full. A fraction of a loose food ("half a broccoli") is an
 * amount, not a container state, and gets nothing here.
 */
function fullnessFrom(quantity: StatedQuantity): Fullness | null {
  if (quantity.containerCount == null || !quantity.approximate) return null;
  if (quantity.amount == null) return null;
  if (quantity.amount >= 0.75) return 'full';
  if (quantity.amount >= 0.4) return 'half';
  if (quantity.amount > 0) return 'low';
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
