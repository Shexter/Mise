import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';

/**
 * Where each of Today's pages was left, kept outside the component tree.
 *
 * Only the selected page is mounted: a hidden scroll view would still be in the
 * accessibility tree, and a screen reader exploring the plan while Calories is
 * on screen is worse than losing a scroll position. So the position is what is
 * kept, not the tree.
 *
 * Module scope rather than a store, because this is transient presentation
 * state with no persistence and nothing else may read it.
 */
const offsets = new Map<string, number>();

/**
 * The key a page's position is filed under. The date is part of it, so
 * returning to the same day lands where you were and choosing a different day
 * starts at the top — an offset into another day's content means nothing.
 */
export function scrollMemoryKey(page: string, localDate: string): string {
  return `${page}|${localDate}`;
}

export function rememberScrollOffset(key: string, offset: number): void {
  offsets.set(key, Math.max(0, offset));
}

/** Zero for a page and date that has not been scrolled, which starts it at the top. */
export function recallScrollOffset(key: string): number {
  return offsets.get(key) ?? 0;
}

/** Forgets every remembered position. Exists so tests start from a clean slate. */
export function resetRememberedScroll(): void {
  offsets.clear();
}

/**
 * Restores this key's scroll position when the page mounts, and records it as
 * the page is scrolled.
 */
export function useRememberedScroll(key: string) {
  const ref = useRef<ScrollView | null>(null);
  const restored = useRef(false);

  useEffect(() => {
    restored.current = false;
  }, [key]);

  // Content arrives in stages, so the first layout is often shorter than the
  // final page. Restoring on each size change until it takes keeps the offset
  // from being clamped away by a page that had not finished rendering.
  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (restored.current) return;
      const target = recallScrollOffset(key);
      if (target === 0) {
        restored.current = true;
        return;
      }
      if (height <= target) return;
      ref.current?.scrollTo({ y: target, animated: false });
      restored.current = true;
    },
    [key],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      rememberScrollOffset(key, event.nativeEvent.contentOffset.y);
    },
    [key],
  );

  return { ref, onScroll, onContentSizeChange, scrollEventThrottle: 32 } as const;
}
