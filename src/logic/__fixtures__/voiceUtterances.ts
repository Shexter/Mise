import type { MeasureUnit } from '@/types';

/**
 * The corpus the transcript parser is measured against.
 *
 * Every line here is something a person would plausibly say while standing in
 * front of an open fridge, written to be *unhelpful* in the ways real speech is
 * unhelpful: filler, restarts, self-correction, conjunctions doing double duty,
 * numbers that are not quantities, and food named in a script the app must not
 * romanise.
 *
 * Nothing in this file is a real recording or a real person's pantry. The
 * utterances are written, not collected, so there is nothing to anonymise and
 * no consent question — which is also why the accent and noise dimensions are
 * represented as *transcription damage* (dropped words, homophones) rather than
 * as audio. The parser only ever sees text, so text is the honest fixture.
 *
 * `expected` describes what the parser should produce, not what a model
 * "should probably" produce. Where the right answer is "no item", that is
 * written down as an expectation too — inventing food out of "um" is a worse
 * failure than missing an item.
 */

export interface ExpectedItem {
  /** Substring the parsed name must contain, in its original script. */
  name: string;
  containerCount?: number | null;
  amount?: number | null;
  unit?: MeasureUnit | null;
  approximate?: boolean;
  /** A location word spoken in the phrase, if any. */
  location?: 'fridge' | 'freezer' | 'pantry' | 'counter';
  /** True when the user said how much is left rather than how much there is. */
  remaining?: boolean;
}

export interface VoiceFixture {
  id: string;
  /** What the transcriber handed over, verbatim. */
  transcript: string;
  /** What the parser should find, in order. */
  expected: ExpectedItem[];
  /** What this case is protecting. */
  note: string;
  dimension:
    | 'baseline'
    | 'filler'
    | 'self_correction'
    | 'containers'
    | 'approximate'
    | 'remaining'
    | 'location'
    | 'locale'
    | 'script'
    | 'noise'
    | 'no_food';
}

export const VOICE_FIXTURES: readonly VoiceFixture[] = [
  {
    id: 'proposal-example',
    dimension: 'baseline',
    note: 'The utterance the proposal is written around. Eight items, one breath.',
    transcript:
      'six chicken breasts, half a broccoli, half a carton of milk, three carrots, some butter, seven eggs, blueberries, and watermelon',
    expected: [
      { name: 'chicken breast', amount: 6, unit: 'piece' },
      { name: 'broccoli', amount: 0.5, approximate: true },
      { name: 'milk', containerCount: 1, approximate: true },
      { name: 'carrot', amount: 3, unit: 'piece' },
      { name: 'butter', amount: null, unit: null },
      { name: 'egg', amount: 7, unit: 'piece' },
      { name: 'blueberries', amount: null },
      { name: 'watermelon', amount: null },
    ],
  },
  {
    id: 'plain-list',
    dimension: 'baseline',
    note: 'Bare names with no quantity at all are still present items.',
    transcript: 'tofu, spring onions, sesame oil',
    expected: [
      { name: 'tofu', amount: null },
      { name: 'spring onion', amount: null },
      { name: 'sesame oil', amount: null },
    ],
  },
  {
    id: 'filler-and-restart',
    dimension: 'filler',
    note: 'Filler and a false start must not become ingredients.',
    transcript: "um, so, I've got, uh, two lemons and, like, a bag of rice",
    expected: [
      { name: 'lemon', amount: 2, unit: 'piece' },
      { name: 'rice', containerCount: 1 },
    ],
  },
  {
    id: 'trailing-hesitation',
    dimension: 'filler',
    note: 'A trailing "and" with nothing after it must not create an empty item.',
    transcript: 'yoghurt, and, uh',
    expected: [{ name: 'yoghurt', amount: null }],
  },
  {
    id: 'numeric-self-correction',
    dimension: 'self_correction',
    note: 'The corrected number wins; the phrase stays one item, not two.',
    transcript: 'eggs, six — actually seven',
    expected: [{ name: 'egg', amount: 7, unit: 'piece' }],
  },
  {
    id: 'name-self-correction',
    dimension: 'self_correction',
    note: 'A corrected *name* replaces the item rather than adding a second one.',
    transcript: 'one courgette, sorry, I mean one aubergine',
    expected: [{ name: 'aubergine', amount: 1, unit: 'piece' }],
  },
  {
    id: 'correction-mid-list',
    dimension: 'self_correction',
    note: 'A correction applies to the item being spoken, not the whole list.',
    transcript: 'three apples, two pears no four pears, one mango',
    expected: [
      { name: 'apple', amount: 3, unit: 'piece' },
      { name: 'pear', amount: 4, unit: 'piece' },
      { name: 'mango', amount: 1, unit: 'piece' },
    ],
  },
  {
    id: 'cans-with-per-can-amount',
    dimension: 'containers',
    note: 'Two containers, each with its own stated amount. Not 800 g of tomatoes.',
    transcript: 'two 400 gram cans of chopped tomatoes',
    expected: [{ name: 'tomato', containerCount: 2, amount: 400, unit: 'g' }],
  },
  {
    id: 'pack-of-pieces',
    dimension: 'containers',
    note: 'One container holding six pieces. Not six containers.',
    transcript: 'a pack of 6 chicken breasts',
    expected: [{ name: 'chicken breast', containerCount: 1, amount: 6, unit: 'piece' }],
  },
  {
    id: 'loose-count-no-container',
    dimension: 'containers',
    note: 'A loose count names no container, so it is an amount, not rows.',
    transcript: '3 carrots',
    expected: [{ name: 'carrot', containerCount: null, amount: 3, unit: 'piece' }],
  },
  {
    id: 'bottle-and-bunch',
    dimension: 'containers',
    note: 'Container vocabulary beyond the tin: bottle, bunch.',
    transcript: 'a bottle of fish sauce and a bunch of coriander',
    expected: [
      { name: 'fish sauce', containerCount: 1 },
      { name: 'coriander', containerCount: 1 },
    ],
  },
  {
    id: 'mass-without-container',
    dimension: 'containers',
    note: 'A bare mass is an amount with no container count.',
    transcript: '500 g of minced pork',
    expected: [{ name: 'minced pork', containerCount: null, amount: 500, unit: 'g' }],
  },
  {
    id: 'half-a-carton',
    dimension: 'approximate',
    note: 'Approximate fullness of one container; the carton size stays unknown.',
    transcript: 'half a carton of milk',
    expected: [
      { name: 'milk', containerCount: 1, amount: 0.5, unit: null, approximate: true },
    ],
  },
  {
    id: 'some-butter',
    dimension: 'approximate',
    note: 'Present with an unknown quantity. No default stick, no default grams.',
    transcript: 'some butter',
    expected: [{ name: 'butter', amount: null, unit: null }],
  },
  {
    id: 'a-bit-of',
    dimension: 'approximate',
    note: '"A bit of" is a hedge, not a measurement.',
    transcript: 'a bit of ginger and a little bit of garlic',
    expected: [
      { name: 'ginger', amount: null, approximate: true },
      { name: 'garlic', amount: null, approximate: true },
    ],
  },
  {
    id: 'roughly-grams',
    dimension: 'approximate',
    note: 'A hedged number stays approximate even though it has a unit.',
    transcript: 'roughly 200 grams of cheddar',
    expected: [{ name: 'cheddar', amount: 200, unit: 'g', approximate: true }],
  },
  {
    id: 'seven-eggs-left',
    dimension: 'remaining',
    note: '"Left" is a current amount, not an original pack size.',
    transcript: '7 eggs left',
    expected: [{ name: 'egg', amount: 7, unit: 'piece', remaining: true }],
  },
  {
    id: 'half-used',
    dimension: 'remaining',
    note: 'Remaining and approximate at once.',
    transcript: 'about half a jar of gochujang left',
    expected: [
      { name: 'gochujang', containerCount: 1, amount: 0.5, approximate: true, remaining: true },
    ],
  },
  {
    id: 'freezer-switch',
    dimension: 'location',
    note: 'A spoken location applies from that point, not retroactively.',
    transcript: 'milk, butter, in the freezer there are two salmon fillets',
    expected: [
      { name: 'milk', amount: null },
      { name: 'butter', amount: null },
      { name: 'salmon', amount: 2, unit: 'piece', location: 'freezer' },
    ],
  },
  {
    id: 'location-then-back',
    dimension: 'location',
    note: 'Two location switches in one sweep.',
    transcript: 'in the freezer peas, in the pantry rice and flour',
    expected: [
      { name: 'pea', location: 'freezer' },
      { name: 'rice', location: 'pantry' },
      { name: 'flour', location: 'pantry' },
    ],
  },
  {
    id: 'on-the-counter',
    dimension: 'location',
    note: 'Counter is a location word too.',
    transcript: 'on the counter there are four bananas',
    expected: [{ name: 'banana', amount: 4, unit: 'piece', location: 'counter' }],
  },
  {
    id: 'decimal-comma',
    dimension: 'locale',
    note: 'A comma decimal is a number, not a list separator.',
    transcript: '1,5 kilos of potatoes',
    expected: [{ name: 'potato', amount: 1500, unit: 'g' }],
  },
  {
    id: 'decimal-point',
    dimension: 'locale',
    note: 'The same amount written the other way must parse the same.',
    transcript: '1.5 kg of potatoes',
    expected: [{ name: 'potato', amount: 1500, unit: 'g' }],
  },
  {
    id: 'spoken-fraction',
    dimension: 'locale',
    note: 'A spoken fraction is exact when it qualifies a unit, not a container.',
    transcript: 'half a litre of cream',
    expected: [{ name: 'cream', amount: 500, unit: 'ml' }],
  },
  {
    id: 'word-numbers',
    dimension: 'locale',
    note: 'Numbers arrive as words at least as often as digits.',
    transcript: 'twelve eggs and one dozen is not two dozen',
    expected: [{ name: 'egg', amount: 12, unit: 'piece' }],
  },
  {
    id: 'cjk-ingredients',
    dimension: 'script',
    note: 'Original script is preserved and never romanised (identity-layer rule).',
    transcript: '蠔油一瓶，還有兩包米粉',
    expected: [
      { name: '蠔油', containerCount: 1 },
      { name: '米粉', containerCount: 2 },
    ],
  },
  {
    id: 'code-switched',
    dimension: 'script',
    note: 'English frame, non-English ingredient. Both halves must survive.',
    transcript: 'two packs of 豆腐 and some 香菜',
    expected: [
      { name: '豆腐', containerCount: 2 },
      { name: '香菜', amount: null },
    ],
  },
  {
    id: 'romanised-loanword',
    dimension: 'script',
    note: 'A romanised Asian ingredient is passed through as spoken.',
    transcript: 'one jar of doubanjiang',
    expected: [{ name: 'doubanjiang', containerCount: 1 }],
  },
  {
    id: 'dropped-words',
    dimension: 'noise',
    note: 'Noise drops connective words; the items must still be found.',
    transcript: 'three onion two pepper spinach',
    expected: [
      { name: 'onion', amount: 3, unit: 'piece' },
      { name: 'pepper', amount: 2, unit: 'piece' },
      { name: 'spinach', amount: null },
    ],
  },
  {
    id: 'run-on-no-punctuation',
    dimension: 'noise',
    note: 'Some transcribers return no punctuation at all.',
    transcript: 'milk eggs bread butter',
    expected: [
      { name: 'milk' },
      { name: 'egg' },
      { name: 'bread' },
      { name: 'butter' },
    ],
  },
  {
    id: 'empty',
    dimension: 'no_food',
    note: 'Silence produces nothing, not an empty-named item.',
    transcript: '   ',
    expected: [],
  },
  {
    id: 'only-filler',
    dimension: 'no_food',
    note: 'Hesitation alone is not an ingredient.',
    transcript: 'um, uh, hmm, okay so',
    expected: [],
  },
  {
    id: 'overheard-speech',
    dimension: 'no_food',
    note: 'A kitchen microphone hears the kitchen. None of this is stock.',
    transcript: 'can you pass me the thing, no not that one, the other one',
    expected: [],
  },
  {
    id: 'question-not-inventory',
    dimension: 'no_food',
    note: 'Voice intake is a sweep, not an assistant. A question is not a command.',
    transcript: 'what can I make for dinner tonight',
    expected: [],
  },
];

/** Fixtures grouped by the dimension they exercise, for reporting. */
export function fixturesByDimension(): Map<VoiceFixture['dimension'], VoiceFixture[]> {
  const grouped = new Map<VoiceFixture['dimension'], VoiceFixture[]>();
  for (const fixture of VOICE_FIXTURES) {
    const bucket = grouped.get(fixture.dimension) ?? [];
    bucket.push(fixture);
    grouped.set(fixture.dimension, bucket);
  }
  return grouped;
}

/** Total items the corpus expects to be found across every fixture. */
export const EXPECTED_ITEM_COUNT = VOICE_FIXTURES.reduce(
  (total, fixture) => total + fixture.expected.length,
  0,
);
