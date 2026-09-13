import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { PlanGrocerySection } from '@/components/planner/PlanGrocerySection';
import { ShoppingListSection } from '@/components/pantry/ShoppingListSection';
import { Screen } from '@/components/Screen';
import { Body, Caption, ScreenTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { listReceipts } from '@/db/queries';
import { pendingReceipts, retryAllPending } from '@/logic/receiptService';
import { useMealScheduleStore } from '@/store/mealScheduleStore';

/** Grocery planning and receipt tools, kept together as one purchase loop. */
export default function ShopScreen() {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const [receiptCount, setReceiptCount] = useState(0);

  const refreshReceiptState = useCallback(async () => {
    const [pending, receipts] = await Promise.all([
      pendingReceipts(),
      listReceipts(),
    ]);
    setPendingCount(pending.length);
    setReceiptCount(receipts.length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await useMealScheduleStore.getState().load();
        await retryAllPending();
        await refreshReceiptState();
      })();
    }, [refreshReceiptState]),
  );

  const retryNow = async () => {
    await retryAllPending();
    await refreshReceiptState();
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <ScreenTitle>Shop</ScreenTitle>
        <Pressable
          onPress={() => router.push('/shops')}
          accessibilityRole="button"
          accessibilityLabel="Check nearby shops"
          hitSlop={space.sm}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && { opacity: opacity.pressed },
          ]}
        >
          <Feather name="map-pin" size={20} color={color.ink} />
        </Pressable>
      </View>

      <View style={styles.receiptActions}>
        <Button
          label="Scan a receipt"
          detail="Add a grocery purchase"
          onPress={() => router.push('/receipt-capture')}
        />
        <Pressable
          onPress={() => router.push('/receipt-history')}
          accessibilityRole="button"
          accessibilityLabel="Open receipt history"
          accessibilityHint="Review original photos and extracted lines"
          style={({ pressed }) => [
            styles.receiptLink,
            pressed && { opacity: opacity.pressed },
          ]}
        >
          <View style={styles.receiptCopy}>
            <Body>Receipt history</Body>
            <Caption muted>
              {receiptCount
                ? `${receiptCount} saved receipt${receiptCount === 1 ? '' : 's'}`
                : 'No saved receipts yet'}
            </Caption>
          </View>
          <Feather name="chevron-right" size={18} color={color.muted} />
        </Pressable>
      </View>

      {pendingCount > 0 ? (
        <Pressable
          onPress={() => void retryNow()}
          accessibilityRole="button"
          accessibilityLabel={`${pendingCount} receipt${pendingCount > 1 ? 's' : ''} waiting to import. Tap to retry.`}
          style={({ pressed }) => [
            styles.banner,
            pressed && { opacity: opacity.pressed },
          ]}
        >
          <Body>
            {pendingCount} receipt{pendingCount > 1 ? 's' : ''} waiting to import
          </Body>
          <Caption muted>No key or connection yet — tap to try again.</Caption>
        </Pressable>
      ) : null}

      <PlanGrocerySection />

      <ShoppingListSection />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: space.base,
    marginBottom: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptActions: { gap: space.sm, marginBottom: space.lg },
  receiptLink: {
    minHeight: layout.minRowHeight,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    padding: layout.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.base,
  },
  receiptCopy: { flex: 1, gap: space.xs },
  banner: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    padding: layout.cardPadding,
    gap: space.xs,
    marginBottom: space.lg,
  },
});
