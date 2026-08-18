import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Divider } from '@/components/Card';
import { ChoiceList } from '@/components/Choice';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { Body, Caption, RowTitle, ScreenTitle } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import { getAllCanonicals, listPantryItems } from '@/db/queries';
import { assessMacroGap, type MacroContributor, type MacroGapTarget } from '@/logic/macroGap';
import type { CanonicalItem, PantryItem } from '@/types';

interface TargetOption {
  value: MacroGapTarget;
  label: string;
  unit: string;
}

const TARGETS: readonly TargetOption[] = [
  { value: 'protein', label: 'Protein', unit: 'g' },
  { value: 'carbs', label: 'Carbs', unit: 'g' },
  { value: 'fat', label: 'Fat', unit: 'g' },
  { value: 'fibre', label: 'Fibre', unit: 'g' },
  { value: 'vitaminC', label: 'Vitamin C', unit: 'mg' },
  { value: 'iron', label: 'Iron', unit: 'mg' },
  { value: 'vitaminB12', label: 'Vitamin B12', unit: 'mcg' },
  { value: 'calcium', label: 'Calcium', unit: 'mg' },
  { value: 'folate', label: 'Folate', unit: 'mcg' },
  { value: 'vitaminA', label: 'Vitamin A', unit: 'mcg' },
  { value: 'potassium', label: 'Potassium', unit: 'mg' },
];

/**
 * Oracle-style nutrient search (Crono Adaptation Plan item 3): rank in-stock
 * pantry items by a chosen nutrient, pulled directly rather than reacting to
 * a logged shortfall. Local-only — no provider call, no suggestion cache,
 * no cook-this action; see `add-nutrient-directed-search`.
 */
export default function NutrientSearchScreen() {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<MacroGapTarget | null>(null);
  const [items, setItems] = useState<PantryItem[] | null>(null);
  const [canonicals, setCanonicals] = useState<Map<string, CanonicalItem> | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    void Promise.all([listPantryItems(), getAllCanonicals()])
      .then(([pantryItems, canonicalList]) => {
        setItems(pantryItems);
        setCanonicals(new Map(canonicalList.map((c) => [c.id, c])));
      })
      .catch(() => {
        setLoadError(true);
        toast.show({ message: 'Your pantry could not be loaded.' });
      });
  }, [toast]);

  const assessment = useMemo(() => {
    if (target === null || items === null || canonicals === null) return null;
    return assessMacroGap(items, canonicals, target);
  }, [target, items, canonicals]);

  const option = TARGETS.find((t) => t.value === target) ?? null;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <ScreenTitle>Search by nutrient</ScreenTitle>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={space.sm}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && { opacity: opacity.pressed },
          ]}
        >
          <Feather name="x" size={22} color={color.ink} />
        </Pressable>
      </View>
      <Caption muted style={styles.subtitle}>
        What&rsquo;s in your kitchen with the most of a nutrient you&rsquo;re
        after.
      </Caption>

      <ChoiceList
        options={TARGETS.map((t) => ({ value: t.value, label: t.label }))}
        value={target}
        onChange={setTarget}
      />

      {target === null ? null : loadError ? (
        <EmptyState
          title="Couldn't load your pantry"
          detail="Close this and try again."
        />
      ) : items === null || canonicals === null ? (
        <Caption muted style={styles.loading}>
          Loading your pantry…
        </Caption>
      ) : assessment && assessment.hasMeasuredCoverage ? (
        <>
          <Card padded={false} style={styles.results}>
            {assessment.contributors.map((contributor, index) => (
              <View key={contributor.item.id}>
                {index > 0 ? <Divider /> : null}
                <ContributorRow contributor={contributor} unit={option?.unit ?? ''} />
              </View>
            ))}
          </Card>
          {assessment.hasUnmeasuredStock ? (
            <Caption muted style={styles.footnote}>
              Some in-stock items couldn&rsquo;t be measured for{' '}
              {option?.label.toLowerCase()} and aren&rsquo;t shown.
            </Caption>
          ) : null}
        </>
      ) : assessment ? (
        <EmptyState
          title={`Nothing measurable for ${option?.label.toLowerCase() ?? 'this'}`}
          detail={
            assessment.hasUnmeasuredStock
              ? "None of your in-stock items have a known value for this nutrient yet."
              : 'Nothing is currently in stock.'
          }
        />
      ) : null}
    </Screen>
  );
}

function ContributorRow({
  contributor,
  unit,
}: {
  contributor: MacroContributor;
  unit: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <RowTitle>{contributor.canonical.displayName}</RowTitle>
        <Caption muted>{daysLeftLabel(contributor.daysLeft)}</Caption>
      </View>
      <Body numeric>
        {formatAmount(contributor.contributionG)} {unit}
      </Body>
    </View>
  );
}

/** Sub-10 amounts (common for mg/mcg micronutrients) keep one decimal. */
function formatAmount(value: number): string {
  return value >= 10
    ? String(Math.round(value))
    : String(Math.round(value * 10) / 10);
}

function daysLeftLabel(daysLeft: number | null): string {
  if (daysLeft === null) return 'No expiry date';
  if (daysLeft < 0) return 'Past its expected quality date';
  if (daysLeft === 0) return 'Best quality today';
  if (daysLeft === 1) return 'Best quality through tomorrow';
  return `About ${daysLeft} days of expected quality`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.base,
  },
  closeButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: { marginTop: space.sm, marginBottom: space.lg },
  results: { marginTop: space.lg },
  loading: { marginTop: space.lg },
  footnote: { marginTop: space.sm },
  row: {
    minHeight: layout.minRowHeight,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  rowText: { flex: 1, gap: space.xs },
});
