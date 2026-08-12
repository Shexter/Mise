import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CanonicalPickerSheet } from '@/components/match/CanonicalPickerSheet';
import { Screen } from '@/components/Screen';
import { Body, Caption, RowTitle, ScreenTitle } from '@/components/Type';
import { useToast } from '@/components/Toast';
import { space } from '@/constants/theme';
import { getCanonicalById } from '@/db/queries';
import { confirmBarcodeMatch } from '@/logic/barcode';
import { useBarcodeCaptureStore } from '@/store/barcodeCaptureStore';
import type { CanonicalItem } from '@/types';

/** Resolves the one uncertainty a barcode lookup can have before review. */
export default function BarcodeMatchScreen() {
  const router = useRouter();
  const toast = useToast();
  const { pendingMatch, clearPendingMatch, addSessionProduct } = useBarcodeCaptureStore();
  const [suggested, setSuggested] = useState<CanonicalItem | null | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSuggested(undefined);
    if (!pendingMatch) return;
    void getCanonicalById(pendingMatch.canonicalId).then(setSuggested);
  }, [pendingMatch]);

  const save = async (canonicalId: string) => {
    if (!pendingMatch || saving) return;
    setSaving(true);
    try {
      const product = await confirmBarcodeMatch(pendingMatch.product, canonicalId);
      const returnToBatch = pendingMatch.returnToBatch;
      clearPendingMatch();
      if (returnToBatch) {
        addSessionProduct(product, 'open-food-facts');
        router.replace({ pathname: '/pantry-capture', params: { barcodeMode: 'batch' } });
      } else {
        router.replace({ pathname: '/barcode-review', params: { gtin: product.gtin ?? pendingMatch.product.gtin, origin: 'open-food-facts' } });
      }
    } catch (error) {
      toast.show({ message: error instanceof Error ? error.message : 'Could not save this barcode match.' });
    } finally {
      setSaving(false);
    }
  };

  if (!pendingMatch) {
    return (
      <Screen>
        <View style={styles.empty}>
          <ScreenTitle>Barcode match</ScreenTitle>
          <Body muted>That scan is no longer available. Scan it again to continue.</Body>
          <Button label="Back to capture" onPress={() => router.replace('/pantry-capture')} />
        </View>
      </Screen>
    );
  }

  if (suggested === undefined) return <Screen><View style={styles.empty}><Caption muted>Loading barcode match…</Caption></View></Screen>;

  if (!suggested) {
    return <Screen><View style={styles.empty}><ScreenTitle>Barcode match</ScreenTitle><Body muted>This suggested ingredient is no longer available.</Body><Button label="Back to capture" onPress={() => router.replace('/pantry-capture')} /></View></Screen>;
  }

  return (
    <Screen
      scroll
      footer={
        <View style={styles.footer}>
          <Button label="Yes, that's it" onPress={() => void save(suggested.id)} loading={saving} />
          <Button label="Pick something else" variant="secondary" onPress={() => setPickerOpen(true)} disabled={saving} />
          <Button label="Cancel" variant="ghost" onPress={() => { clearPendingMatch(); router.replace('/pantry-capture'); }} disabled={saving} />
        </View>
      }
    >
      <View style={styles.header}>
        <ScreenTitle>Check a match</ScreenTitle>
        <Caption muted>The product name is close, but Mise needs your confirmation.</Caption>
      </View>
      <Card>
        <Caption muted>From barcode</Caption>
        <RowTitle>{pendingMatch.product.name}</RowTitle>
        {pendingMatch.product.brand ? <Caption muted>{pendingMatch.product.brand}</Caption> : null}
      </Card>
      <Card>
        <Caption muted>Suggested ingredient</Caption>
        <RowTitle>{suggested.displayName}</RowTitle>
        <Body muted>Matched with {Math.round(pendingMatch.confidence * 100)}% confidence. Your answer is remembered for this barcode.</Body>
      </Card>
      <CanonicalPickerSheet
        visible={pickerOpen}
        title="Which ingredient is it?"
        suggestedIds={[suggested.id]}
        onPick={(item) => {
          setPickerOpen(false);
          void save(item.id);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, marginBottom: space.lg, gap: space.xs },
  footer: { gap: space.sm },
  empty: { flex: 1, justifyContent: 'center', gap: space.md },
});
