import { randomUUID } from 'expo-crypto';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, SectionLabel } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import { listWeekTemplates, saveWeekTemplate } from '@/db/queries';
import { copyWeekTemplate } from '@/logic/plannerSchedule';
import { weekDays } from '@/components/planner/model';
import type { PlannerDraft, WeekTemplate } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  draft: PlannerDraft;
  onApply: (draft: PlannerDraft, message: string) => void;
}

/**
 * Save this week's shape, or lay a saved one over the current week.
 *
 * A template stores relative weekdays and the recipe snapshots as they were, so
 * reusing it does not silently pick up later edits to the collection. Applying
 * one mints new identities and clears eaten, skipped and linked state — a reused
 * week is a fresh plan, not a claim that you ate the same food again.
 */
export function WeekTemplateSheet({ visible, onClose, draft, onApply }: Props) {
  const [templates, setTemplates] = useState<WeekTemplate[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      try {
        setTemplates(await listWeekTemplates());
      } catch {
        setTemplates([]);
      }
    })();
  }, [visible]);

  const days = weekDays(draft);

  const save = async () => {
    if (draft.slots.length === 0) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const template: WeekTemplate = {
        id: randomUUID(),
        name: name.trim() || 'My week',
        createdAt: now,
        updatedAt: now,
        entries: draft.slots.flatMap((slot) => {
          const batch = draft.batches.find((candidate) => candidate.id === slot.batchId);
          const snapshot = draft.snapshots.find((candidate) => candidate.id === batch?.snapshotId);
          if (!batch || !snapshot) return [];
          const weekday = days.indexOf(slot.localDate);
          if (weekday < 0) return [];
          return [{
            id: randomUUID(), weekday, mealType: slot.mealType, snapshot,
            eatenPortions: slot.eatenPortions, producedPortions: batch.producedPortions,
          }];
        }),
      };
      await saveWeekTemplate(template);
      setTemplates(await listWeekTemplates());
      setName('');
    } catch (error) {
      Alert.alert('That week could not be saved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const reuse = (template: WeekTemplate) => {
    const apply = () => {
      try {
        const copied = copyWeekTemplate(template, draft.weekStart, draft.scheduleId ?? '', randomUUID);
        onApply({ ...draft, ...copied }, `${template.name} laid over this week`);
        onClose();
      } catch (error) {
        Alert.alert('That week could not be applied', error instanceof Error ? error.message : 'Please try again.');
      }
    };

    if (draft.slots.length > 0) {
      Alert.alert(
        'Replace this week?',
        `${draft.slots.length} meal${draft.slots.length === 1 ? '' : 's'} already planned this week will come off the plan. Anything already logged stays in your history.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: apply },
        ],
      );
      return;
    }
    apply();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Weeks you can reuse">
      <SectionLabel>Save this week</SectionLabel>
      {draft.slots.length === 0 ? (
        <Caption muted>Schedule a meal first — there is nothing to save yet.</Caption>
      ) : (
        <View style={styles.save}>
          <Field value={name} onChangeText={setName} label="Name" placeholder="My week" />
          <Button
            label={`Save these ${draft.slots.length} meal${draft.slots.length === 1 ? '' : 's'}`}
            variant="secondary"
            onPress={() => void save()}
            loading={busy}
            block
          />
        </View>
      )}

      <SectionLabel style={styles.sectionLabel}>Saved weeks</SectionLabel>
      {templates.length === 0 ? (
        <Caption muted>None yet. A saved week can be laid over any week later.</Caption>
      ) : (
        <View style={styles.rows}>
          {templates.map((template) => (
            <Pressable
              key={template.id}
              onPress={() => reuse(template)}
              accessibilityRole="button"
              accessibilityLabel={template.name}
              accessibilityHint={`Lays ${template.entries.length} meals over this week`}
              style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
            >
              <View style={styles.rowText}>
                <Body>{template.name}</Body>
                <Caption muted>{template.entries.length} meal{template.entries.length === 1 ? '' : 's'}</Caption>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  save: { gap: space.md, marginTop: space.sm },
  sectionLabel: { marginTop: space.lg, marginBottom: space.sm },
  rows: { borderTopWidth: 1, borderTopColor: color.line },
  row: {
    minHeight: layout.minRowHeight, justifyContent: 'center', paddingVertical: space.md,
    borderBottomWidth: 1, borderBottomColor: color.line,
  },
  rowText: { gap: space.xs },
});
