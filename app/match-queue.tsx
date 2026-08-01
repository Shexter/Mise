import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Divider } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { CanonicalPickerSheet } from '@/components/match/CanonicalPickerSheet';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { Caption, RowTitle, ScreenTitle } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import {
  deleteQueuedMatch,
  getCanonicalById,
  getMatchQueue,
  resolveQueuedMatch,
} from '@/db/queries';
import type { CanonicalItem, QueuedMatch } from '@/types';

const SOURCE_LABEL: Record<string, string> = {
  receipt: 'From a receipt',
  vision: 'From a photo',
  barcode: 'From a barcode',
  meal_log: 'From the meal log',
  user: 'Added by you',
  seed: 'Built in',
};

/** JSON context captured at scan time, folded into one caption line. */
function contextLabel(entry: QueuedMatch): string {
  const parts = [SOURCE_LABEL[entry.source] ?? entry.source];
  if (entry.context) {
    try {
      const parsed = JSON.parse(entry.context) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' || typeof value === 'number') {
          parts.push(`${key}: ${value}`);
        }
      }
    } catch {
      // Context is display-only; unreadable JSON is just omitted.
    }
  }
  return parts.join(' · ');
}

/**
 * The review queue: references the cascade could not resolve confidently,
 * resolvable in one tap. Resolving writes an alias, so the same reference
 * never comes back here.
 */
export default function MatchQueueScreen() {
  const toast = useToast();
  const [queue, setQueue] = useState<QueuedMatch[]>([]);
  const [active, setActive] = useState<QueuedMatch | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const refresh = useCallback(() => {
    void getMatchQueue().then(setQueue);
  }, []);

  useEffect(refresh, [refresh]);

  const openPicker = (entry: QueuedMatch) => {
    setActive(entry);
    if (entry.suggestedId) {
      void getCanonicalById(entry.suggestedId).then((item) =>
        setSuggestions(item ? [item.id] : []),
      );
    } else {
      setSuggestions([]);
    }
  };

  const onPick = (item: CanonicalItem) => {
    const entry = active;
    setActive(null);
    if (!entry) return;
    void resolveQueuedMatch(entry.id, item.id).then(() => {
      toast.show({ message: `Learned: ${item.displayName}.` });
      refresh();
    });
  };

  const onDismiss = (entry: QueuedMatch) => {
    void deleteQueuedMatch(entry.id).then(refresh);
  };

  return (
    <Screen scroll>
      <ScreenTitle style={styles.title}>Needs a look</ScreenTitle>
      <Caption muted style={styles.subtitle}>
        Things the app couldn't place on its own. Matching one teaches it for
        next time.
      </Caption>

      {queue.length === 0 ? (
        <EmptyState
          title="All clear"
          detail="Anything a scan can't identify will wait for you here."
        />
      ) : (
        <Card padded={false}>
          {queue.map((entry, position) => (
            <View key={entry.id}>
              {position > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <Pressable
                  onPress={() => openPicker(entry)}
                  accessibilityRole="button"
                  accessibilityLabel={`Match ${entry.rawText}`}
                  style={({ pressed }) => [
                    styles.rowMain,
                    pressed && { opacity: opacity.pressed },
                  ]}
                >
                  <RowTitle>{entry.rawText}</RowTitle>
                  <Caption muted>{contextLabel(entry)}</Caption>
                </Pressable>
                <Pressable
                  onPress={() => onDismiss(entry)}
                  accessibilityRole="button"
                  accessibilityLabel={`Dismiss ${entry.rawText}`}
                  hitSlop={space.sm}
                  style={({ pressed }) => [
                    styles.dismiss,
                    pressed && { opacity: opacity.pressed },
                  ]}
                >
                  <Feather name="x" size={18} color={color.muted} />
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
      )}

      <CanonicalPickerSheet
        visible={active !== null}
        title="What is it?"
        suggestedIds={suggestions}
        onPick={onPick}
        onClose={() => setActive(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.base },
  subtitle: { marginTop: space.sm, marginBottom: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: space.md,
  },
  rowMain: {
    flex: 1,
    minHeight: layout.minRowHeight,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: space.md,
    justifyContent: 'center',
    gap: space.xs,
  },
  dismiss: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
