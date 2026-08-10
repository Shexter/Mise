import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { insertPantryItem } from '@/db/queries';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Caption, RowTitle, ScreenTitle } from '@/components/Type';
import { space } from '@/constants/theme';
import { usePantryCaptureStore } from '@/store/pantryCaptureStore';

/** Reviews groceries found in one camera frame before creating pantry rows. */
export default function PantryCaptureReviewScreen() {
  const router = useRouter();
  const { proposals, purchasedAt, clear } = usePantryCaptureStore();
  const [saving, setSaving] = useState(false);
  const accepted = proposals.filter((proposal) => proposal.canonical && proposal.location);

  const discard = () => {
    clear();
    router.dismissAll();
    router.replace('/(tabs)/pantry');
  };
  const accept = async () => {
    if (!purchasedAt || saving) return;
    setSaving(true);
    try {
      await Promise.all(accepted.map((proposal) => insertPantryItem({
        canonicalId: proposal.canonical!.id,
        locationId: proposal.location!.id,
        purchasedAt,
        qtyRemaining: proposal.captured.quantity,
        qtyUnit: proposal.captured.unit,
        qtySource: 'estimate',
        photoUri: proposal.captured ? usePantryCaptureStore.getState().photoUri : null,
      })));
      discard();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll footer={<Button label={`Add ${accepted.length} item${accepted.length === 1 ? '' : 's'}`} onPress={() => void accept()} disabled={accepted.length === 0} loading={saving} />}>
      <View style={styles.header}>
        <ScreenTitle>Review pantry items</ScreenTitle>
        <Caption muted>Nothing is added until you confirm.</Caption>
      </View>
      <View style={styles.list}>
        {proposals.map((proposal, index) => (
          <Card key={`${proposal.captured.name}-${index}`}>
            <RowTitle>{proposal.canonical?.displayName ?? proposal.captured.name}</RowTitle>
            {proposal.location ? <Caption muted>{proposal.location.name}</Caption> : null}
            <Caption muted>{proposal.predictedExpiry ? `Expected quality through ${proposal.predictedExpiry} (estimate).` : 'Choose this item in the match queue before adding it.'}</Caption>
          </Card>
        ))}
      </View>
      <Body muted>Wrong item? Discard this review and add it by hand.</Body>
      <Button label="Discard" variant="ghost" onPress={discard} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, marginBottom: space.lg, gap: space.xs },
  list: { gap: space.md, marginBottom: space.lg },
});
