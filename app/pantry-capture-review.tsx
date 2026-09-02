import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { insertPantryItem } from '@/db/queries';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { StateIllustration } from '@/components/StateIllustration';
import { useToast } from '@/components/Toast';
import { ConfirmMatchSheet, type PendingConfirmation } from '@/components/match/ConfirmMatchSheet';
import { Screen } from '@/components/Screen';
import { Body, Caption, RowTitle, ScreenTitle } from '@/components/Type';
import { space } from '@/constants/theme';
import { resolveCapturedItems } from '@/logic/captureItems';
import { captureReceipt } from '@/logic/receiptService';
import { pantryItemsAddedMessage } from '@/logic/feedback';
import { deletePhoto, photoBase64 } from '@/media/photos';
import { usePantryCaptureStore } from '@/store/pantryCaptureStore';

/** Reviews groceries found in one camera frame before creating pantry rows. */
export default function PantryCaptureReviewScreen() {
  const router = useRouter();
  const toast = useToast();
  const { proposals, purchasedAt, clear } = usePantryCaptureStore();
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [switching, setSwitching] = useState(false);
  const finished = useRef(false);
  const accepted = proposals.filter((proposal) => proposal.canonical && proposal.location);
  const confirmationMatches: PendingConfirmation[] = proposals.flatMap((proposal) =>
    proposal.outcome.status === 'needs_confirmation' && proposal.canonical
      ? [{
          raw: proposal.outcome.raw,
          canonicalId: proposal.canonical.id,
          displayName: proposal.canonical.displayName,
          confidence: proposal.outcome.confidence,
          source: 'vision',
        }]
      : [],
  );

  useEffect(() => () => {
    if (!finished.current) {
      deletePhoto(usePantryCaptureStore.getState().photoUri);
      clear();
    }
  }, [clear]);

  const finish = () => {
    finished.current = true;
    clear();
    router.dismissAll();
    router.replace('/(tabs)/pantry');
  };
  const discard = () => {
    finished.current = true;
    deletePhoto(usePantryCaptureStore.getState().photoUri);
    finish();
  };
  /** Drops the unusable frame and returns to the camera for a better one. */
  const retake = () => {
    finished.current = true;
    deletePhoto(usePantryCaptureStore.getState().photoUri);
    clear();
    router.replace('/pantry-capture');
  };
  const switchToReceipt = async () => {
    const photoUri = usePantryCaptureStore.getState().photoUri;
    if (!photoUri || !purchasedAt || switching) return;
    setSwitching(true);
    try {
      const receipt = await captureReceipt(await photoBase64(photoUri), photoUri, purchasedAt);
      finished.current = true;
      clear();
      router.replace({ pathname: '/receipt-review', params: { receiptId: receipt.id } });
    } finally {
      setSwitching(false);
    }
  };
  const accept = async () => {
    if (!purchasedAt || saving) return;
    if (confirmationMatches.length > 0) {
      setConfirming(true);
      return;
    }
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({
        kind: 'success',
        message: pantryItemsAddedMessage(accepted.length),
      });
      finish();
    } finally {
      setSaving(false);
    }
  };

  const refreshAfterConfirmation = async () => {
    if (!purchasedAt) return;
    const photoUri = usePantryCaptureStore.getState().photoUri;
    if (!photoUri) return;
    usePantryCaptureStore.getState().set(
      photoUri,
      purchasedAt,
      await resolveCapturedItems(proposals.map((proposal) => proposal.captured), purchasedAt),
    );
  };

  return (
    <Screen scroll footer={<Button label={`Add ${accepted.length} item${accepted.length === 1 ? '' : 's'}`} onPress={() => void accept()} disabled={accepted.length === 0} loading={saving} />}>
      <View style={styles.header}>
        <ScreenTitle>Review pantry items</ScreenTitle>
        <Caption muted>Nothing is added until you confirm.</Caption>
      </View>
      {proposals.length === 0 ? (
        // The photo came back with nothing to review. That is a photo problem
        // and says so — unlike a provider or network failure, which this screen
        // is never reached for.
        <EmptyState
          title="Nothing recognisable in that photo"
          detail="Try again with the items spread out in good light, or add them by hand."
          illustration={
            <StateIllustration
              name="capture-needs-better-photo"
              accessibilityLabel="A camera with a soft focus ring, tilted slightly"
            />
          }
          actionLabel="Retake the photo"
          onAction={retake}
        />
      ) : null}
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
      <Button label="This is a receipt" variant="secondary" onPress={() => void switchToReceipt()} loading={switching} disabled={saving} />
      <Button label="Discard" variant="ghost" onPress={discard} />
      <ConfirmMatchSheet
        visible={confirming}
        matches={confirmationMatches}
        onClose={() => setConfirming(false)}
        onDone={() => void refreshAfterConfirmation()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, marginBottom: space.lg, gap: space.xs },
  list: { gap: space.md, marginBottom: space.lg },
});
