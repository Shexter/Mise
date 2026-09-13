import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { SkeletonLine } from '@/components/Skeleton';
import { Body, Caption, RowTitle, SectionLabel } from '@/components/Type';
import { useToast } from '@/components/Toast';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import {
  applyPlanGroceries,
  getActivePlanGroceryApplication,
  getAllCanonicals,
  listPlanPantryCoverage,
  savePlanPantryCoverage,
  undoPlanGroceries,
  type ActivePlanGroceryApplication,
} from '@/db/queries';
import { friendlyDate } from '@/logic/dates';
import {
  buildPlanGroceryDemand,
  demandAfterCoverage,
  diffPlanGroceryDemand,
  groceryRevisionKey,
} from '@/logic/plannerGroceries';
import { useMealScheduleStore } from '@/store/mealScheduleStore';
import { formatPortions } from '@/components/planner/MealSlotRow';
import type { CanonicalItem, PlanGroceryDemand, PlanPantryCoverage } from '@/types';

/**
 * The plan's groceries, inside the existing Shop list rather than beside it.
 *
 * The pantry is optional here and says so. The full recipe-derived list is
 * usable with an empty, unconfigured or ignored pantry — **Check pantry** is a
 * refinement someone chooses, never a gate, and skipping every coverage question
 * still applies the whole list. Absence of a coverage answer means "keep the
 * requirement", not "block the haul".
 */
export function PlanGrocerySection() {
  const toast = useToast();
  const schedule = useMealScheduleStore((state) => state.schedule);
  const [canonicals, setCanonicals] = useState<ReadonlyMap<string, CanonicalItem>>(new Map());
  const [coverage, setCoverage] = useState<PlanPantryCoverage[]>([]);
  const [active, setActive] = useState<ActivePlanGroceryApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCoverage, setShowCoverage] = useState(false);

  const refresh = useCallback(async () => {
    if (!schedule) { setLoading(false); return; }
    setLoading(true);
    try {
      const [items, cover, current] = await Promise.all([
        getAllCanonicals(),
        listPlanPantryCoverage(schedule.id, schedule.revision),
        getActivePlanGroceryApplication(schedule.id),
      ]);
      setCanonicals(new Map(items.map((item) => [item.id, item])));
      setCoverage(cover);
      setActive(current);
    } finally {
      setLoading(false);
    }
  }, [schedule]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const demands = useMemo(() => {
    if (!schedule) return [];
    try {
      return buildPlanGroceryDemand({
        batches: schedule.batches, snapshots: schedule.snapshots, canonicals,
      });
    } catch {
      return [];
    }
  }, [schedule, canonicals]);

  const coverageByKey = useMemo(
    () => new Map(coverage.map((entry) => [entry.demandKey, entry])),
    [coverage],
  );

  // What would actually be bought: full demand, minus only the coverage the
  // person chose to confirm against this revision.
  const effective = useMemo(
    () => demands.map((demand) =>
      demandAfterCoverage(demand, coverageByKey.get(demand.key), schedule?.revision ?? -1)),
    [demands, coverageByKey, schedule],
  );

  if (!schedule || schedule.batches.length === 0) return null;

  if (loading) {
    return (
      <View style={styles.section}>
        <SectionLabel>Groceries for your plan</SectionLabel>
        <SkeletonLine width="70%" />
        <SkeletonLine width="50%" />
      </View>
    );
  }

  const revisionKey = groceryRevisionKey(schedule.id, schedule.revision, effective);
  const appliedAndCurrent = active !== null && active.revisionKey === revisionKey;
  const planChanged = active !== null && !appliedAndCurrent;
  const neverApplied = active === null;

  const buying = effective.filter((demand) => demand.quantity !== 0 || demand.hasUnknownQuantity);
  const covered = effective.filter((demand) => demand.quantity === 0 && !demand.hasUnknownQuantity);

  const diff = planChanged
    ? diffPlanGroceryDemand(
      // The applied set is not stored per demand, so the honest summary is a
      // count of what the list would become, not a false itemised delta.
      effective.filter(() => false),
      effective,
    )
    : null;

  const dates = schedule.batches.map((batch) => batch.cookDate).sort();
  const rangeLabel = dates.length > 0
    ? `${friendlyDate(dates[0]!)} – ${friendlyDate(dates[dates.length - 1]!)}`
    : '';

  const apply = async () => {
    setBusy(true);
    try {
      const applicationId = await applyPlanGroceries(schedule.id, schedule.revision, effective);
      setActive(await getActivePlanGroceryApplication(schedule.id));
      toast.show({
        kind: 'success',
        message: 'Grocery list updated.',
        actionLabel: 'Undo',
        durationMs: 8_000,
        onAction: () => void (async () => {
          try {
            await undoPlanGroceries(applicationId);
            setActive(await getActivePlanGroceryApplication(schedule.id));
            toast.show({ message: 'Plan groceries removed. Purchases and receipts are untouched.' });
          } catch (error) {
            Alert.alert('Undo is not possible', error instanceof Error ? error.message : 'Please review the list.');
          }
        })(),
      });
    } catch (error) {
      Alert.alert('Groceries could not be applied', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const setCoverageFor = async (demand: PlanGroceryDemand, haveEnough: boolean) => {
    const entry: PlanPantryCoverage = {
      demandKey: demand.key,
      scheduleRevision: schedule.revision,
      coveredQuantity: haveEnough ? null : 0,
      unit: demand.unit,
      haveEnough,
    };
    await savePlanPantryCoverage(schedule.id, entry);
    setCoverage((current) => [...current.filter((row) => row.demandKey !== demand.key), entry]);
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <RowTitle>Groceries for your plan</RowTitle>
        <Caption muted>
          {rangeLabel} · from {schedule.slots.length} meal{schedule.slots.length === 1 ? '' : 's'} ·{' '}
          {schedule.batches.length} batch{schedule.batches.length === 1 ? '' : 'es'}
        </Caption>
      </View>

      {planChanged ? (
        <View style={styles.changed}>
          <Body>Plan changed — review groceries</Body>
          <Caption muted>
            Your applied list is from an earlier version of the week. The checklist below still works; nothing has
            been altered without your say-so.
          </Caption>
        </View>
      ) : null}

      {buying.length === 0 ? (
        <View style={styles.empty}>
          <Body>Nothing to buy for these meals</Body>
          <Caption muted>
            {covered.length > 0
              ? `You confirmed you already have all ${covered.length} ingredient${covered.length === 1 ? '' : 's'}.`
              : 'These meals need no ingredients the plan can price.'}
          </Caption>
        </View>
      ) : (
        <View style={styles.rows}>
          {buying.map((demand) => (
            <View key={demand.key} style={styles.row}>
              <View style={styles.rowText}>
                <Body numberOfLines={2}>{demand.displayName}</Body>
                <Caption muted>
                  {demand.contributions.length} meal source
                  {demand.contributions.length === 1 ? '' : 's'}
                  {demand.hasUnknownQuantity ? ' · some amounts unknown' : ''}
                  {demand.canonicalId === null ? ' · not matched to a catalogue ingredient' : ''}
                </Caption>
              </View>
              <Body numeric>
                {demand.quantity === null || demand.unit === null
                  ? 'Amount unknown'
                  : `${formatPortions(Math.round(demand.quantity * 10) / 10)} ${demand.unit}`}
              </Body>
            </View>
          ))}
        </View>
      )}

      <Pressable
        onPress={() => setShowCoverage((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showCoverage }}
        accessibilityLabel="Already have some? Optional pantry check"
        style={({ pressed }) => [styles.optional, pressed && { opacity: opacity.pressed }]}
      >
        <View style={styles.rowText}>
          <Body style={styles.link}>Already have some?</Body>
          <Caption muted>Checking the pantry is optional. Skip it and the full list still applies.</Caption>
        </View>
        <Feather name={showCoverage ? 'chevron-up' : 'chevron-down'} size={18} color={color.action} />
      </Pressable>

      {showCoverage ? (
        <View style={styles.rows}>
          {demands.map((demand) => {
            const entry = coverageByKey.get(demand.key);
            const confirmed = entry?.haveEnough === true && entry.scheduleRevision === schedule.revision;
            return (
              <View key={demand.key} style={styles.row}>
                <View style={styles.rowText}>
                  <Body numberOfLines={2}>{demand.displayName}</Body>
                  <Caption muted>
                    {confirmed ? 'You said you have enough' : 'Counted in full'}
                    {entry && entry.scheduleRevision !== schedule.revision
                      ? ' · your earlier answer needs rechecking since the plan changed'
                      : ''}
                  </Caption>
                </View>
                <Pressable
                  onPress={() => void setCoverageFor(demand, !confirmed)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: confirmed }}
                  accessibilityLabel={`Have enough ${demand.displayName}`}
                  style={({ pressed }) => [styles.toggle, confirmed && styles.toggleOn, pressed && { opacity: opacity.pressed }]}
                >
                  <Caption style={confirmed ? styles.toggleOnText : undefined}>
                    {confirmed ? 'Have enough' : 'Mark have enough'}
                  </Caption>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={neverApplied ? 'Use this grocery list' : planChanged ? 'Apply changes' : 'Applied'}
          onPress={() => void apply()}
          disabled={appliedAndCurrent || busy}
          loading={busy}
          block
        />
        {appliedAndCurrent ? (
          <Caption muted>
            Applied on {friendlyDate(active!.appliedAt.slice(0, 10))}. Purchased and manually edited rows are never
            silently changed.
          </Caption>
        ) : null}
        {diff && diff.added.length > 0 ? (
          <Caption muted>{diff.added.length} ingredient rows in the current plan.</Caption>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: space.lg, gap: space.sm },
  header: { gap: space.xs },
  changed: {
    padding: layout.cardPadding,
    borderWidth: 1,
    borderColor: color.action,
    borderRadius: radius.card,
    gap: space.xs,
  },
  rows: { borderTopWidth: 1, borderTopColor: color.line },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.base,
    minHeight: layout.minRowHeight, paddingVertical: space.md,
    borderBottomWidth: 1, borderBottomColor: color.line,
  },
  rowText: { flex: 1, gap: space.xs },
  empty: { paddingVertical: space.base, gap: space.xs },
  optional: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: layout.minTouchTarget, gap: space.base, marginTop: space.sm,
  },
  link: { color: color.action },
  toggle: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
  },
  toggleOn: { backgroundColor: color.action, borderColor: color.action },
  toggleOnText: { color: color.onAction },
  actions: { marginTop: space.base, gap: space.sm },
});
