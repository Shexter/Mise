import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Card, Divider } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FoodVisual } from '@/components/FoodVisual';
import { Pill, PillRow } from '@/components/Pill';
import { Sprig } from '@/components/icons/Sprig';
import { Segmented } from '@/components/Choice';
import { AddPantryItemSheet } from '@/components/pantry/AddPantryItemSheet';
import { PantryItemSheet } from '@/components/pantry/PantryItemSheet';
import { SavedRecipesSection } from '@/components/recipes/SavedRecipesSection';
import { expiryLabel, statusLabel } from '@/components/pantry/labels';
import { Screen } from '@/components/Screen';
import { StateIllustration } from '@/components/StateIllustration';
import { Body, Caption, DisplayTitle, RowTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { listPendingCaptures, listRecipes } from '@/db/queries';
import { EXPIRING_SOON_DAYS } from '@/logic/stockStatus';
import { useCookingPreferencesStore } from '@/store/cookingPreferencesStore';
import { usePantryStore, type PantryEntry } from '@/store/pantryStore';
import type { LocationKind, Recipe } from '@/types';

/** A storage location's own icon and wash. Kind, not name — names are the
 *  user's to change, and a renamed fridge is still a fridge. */
const LOCATION_STYLE: Record<LocationKind, {
  icon: keyof typeof Feather.glyphMap;
  tint: 'tintPaprika' | 'tintBlue' | 'tintOlive' | 'tintWheat';
}> = {
  fridge: { icon: 'thermometer', tint: 'tintBlue' },
  freezer: { icon: 'cloud-snow', tint: 'tintBlue' },
  ambient: { icon: 'archive', tint: 'tintWheat' },
  counter: { icon: 'grid', tint: 'tintOlive' },
};

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
  const pantryLoading = usePantryStore((state) => state.loading);
  const locations = usePantryStore((state) => state.locations);
  const refresh = usePantryStore((state) => state.refresh);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const cookingPreferences = useCookingPreferencesStore((state) => state.cookingPreferences);
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

  // Only locations that currently hold something get a pill. A filter that
  // leads to a guaranteed empty list is a dead control.
  const stockedLocationIds = new Set(
    groups.flatMap((group) => group.entries).map((entry) => entry.locationId),
  );
  const filterLocations = locations.filter((location) =>
    stockedLocationIds.has(location.id),
  );

  // A filter that no longer matches anything — the last jar in the fridge was
  // used up — silently stops applying rather than showing an empty pantry.
  const activeFilter =
    locationFilter !== null && stockedLocationIds.has(locationFilter)
      ? locationFilter
      : null;

  const visibleGroups = activeFilter === null
    ? groups
    : groups
        .map((group) => ({
          ...group,
          entries: group.entries.filter((entry) => entry.locationId === activeFilter),
        }))
        .filter((group) => group.entries.length > 0)
        .map((group) => ({ ...group, count: group.entries.length }));

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
        <DisplayTitle>Pantry</DisplayTitle>
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
            {/* Photographing and speaking items moved into the centre add
                surface, which reaches them from every tab rather than only
                from this header. They are the same destinations. */}
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
        <Sprig />
      </View>

      <Segmented options={SUBSECTIONS} value={subsection} onChange={setSubsection} style={styles.subsections} />

      {subsection === 'stock' && filterLocations.length > 1 ? (
        <PillRow style={styles.filters}>
          <Pill
            label="All"
            icon="layers"
            selected={activeFilter === null}
            onPress={() => setLocationFilter(null)}
          />
          {filterLocations.map((location) => {
            const style = LOCATION_STYLE[location.kind];
            return (
              <Pill
                key={location.id}
                label={location.name}
                icon={style.icon}
                tint={style.tint}
                selected={activeFilter === location.id}
                onPress={() =>
                  setLocationFilter(activeFilter === location.id ? null : location.id)
                }
              />
            );
          })}
        </PillRow>
      ) : null}

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

      {/* One prompt, pointing at the shared planner. Planning lives on Today,
          so this sends people there rather than starting a second place a plan
          could be kept — and it appears whether setup was skipped or finished,
          which is the case that used to get no guidance at all. */}
      {subsection === 'stock'
        && (cookingPreferences?.mealPrepStatus === 'deferred'
          || cookingPreferences?.mealPrepStatus === 'completed') ? (
        <Pressable
          onPress={() => router.push('/(tabs)')}
          accessibilityRole="button"
          accessibilityLabel="Plan your meals on Today"
          accessibilityHint="Opens Today, where the week is planned"
          style={({ pressed }) => [styles.banner, styles.resumeBanner, pressed && { opacity: opacity.pressed }]}
        >
          <View style={styles.resumeHeader}>
            <Feather name="layers" size={18} color={color.action} />
            <Body style={styles.resumeTitle}>Plan your meals on Today</Body>
          </View>
          <Caption muted>
            Choose meals for the week and Mise makes the grocery list. Your stock here is an optional refinement, never
            a requirement.
          </Caption>
        </Pressable>
      ) : null}

      {subsection === 'recipes' ? (
        <SavedRecipesSection recipes={recipes} showHeaderAction={false} />
      ) : pantryLoading && groups.length === 0 ? (
        // Nothing yet, rather than an empty shelf: a half-empty shelf drawn
        // while the query is still running says the kitchen is empty, which is
        // a claim the app cannot make until the read comes back.
        null
      ) : groups.length === 0 ? (
        <>
          <EmptyState
            title="Nothing catalogued yet"
            detail="Add what's already in your kitchen, or let a receipt do it."
            illustration={
              <StateIllustration
                name="empty-pantry"
                accessibilityLabel="A half-empty kitchen shelf, ready for pantry items"
              />
            }
            actionLabel="Add an item"
            onAction={() => setAdding(true)}
          />
          {/* The invitation, not a gate: an empty pantry is the one moment
              where naming a whole fridge in one breath is worth more than any
              single add, and it is still one tap to ignore. */}
          <Pressable
            onPress={() => router.push('/pantry-voice')}
            accessibilityRole="button"
            accessibilityLabel="Fill your pantry by speaking"
            accessibilityHint="Name everything in one go. You review the draft before anything is added."
            style={({ pressed }) => [styles.banner, pressed && { opacity: opacity.pressed }]}
          >
            <View style={styles.resumeHeader}>
              <Feather name="mic" size={18} color={color.action} />
              <Body style={styles.resumeTitle}>Fill it by speaking</Body>
            </View>
            <Caption muted>
              Open the fridge and name what you see — “six eggs, half a broccoli,
              some butter”. You check the draft before anything is added.
            </Caption>
          </Pressable>
        </>
      ) : (
        <View style={styles.groups}>
          {visibleGroups.map((group) => {
            // One of a thing is one row. A header naming the item above a
            // single sub-row that repeats nothing is two rows of chrome for
            // one jar of oats, and it is the common case by far.
            const single = group.entries.length === 1 ? group.entries[0]! : null;

            if (single) {
              return (
                <Card key={group.canonicalId} variant="outline" padded={false}>
                  <EntryRow
                    entry={single}
                    name={group.name}
                    onPress={() => setSelectedId(single.id)}
                  />
                </Card>
              );
            }

            return (
              <Card key={group.canonicalId} variant="outline" padded={false}>
                <View style={styles.groupHeader}>
                  <View style={styles.groupHeaderLeft}>
                    <FoodVisual
                      canonicalId={group.canonicalId}
                      category={group.foodClass}
                      photoUri={group.photoUri}
                      size="lg"
                    />
                    <RowTitle>{group.name}</RowTitle>
                  </View>
                  <Caption muted>×{group.count}</Caption>
                </View>
                {group.entries.map((entry) => (
                  <View key={entry.id}>
                    <Divider />
                    <EntryRow entry={entry} onPress={() => setSelectedId(entry.id)} />
                  </View>
                ))}
              </Card>
            );
          })}
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
  name,
  onPress,
}: {
  entry: PantryEntry;
  /** Given when this row stands alone; omitted under a group header. */
  name?: string;
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
      <View style={styles.entryRowLeft}>
        <FoodVisual
          photoUri={entry.photoUri}
          canonicalId={entry.canonicalId}
          category={entry.foodClass}
          size={name ? 'lg' : 'sm'}
        />
        <View style={styles.entryText}>
          {name ? <RowTitle numberOfLines={1}>{name}</RowTitle> : null}
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
    gap: space.sm,
  },
  headerActions: { flexDirection: 'row', gap: space.sm },
  subsections: { marginBottom: space.base },
  filters: { marginBottom: space.lg },
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
    gap: space.md,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    flex: 1,
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
  entryRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    flex: 1,
  },
  entryText: { flex: 1, gap: space.xs },
  urgent: { color: color.paprika },
  resumeBanner: {
    borderColor: color.action,
    backgroundColor: color.surface,
  },
  resumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  resumeTitle: {
    fontWeight: '600',
    color: color.action,
  },
});
