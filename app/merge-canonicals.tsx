import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CanonicalPickerSheet } from '@/components/match/CanonicalPickerSheet';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { Body, Caption, RowTitle, ScreenTitle } from '@/components/Type';
import { space } from '@/constants/theme';
import { mergeCanonicals } from '@/db/queries';
import type { CanonicalItem } from '@/types';

type Side = 'survivor' | 'absorbed';

/**
 * The merge surface (decision 29): pick the ingredient to keep, pick the
 * duplicate, confirm, merge. Everything the duplicate learned — aliases,
 * products — moves to the kept ingredient.
 */
export default function MergeCanonicalsScreen() {
  const toast = useToast();
  const [survivor, setSurvivor] = useState<CanonicalItem | null>(null);
  const [absorbed, setAbsorbed] = useState<CanonicalItem | null>(null);
  const [picking, setPicking] = useState<Side | null>(null);
  const [busy, setBusy] = useState(false);

  const onPick = (item: CanonicalItem) => {
    if (picking === 'survivor') setSurvivor(item);
    if (picking === 'absorbed') setAbsorbed(item);
    setPicking(null);
  };

  const onMerge = () => {
    if (!survivor || !absorbed) return;
    Alert.alert(
      'Merge these two?',
      `Everything "${absorbed.displayName}" has learned moves to "${survivor.displayName}", and "${absorbed.displayName}" is removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void mergeCanonicals(survivor.id, absorbed.id)
              .then(() => {
                toast.show({
                  message: `Merged into ${survivor.displayName}.`,
                });
                setSurvivor(null);
                setAbsorbed(null);
              })
              .catch(() => {
                toast.show({ message: 'The merge did not go through.' });
              })
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  return (
    <Screen scroll>
      <ScreenTitle style={styles.title}>Merge duplicates</ScreenTitle>
      <Caption muted style={styles.subtitle}>
        Two entries for the same food? Merge them and everything they've
        learned ends up in one place.
      </Caption>

      <View style={styles.cards}>
        <Card title="Keep" padded>
          {survivor ? (
            <RowTitle>{survivor.displayName}</RowTitle>
          ) : (
            <Body muted>The entry that stays.</Body>
          )}
          <Button
            label={survivor ? 'Change' : 'Pick ingredient'}
            variant="secondary"
            onPress={() => setPicking('survivor')}
            style={styles.pickButton}
          />
        </Card>

        <Card title="Fold in" padded>
          {absorbed ? (
            <RowTitle>{absorbed.displayName}</RowTitle>
          ) : (
            <Body muted>The duplicate that gets absorbed.</Body>
          )}
          <Button
            label={absorbed ? 'Change' : 'Pick ingredient'}
            variant="secondary"
            onPress={() => setPicking('absorbed')}
            style={styles.pickButton}
          />
        </Card>

        <Button
          label="Merge"
          onPress={onMerge}
          disabled={!survivor || !absorbed || survivor.id === absorbed.id}
          loading={busy}
        />
      </View>

      <CanonicalPickerSheet
        visible={picking !== null}
        title={picking === 'survivor' ? 'Which one stays?' : 'Which one folds in?'}
        allowCreate={false}
        excludedIds={
          picking === 'absorbed' && survivor
            ? [survivor.id]
            : picking === 'survivor' && absorbed
              ? [absorbed.id]
              : []
        }
        onPick={onPick}
        onClose={() => setPicking(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.base },
  subtitle: { marginTop: space.sm, marginBottom: space.lg },
  cards: { gap: space.lg },
  pickButton: { marginTop: space.md },
});
