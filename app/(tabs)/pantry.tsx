import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Card, Divider } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Segmented } from '@/components/Choice';
import { AddPantryItemSheet } from '@/components/pantry/AddPantryItemSheet';
import { PantryItemSheet } from '@/components/pantry/PantryItemSheet';
import { SavedRecipesSection } from '@/components/recipes/SavedRecipesSection';
import { expiryLabel, statusLabel } from '@/components/pantry/labels';
import { Screen } from '@/components/Screen';
import { EmptyPantryIllustration } from '@/components/StateIllustration';
import { Body, Caption, RowTitle, ScreenTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { listPendingCaptures, listRecipes } from '@/db/queries';
import { EXPIRING_SOON_DAYS } from '@/logic/stockStatus';
import { usePantryStore, type PantryEntry } from '@/store/pantryStore';
import type { Recipe } from '@/types';

type PantrySubsection = 'stock' | 'recipes';
const SUBSECTIONS = [
  { value: 'stock', label: 'Stock' },
  { value: 'recipes', label: 'Recipes' },
] as const;

/**
 * The catalogue: what is in the kitchen, soonest expiry first. Statuses are
 * advisory words, never numbers (decision 15) — the one figure ever shown
 * is a quantity the user typed themselves, in the detail sheet, marked as
 * theirs.
 */
export default function PantryScreen() {
  const router = useRouter();
  const groups = usePantryStore((state) => state.groups);
  const refresh = usePantryStore((state) => state.refresh);
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingCaptureCount, setPendingCaptureCount] = useState(0);
  const [subsection, setSubsection] = useState<PantrySubsection>('stock');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  // Derived from the store so the sheet reflects taps live; null once the
  // entry leaves the catalogue (e.g. discarded).
  const selected =
    groups.flatMap((group) => group.entries).find((e) => e.id === selectedId) ??
    null;

  const checkPending = useCallback(async () => {
    setPendingCaptureCount((await listPendingCaptures()).length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void listRecipes().then(setRecipes);
      void checkPending();
    }, [refresh, checkPending]),
  );

  return (
    <Screen scroll>
      <View style={styles.header}>
        <ScreenTitle>Pantry</ScreenTitle>
        {subsection === 'stock' ? (
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/locations')}
              accessibilityRole="button"
              accessibilityLabel="Storage locations"
              hitSlop={space.sm}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <Feather name="map-pin" size={20} color={color.ink} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/nutrient-search')}
              accessibilityRole="button"
              accessibilityLabel="Search by nutrient"
              hitSlop={space.sm}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <Feather name="search" size={20} color={color.ink} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/pantry-capture')}
              accessibilityRole="button"
              accessibilityLabel="Add to pantry with camera"
              hitSlop={space.sm}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <Feather name="camera" size={20} color={color.ink} />
            </Pressable>
            <Pressable
              onPress={() => setAdding(true)}
              accessibilityRole="button"
              accessibilityLabel="Add an item"
              hitSlop={space.sm}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <Feather name="plus" size={20} color={color.ink} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/recipe-intake')}
              accessibilityRole="button"
              accessibilityLabel="Save a recipe"
              hitSlop={space.sm}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <Feather name="plus" size={20} color={color.ink} />
            </Pressable>
          </View>
        )}
      </View>

      <Segmented options={SUBSECTIONS} value={subsection} onChange={setSubsection} style={styles.subsections} />

      {subsection === 'stock' && pendingCaptureCount > 0 ? (
        <Pressable
          onPress={() => router.push('/pending-captures')}
          accessibilityRole="button"
          accessibilityLabel={`${pendingCaptureCount} saved capture${pendingCaptureCount > 1 ? 's' : ''}. Open saved captures.`}
          style={({ pressed }) => [styles.banner, pressed && { opacity: opacity.pressed }]}
        >
          <Body>{pendingCaptureCount} saved capture{pendingCaptureCount > 1 ? 's' : ''}</Body>
          <Caption muted>Waiting for a key or connection — tap to view.</Caption>
        </Pressable>
      ) : null}

      {subsection === 'recipes' ? (
        <SavedRecipesSection recipes={recipes} showHeaderAction={false} />
      ) : groups.length === 0 ? (
        <EmptyState
          title="Nothing catalogued yet"
          detail="Add what's already in your kitchen, or let a receipt do it."
          illustration={
            <EmptyPantryIllustration accessibilityLabel="A half-empty kitchen shelf, ready for pantry items" />
          }
          actionLabel="Add an item"
          onAction={() => setAdding(true)}
        />
      ) : (
        <View style={styles.groups}>
          {groups.map((group) => (
            <Card key={group.canonicalId} padded={false}>
              <View style={styles.groupHeader}>
                <RowTitle>{group.name}</RowTitle>
                {group.count > 1 ? (
                  <Caption muted>×{group.count}</Caption>
                ) : null}
              </View>
              {group.entries.map((entry, index) => (
                <View key={entry.id}>
                  {index >= 0 ? <Divider /> : null}
                  <EntryRow entry={entry} onPress={() => setSelectedId(entry.id)} />
                </View>
              ))}
            </Card>
          ))}
        </View>
      )}

      <AddPantryItemSheet visible={adding} onClose={() => setAdding(false)} />
      <PantryItemSheet
        entry={selected}
        onClose={() => setSelectedId(null)}
      />
    </Screen>
  );
}

function EntryRow({
  entry,
  onPress,
}: {
  entry: PantryEntry;
  onPress: () => void;
}) {
  const urgent = entry.daysLeft !== null && entry.daysLeft <= EXPIRING_SOON_DAYS;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${entry.name}, ${entry.locationName}`}
      style={({ pressed }) => [
        styles.entryRow,
        pressed && { opacity: opacity.pressed },
      ]}
    >
      <View style={styles.entryText}>
        <Caption muted>
          {entry.locationName}
          {entry.opened ? ' · opened' : ''}
          {' · '}
          {statusLabel(entry.status, entry.statusConfident)}
        </Caption>
        <Caption style={urgent ? styles.urgent : undefined} muted={!urgent}>
          {expiryLabel(entry)}
        </Caption>
      </View>
      <Feather name="chevron-right" size={16} color={color.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: space.base,
    marginBottom: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: { flexDirection: 'row', gap: space.sm },
  subsections: { marginBottom: space.lg },
  banner: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    padding: layout.cardPadding,
    gap: space.xs,
    marginBottom: space.lg,
  },
  headerButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groups: { gap: space.base },
  groupHeader: {
    minHeight: layout.minRowHeight - space.base,
    paddingHorizontal: layout.cardPadding,
    paddingTop: space.md,
    paddingBottom: space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryRow: {
    minHeight: layout.minRowHeight - space.base,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  entryText: { flex: 1, gap: space.xs },
  urgent: { color: color.paprika },
});
