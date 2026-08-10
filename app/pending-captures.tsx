import { useCallback, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { Body, Caption, RowTitle, ScreenTitle } from '@/components/Type';
import { color, radius, space } from '@/constants/theme';
import { listPendingCaptures, removePendingCapture } from '@/db/queries';
import { retryPendingCapture } from '@/logic/pendingCaptureService';
import { deletePhoto } from '@/media/photos';
import { usePantryCaptureStore } from '@/store/pantryCaptureStore';
import type { PendingCapture } from '@/types';

/**
 * Durable captures that could not reach the vision provider. The screen does
 * not retry invisibly: successful interpretation must hand the result to a
 * review screen before any pantry change is possible.
 */
export default function PendingCapturesScreen() {
  const router = useRouter();
  const toast = useToast();
  const [captures, setCaptures] = useState<PendingCapture[]>([]);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const setReview = usePantryCaptureStore((state) => state.set);

  const refresh = useCallback(() => {
    void listPendingCaptures().then(setCaptures);
  }, []);
  useFocusEffect(refresh);

  const discard = async (id: string) => {
    setDiscarding(id);
    try {
      const imageUri = await removePendingCapture(id);
      deletePhoto(imageUri);
      refresh();
    } finally {
      setDiscarding(null);
    }
  };

  const retry = async (id: string) => {
    setRetrying(id);
    try {
      const result = await retryPendingCapture(id);
      if (!result) return;
      if (result.kind === 'items') {
        setReview(result.capture.imageUri, result.capture.createdAt.slice(0, 10), result.proposals);
        router.replace('/pantry-capture-review');
        await removePendingCapture(result.capture.id);
        return;
      }
      if (result.kind === 'receipt') {
        router.replace({ pathname: '/receipt-review', params: { receiptId: result.receipt.id } });
        await removePendingCapture(result.capture.id);
        return;
      }
      if (result.kind === 'waiting_for_key') {
        toast.show({ message: 'This capture needs an API key before it can be read.' });
      } else if (result.kind === 'failed') {
        toast.show({ message: 'This capture could not be read after several attempts.' });
      } else if (result.kind === 'unusable') {
        toast.show({ message: result.errorKind === 'nothing' ? 'No usable food or receipt was found.' : 'Mise could not tell what this photo contains.' });
      } else {
        toast.show({ message: 'This capture is still waiting for a connection.' });
      }
      refresh();
    } finally {
      setRetrying(null);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <ScreenTitle>Saved captures</ScreenTitle>
        <Caption muted>
          {captures.length === 0
            ? 'Nothing is waiting to be read.'
            : `${captures.length} photo${captures.length === 1 ? '' : 's'} will be ready to review when a key and connection are available.`}
        </Caption>
      </View>
      <View style={styles.list}>
        {captures.map((capture) => (
          <Card key={capture.id}>
            <View style={styles.row}>
              <Image source={{ uri: capture.imageUri }} style={styles.thumbnail} />
              <View style={styles.copy}>
                <RowTitle>{capture.status === 'failed' ? 'Could not read capture' : 'Waiting to be read'}</RowTitle>
                <Caption muted>
                  {capture.status === 'failed'
                    ? 'Try a new photo or add the item manually.'
                    : capture.retryCount > 0
                    ? `${capture.retryCount} attempt${capture.retryCount === 1 ? '' : 's'} so far`
                    : 'No retry attempted yet'}
                </Caption>
              </View>
            </View>
            {capture.status === 'pending' ? (
              <Button
                label="Read and review"
                onPress={() => void retry(capture.id)}
                loading={retrying === capture.id}
                disabled={retrying !== null || discarding !== null}
              />
            ) : null}
            <Button
              label="Discard photo"
              variant="ghost"
              onPress={() => void discard(capture.id)}
              loading={discarding === capture.id}
              disabled={discarding !== null || retrying !== null}
            />
          </Card>
        ))}
      </View>
      <Body muted>Need an item now? You can add it manually from Pantry.</Body>
      <Button label="Back to pantry" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs, marginBottom: space.lg },
  list: { gap: space.md, marginBottom: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumbnail: { width: 72, height: 72, borderRadius: radius.card, backgroundColor: color.ground },
  copy: { flex: 1, gap: space.xs },
});
