import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { Body, Caption, RowTitle, ScreenTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { friendlyDate } from '@/logic/dates';
import { listReceipts } from '@/db/queries';
import type { Receipt } from '@/types';

/** A durable index of captured receipts; opening one never re-applies stock. */
export default function ReceiptHistoryScreen() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  useFocusEffect(useCallback(() => {
    void listReceipts().then(setReceipts);
  }, []));

  return (
    <Screen scroll>
      <View style={styles.header}>
        <ScreenTitle>Receipt history</ScreenTitle>
        <Caption muted>Review original photos and extracted lines.</Caption>
      </View>
      {receipts.length === 0 ? (
        <EmptyState title="No saved receipts" detail="Scanned receipts will stay here after you review them." />
      ) : (
        <View style={styles.list}>
          {receipts.map((receipt) => (
            <Pressable
              key={receipt.id}
              onPress={() => router.push({ pathname: '/receipt-review', params: { receiptId: receipt.id, saved: '1' } })}
              accessibilityRole="button"
              accessibilityLabel={`Open ${receipt.store ?? 'receipt'} from ${friendlyDate(receipt.purchasedAt)}`}
              style={({ pressed }) => [pressed && { opacity: opacity.pressed }]}
            >
              <Card>
                <View style={styles.row}>
                  <View style={styles.copy}>
                    <RowTitle>{receipt.store ?? 'Receipt'}</RowTitle>
                    <Caption muted>{friendlyDate(receipt.purchasedAt)} · {receipt.type}</Caption>
                    <Caption muted>{statusLabel(receipt.status)}</Caption>
                  </View>
                  <Body muted>›</Body>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

function statusLabel(status: Receipt['status']): string {
  if (status === 'applied') return 'Saved to pantry';
  if (status === 'discarded') return 'Discarded';
  return 'Waiting for review';
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, gap: space.xs, marginBottom: space.lg },
  list: { gap: space.base },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.base },
  copy: { flex: 1, gap: space.xs },
});
