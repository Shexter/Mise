import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Segmented } from '@/components/Choice';
import { expiryLabel, statusLabel } from '@/components/pantry/labels';
import { Sheet } from '@/components/Sheet';
import { Caption, ScreenTitle, SectionLabel } from '@/components/Type';
import { space } from '@/constants/theme';
import { usePantryStore, type PantryEntry } from '@/store/pantryStore';
import { FULLNESS_LEVELS, type Fullness } from '@/types';

interface Props {
  entry: PantryEntry | null;
  onClose: () => void;
}

const FULLNESS_OPTIONS = FULLNESS_LEVELS.map((value) => ({
  value,
  label: value === 'full' ? 'Full' : value === 'half' ? 'Half' : value === 'low' ? 'Low' : 'Out',
}));

/** Uses-tracked classes get the four-bucket fullness control (decision 14). */
const USES_TRACKED = ['seasoning', 'condiment'];

/**
 * One item: its status in words, its expiry, and the one-tap actions.
 * The only figure ever shown is the user's own entry, marked as theirs.
 */
export function PantryItemSheet({ entry, onClose }: Props) {
  const store = usePantryStore();
  const [busy, setBusy] = useState(false);

  if (!entry) return <Sheet visible={false} onClose={onClose} title="">{null}</Sheet>;

  const run = (work: () => Promise<void>, keepOpen = false) => {
    if (busy) return;
    setBusy(true);
    void work()
      .catch(() => {})
      .finally(() => {
        setBusy(false);
        if (!keepOpen) onClose();
      });
  };

  const setFullness = (fullness: Fullness) => {
    run(() => store.setFullness(entry.id, fullness), true);
  };

  return (
    <Sheet visible onClose={onClose} title={entry.name}>
      <View style={styles.facts}>
        <Caption muted>
          {entry.locationName}
          {entry.opened ? ' · opened' : ''}
        </Caption>
        <ScreenTitle>
          {statusLabel(entry.status, entry.statusConfident)}
        </ScreenTitle>
        <Caption muted>{expiryLabel(entry)}</Caption>
        {entry.userEnteredQty ? (
          <Caption muted>Your entry: {entry.userEnteredQty}</Caption>
        ) : null}
      </View>

      {entry.suggestFullnessCheck ? (
        <Caption muted style={styles.check}>
          It's been a while since this was checked — a quick look keeps the
          list honest.
        </Caption>
      ) : null}

      {USES_TRACKED.includes(entry.foodClass) ? (
        <View style={styles.section}>
          <SectionLabel muted>How full is it?</SectionLabel>
          <Segmented
            options={FULLNESS_OPTIONS}
            value={entry.fullness ?? 'full'}
            onChange={setFullness}
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        {!entry.opened ? (
          <Button
            label="Mark opened"
            variant="secondary"
            onPress={() => run(() => store.markOpened(entry.id))}
            disabled={busy}
          />
        ) : null}
        {entry.freezable ? (
          <Button
            label="Freeze it"
            variant="secondary"
            onPress={() => run(() => store.freeze(entry.id))}
            disabled={busy}
          />
        ) : null}
        <Button
          label="Running low"
          variant="secondary"
          onPress={() => run(() => store.markRunningLow(entry.id))}
          disabled={busy}
        />
        <Button
          label="Used it up"
          onPress={() => run(() => store.markUsedUp(entry.id))}
          disabled={busy}
        />
        <Button
          label="Discard — it went off"
          variant="destructive"
          onPress={() => run(() => store.discard(entry.id))}
          disabled={busy}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  facts: { gap: space.xs },
  section: { gap: space.sm, marginTop: space.base },
  check: { marginTop: space.base },
  actions: { gap: space.sm, marginTop: space.lg },
});
