import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const toast = readFileSync('src/components/Toast.tsx', 'utf8');
const emptyState = readFileSync('src/components/EmptyState.tsx', 'utf8');

describe('premium interaction feedback primitives', () => {
  test('toast exposes a typed feedback contract and one accessible announcement', () => {
    expect(toast).toContain("export type ToastKind = 'success' | 'pending' | 'recoverable-error'");
    expect(toast).toContain("styles[toast.kind ?? 'success']");
    expect(toast).toContain('accessibilityLiveRegion="polite"');
    expect(toast).toContain('accessibilityRole="alert"');
  });

  test('toast motion uses shared reduced-motion and duration primitives', () => {
    expect(toast).toContain("import { useReducedMotion } from '@/hooks/useReducedMotion'");
    expect(toast).toContain('FadeInDown.duration(duration.quick)');
    expect(toast).toContain("Platform.OS === 'web' || reduceMotion ? undefined");
    expect(toast).not.toContain('FadeInDown.duration(180)');
  });

  test('empty states continue to require an explanation and a usable action', () => {
    expect(emptyState).toContain('title: string');
    expect(emptyState).toContain('detail?: string');
    expect(emptyState).toContain('actionLabel?: string');
    expect(emptyState).toContain('actionLabel && onAction');
  });
});
