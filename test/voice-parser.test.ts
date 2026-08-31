import { describe, expect, test } from 'vitest';

import { parseVoiceTranscript } from '../src/logic/voicePantryParser';

/**
 * The parser's contracts, one at a time. The corpus test measures aggregate
 * quality; this file pins the individual rules so a regression says which rule
 * broke rather than "recall fell".
 */

const parse = (text: string) => parseVoiceTranscript(text);
const names = (text: string) => parse(text).items.map((item) => item.name);
const first = (text: string) => parse(text).items[0]!;

describe('segmentation and filler (3.1)', () => {
  test('filler never becomes an ingredient', () => {
    expect(names('um, uh, two lemons')).toEqual(['lemons']);
  });

  test('a trailing conjunction creates nothing', () => {
    expect(names('yoghurt, and, uh')).toEqual(['yoghurt']);
  });

  test('unrecognised phrases are surfaced rather than dropped silently', () => {
    const parsed = parse('two lemons, can you pass me the thing');
    expect(parsed.items.map((item) => item.name)).toEqual(['lemons']);
    expect(parsed.unused).toContain('can you pass me the thing');
  });

  test('a spoken question is not an inventory item', () => {
    expect(parse('what can I make for dinner tonight').items).toEqual([]);
  });

  test('the source words are kept for review', () => {
    expect(first('three carrots').span).toBe('three carrots');
  });
});

describe('self-correction (3.1)', () => {
  test('a corrected number supersedes the first one', () => {
    const item = first('eggs, six — actually seven');
    expect(item.name).toBe('eggs');
    expect(item.quantity.amount).toBe(7);
    expect(item.quantity.unit).toBe('piece');
  });

  test('a corrected name replaces the item instead of adding one', () => {
    expect(names('one courgette, sorry, I mean one aubergine')).toEqual(['aubergine']);
  });

  test('a correction mid-list touches only the item being spoken', () => {
    const items = parse('three apples, two pears no four pears, one mango').items;
    expect(items.map((item) => [item.name, item.quantity.amount])).toEqual([
      ['apples', 3],
      ['pears', 4],
      ['mango', 1],
    ]);
  });

  test('a sentence that merely contains numbers does not rewrite the last item', () => {
    // The failure this guards: "one dozen" being read as a correction to the
    // twelve eggs just counted.
    const items = parse('twelve eggs and one dozen is not two dozen').items;
    expect(items).toHaveLength(1);
    expect(items[0]!.quantity.amount).toBe(12);
  });
});

describe('containers versus amounts (3.2)', () => {
  test('two cans with a stated size are two containers of that size', () => {
    expect(first('two 400 gram cans of chopped tomatoes').quantity).toEqual({
      containerCount: 2,
      amount: 400,
      unit: 'g',
      approximate: false,
    });
  });

  test('a pack of six is one container holding six pieces', () => {
    expect(first('a pack of 6 chicken breasts').quantity).toEqual({
      containerCount: 1,
      amount: 6,
      unit: 'piece',
      approximate: false,
    });
  });

  test('a loose count names no container', () => {
    expect(first('3 carrots').quantity).toEqual({
      containerCount: null,
      amount: 3,
      unit: 'piece',
      approximate: false,
    });
  });

  test('a bare mass names no container either', () => {
    expect(first('500 g of minced pork').quantity).toEqual({
      containerCount: null,
      amount: 500,
      unit: 'g',
      approximate: false,
    });
  });

  test('an article before a container is not an amount', () => {
    // "a bottle" is one bottle of unknown volume, not one unit of fish sauce.
    expect(first('a bottle of fish sauce').quantity).toEqual({
      containerCount: 1,
      amount: null,
      unit: null,
      approximate: false,
    });
  });

  test('a size before a container belongs to the container', () => {
    expect(first('a 2 kg bag of rice').quantity).toEqual({
      containerCount: 1,
      amount: 2000,
      unit: 'g',
      approximate: false,
    });
  });

  test('“left” marks a remaining amount rather than a purchase', () => {
    const item = first('7 eggs left');
    expect(item.remaining).toBe(true);
    expect(item.quantity.amount).toBe(7);
  });
});

describe('approximation is preserved (3.4)', () => {
  test('half a container is approximate and carries no unit', () => {
    expect(first('half a carton of milk').quantity).toEqual({
      containerCount: 1,
      amount: 0.5,
      unit: null,
      approximate: true,
    });
  });

  test('half a measure is exact, because a litre is a measure', () => {
    expect(first('half a litre of cream').quantity).toEqual({
      containerCount: null,
      amount: 500,
      unit: 'ml',
      approximate: false,
    });
  });

  test('half a whole food is approximate and unitless', () => {
    expect(first('half a broccoli').quantity).toEqual({
      containerCount: null,
      amount: 0.5,
      unit: null,
      approximate: true,
    });
  });

  test('a hedge word makes a measured amount approximate', () => {
    const quantity = first('roughly 200 grams of cheddar').quantity;
    expect(quantity.amount).toBe(200);
    expect(quantity.approximate).toBe(true);
  });

  test('“some” is an unknown amount, not a default one', () => {
    expect(first('some butter').quantity.amount).toBeNull();
    expect(first('some butter').quantity.unit).toBeNull();
  });

  test('“a bit of” does not become a gram figure', () => {
    expect(first('a bit of ginger').quantity.amount).toBeNull();
  });

  test('half a container also reads as half fullness', () => {
    expect(first('half a carton of milk').fullness).toBe('half');
  });

  test('a loose fraction does not claim a container fullness', () => {
    expect(first('half a broccoli').fullness).toBeNull();
  });
});

describe('locale-aware numbers (3.4)', () => {
  test('a decimal comma is a number, not a list separator', () => {
    const items = parse('1,5 kilos of potatoes').items;
    expect(items).toHaveLength(1);
    expect(items[0]!.quantity).toEqual({
      containerCount: null,
      amount: 1500,
      unit: 'g',
      approximate: false,
    });
  });

  test('both decimal conventions give the same answer', () => {
    expect(first('1.5 kg of potatoes').quantity.amount).toBe(
      first('1,5 kilos of potatoes').quantity.amount,
    );
  });

  test('the original phrase survives the conversion', () => {
    expect(first('1,5 kilos of potatoes').span).toBe('1,5 kilos of potatoes');
  });

  test('numbers spoken as words count too', () => {
    expect(first('twelve eggs').quantity.amount).toBe(12);
  });
});

describe('location (3.3)', () => {
  test('a spoken location applies forward, never backward', () => {
    const items = parse('milk, butter, in the freezer there are two salmon fillets').items;
    expect(items.map((item) => [item.name, item.location])).toEqual([
      ['milk', null],
      ['butter', null],
      ['salmon fillets', 'freezer'],
    ]);
  });

  test('a second location switch applies from where it was said', () => {
    const items = parse('in the freezer peas, in the pantry rice and flour').items;
    expect(items.map((item) => [item.name, item.location])).toEqual([
      ['peas', 'freezer'],
      ['rice', 'pantry'],
      ['flour', 'pantry'],
    ]);
  });

  test('the counter is a location', () => {
    expect(first('on the counter there are four bananas').location).toBe('counter');
  });

  test('“there are” after a location is not a food name', () => {
    expect(first('on the counter there are four bananas').name).toBe('bananas');
  });

  test('the parser names a storage kind, never a location id', () => {
    // Locations are user-editable rows; guessing an id from a spoken word
    // would break the moment someone renames one. The caller maps kind to id.
    expect(first('in the freezer peas').location).toBe('freezer');
  });
});

describe('original script (3.1)', () => {
  test('Chinese names survive with their measure words read', () => {
    const items = parse('蠔油一瓶，還有兩包米粉').items;
    expect(items.map((item) => [item.name, item.quantity.containerCount])).toEqual([
      ['蠔油', 1],
      ['米粉', 2],
    ]);
  });

  test('a code-switched phrase keeps both halves', () => {
    const items = parse('two packs of 豆腐 and some 香菜').items;
    expect(items.map((item) => item.name)).toEqual(['豆腐', '香菜']);
    expect(items[0]!.quantity.containerCount).toBe(2);
    expect(items[1]!.quantity.amount).toBeNull();
  });

  test('nothing is romanised on the way through', () => {
    expect(first('一瓶醬油').name).toBe('醬油');
  });
});

describe('the parser reaches for nothing outside itself', () => {
  test('an empty transcript is empty, not an item named nothing', () => {
    expect(parse('   ')).toEqual({ items: [], unused: [] });
  });

  test('parsing is deterministic', () => {
    const once = parse('two 400 gram cans of tomatoes and half a carton of milk');
    const twice = parse('two 400 gram cans of tomatoes and half a carton of milk');
    expect(once).toEqual(twice);
  });
});
