import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Caption, RowTitle } from '@/components/Type';
import { SPORTS, sportsDailyBurn, type SportId } from '@/constants/sports';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import type { ActivityLevel } from '@/types';

interface Props {
  selected: readonly SportId[];
  onChange: (next: readonly SportId[]) => void;
  /** Drives the burn estimate — the level supplies how often, sports how hard. */
  activityLevel: ActivityLevel | null;
  weightKg: number | null;
}

/**
 * The optional second half of the activity question.
 *
 * It stays collapsed by default: the activity level on its own is a complete
 * answer, and opening this is the user volunteering detail, not the flow
 * demanding it. Selection is multiple, order-preserving, and — because a
 * refinement that showed nothing would be a refinement on faith — it prints
 * the daily figure it arrives at as soon as there is one.
 */
export function SportsSelector({ selected, onChange, activityLevel, weightKg }: Props) {
  const [expanded, setExpanded] = useState(selected.length > 0);
  const burn = Math.round(sportsDailyBurn(selected, activityLevel, weightKg));

  const toggle = (id: SportId) => {
    void Haptics.selectionAsync();
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    );
  };

  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          setExpanded((open) => !open);
        }}
        accessibilityRole="button"
        accessibilityLabel="Sports you play"
        accessibilityHint="Optional. Refines the estimate with what you train."
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.header, pressed && { opacity: opacity.pressed }]}
      >
        <View style={styles.headerText}>
          <RowTitle>Sports you play</RowTitle>
          <Caption muted>{summary(selected, burn)}</Caption>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={color.muted}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <View style={styles.chips}>
            {SPORTS.map((sport) => {
              const on = selected.includes(sport.value);
              return (
                <Pressable
                  key={sport.value}
                  onPress={() => toggle(sport.value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={sport.label}
                  style={({ pressed }) => [
                    styles.chip,
                    on && styles.chipOn,
                    pressed && { opacity: opacity.pressed },
                  ]}
                >
                  <MaterialCommunityIcons
                    // The catalogue's glyph names are checked against the set
                    // this font ships in `test/sports.test.ts`.
                    name={sport.icon as never}
                    size={16}
                    color={on ? color.onAction : color.muted}
                  />
                  <Caption muted={!on} style={on ? styles.chipTextOn : undefined}>
                    {sport.label}
                  </Caption>
                </Pressable>
              );
            })}
          </View>
          <Caption muted>
            Averaged across the week at the training frequency your activity level
            implies. Nothing here is a measurement.
          </Caption>
        </View>
      ) : null}
    </View>
  );
}

function summary(selected: readonly SportId[], burn: number): string {
  if (selected.length === 0) return 'Optional — sharpens the estimate';
  const count = `${selected.length} selected`;
  return burn > 0 ? `${count} · about ${burn} kcal a day` : count;
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    overflow: 'hidden',
  },
  header: {
    minHeight: layout.minRowHeight,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.base,
  },
  headerText: { flex: 1, gap: space.xs },
  body: {
    paddingHorizontal: layout.cardPadding,
    paddingBottom: layout.cardPadding,
    gap: space.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.ground,
  },
  chipOn: { backgroundColor: color.action, borderColor: color.action },
  chipTextOn: { color: color.onAction },
});
