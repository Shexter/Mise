import { describe, expect, test } from 'vitest';
import { nextExpandedId } from '@/logic/collapsibleEditor';

describe('collapsible editor state', () => {
  test('opens requested row and closes it when requested again', () => {
    expect(nextExpandedId(null, 'a')).toBe('a');
    expect(nextExpandedId('a', 'a')).toBeNull();
  });
  test('switches directly to a different row', () => {
    expect(nextExpandedId('a', 'b')).toBe('b');
  });
});
