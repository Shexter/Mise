import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Divider } from '@/components/Card';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { Body, Caption, RowTitle, ScreenTitle, SectionLabel } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import { deleteAllShops, deleteShop, listShops, renameShop } from '@/db/queries';
import {
  hasLocationPermission,
  requestLocationPermission,
} from '@/logic/location';
import { checkCurrentShop, forgetRecognisedShop, type ShopCheck } from '@/logic/shopService';
import type { Shop } from '@/types';

/** The one sentence shown before the permission is ever requested (task 1.1). */
const PERMISSION_EXPLANATION =
  "Mise uses your location, only while the app is open, to recognise shops you've bought from before and show what you're low on when you check one.";

const CHECK_MESSAGE: Record<Exclude<ShopCheck['status'], 'needed'>, string> = {
  no_permission: 'Location is off, so there is nothing to check against.',
  no_position: 'Could not read a position just now. Nothing was changed.',
  unknown_shop: 'No shop you have imported a receipt from is nearby.',
  nothing_needed: 'Nothing is running low or out. Enjoy the trip.',
};

/**
 * Shops the app has learned, and the manual check.
 *
 * Everything here is a read or an edit the user asked for. Checking a shop
 * answers a question and changes nothing — no pantry item, no receipt, no
 * stock change — and no check is recorded anywhere.
 */
export default function ShopsScreen() {
  const toast = useToast();
  const [shops, setShops] = useState<Shop[]>([]);
  const [granted, setGranted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ShopCheck | null>(null);
  const [editing, setEditing] = useState<Shop | null>(null);
  const [editName, setEditName] = useState('');
  const [clearing, setClearing] = useState(false);

  const refresh = useCallback(async () => {
    setShops(await listShops());
    setGranted(await hasLocationPermission());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onEnable = async () => {
    const allowed = await requestLocationPermission();
    setGranted(allowed);
    if (!allowed) {
      // Declining is not punished and not re-asked: the OS remembers, and so
      // does this screen, which simply goes back to showing the explanation.
      toast.show({ message: 'Left off. Everything else works as before.' });
    }
  };

  const onCheck = async () => {
    setChecking(true);
    try {
      const outcome = await checkCurrentShop();
      setResult(outcome);
      if (outcome.status !== 'needed') {
        toast.show({ message: CHECK_MESSAGE[outcome.status] });
      }
      if (outcome.status === 'no_permission') setGranted(false);
    } finally {
      setChecking(false);
    }
  };

  const onRename = () => {
    const target = editing;
    const name = editName.trim();
    setEditing(null);
    if (!target || name.length === 0 || name === target.name) return;
    void renameShop(target.id, name).then(refresh);
  };

  const onRemove = (shop: Shop) => {
    void deleteShop(shop.id).then(async () => {
      forgetRecognisedShop();
      setResult(null);
      await refresh();
      toast.show({ message: `${shop.name} forgotten.` });
    });
  };

  const onClearAll = () => {
    setClearing(false);
    void deleteAllShops().then(async () => {
      forgetRecognisedShop();
      setResult(null);
      await refresh();
      toast.show({ message: 'Every shop position forgotten.' });
    });
  };

  return (
    <Screen scroll>
      <View style={styles.sections}>
        <ScreenTitle>Shops</ScreenTitle>
        <Caption muted>
          Mise stores where a shop is, learned from receipts you import there.
          It never stores when you were anywhere.
        </Caption>

        {granted ? (
          <View style={styles.block}>
            <Button
              label={checking ? 'Checking…' : 'Check this shop'}
              onPress={() => void onCheck()}
              disabled={checking}
            />
            {result?.status === 'needed' ? (
              <Card title={`Low or out at ${result.shop.name}`} padded={false}>
                {result.items.map((item, index) => (
                  <View key={item.canonicalId}>
                    {index > 0 ? <Divider /> : null}
                    <View style={styles.needRow}>
                      <RowTitle>{item.displayName}</RowTitle>
                      <Caption muted>
                        {item.status === 'out' ? 'Out' : 'Running low'}
                      </Caption>
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}
          </View>
        ) : (
          <View style={styles.block}>
            <Body>{PERMISSION_EXPLANATION}</Body>
            <Button label="Turn on location" onPress={() => void onEnable()} />
          </View>
        )}

        {shops.length === 0 ? (
          <Caption muted>
            No shops yet. Import a receipt at one and it will be remembered.
          </Caption>
        ) : (
          <Card padded={false}>
            {shops.map((shop, index) => (
              <View key={shop.id}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.row}>
                  <Pressable
                    onPress={() => {
                      setEditing(shop);
                      setEditName(shop.name);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Rename ${shop.name}`}
                    style={({ pressed }) => [
                      styles.rowMain,
                      pressed && { opacity: opacity.pressed },
                    ]}
                  >
                    <RowTitle>{shop.name}</RowTitle>
                    <Caption muted>{shop.storeName}</Caption>
                  </Pressable>
                  <Pressable
                    onPress={() => onRemove(shop)}
                    accessibilityRole="button"
                    accessibilityLabel={`Forget ${shop.name}`}
                    hitSlop={space.sm}
                    style={({ pressed }) => [
                      styles.removeButton,
                      pressed && { opacity: opacity.pressed },
                    ]}
                  >
                    <Feather name="x" size={18} color={color.muted} />
                  </Pressable>
                </View>
              </View>
            ))}
          </Card>
        )}

        {shops.length > 0 ? (
          <View style={styles.block}>
            <SectionLabel muted>Withdrawing</SectionLabel>
            <Caption muted>
              Forgetting every shop position leaves your pantry, receipts, and
              everything else exactly as they are.
            </Caption>
            <Button
              label="Forget all shop positions"
              variant="destructive"
              onPress={() => setClearing(true)}
            />
          </View>
        ) : null}
      </View>

      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title="Rename"
        footer={<Button label="Save" onPress={onRename} />}
      >
        <Field value={editName} onChangeText={setEditName} autoFocus />
      </Sheet>

      <Sheet
        visible={clearing}
        onClose={() => setClearing(false)}
        title="Forget all shop positions?"
        footer={
          <Button
            label="Forget them"
            variant="destructive"
            onPress={onClearAll}
          />
        }
      >
        <Caption muted>
          Only the stored shop positions are removed. Nothing else is touched.
        </Caption>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { marginTop: space.base, gap: space.lg },
  block: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: space.md,
  },
  rowMain: {
    flex: 1,
    minHeight: layout.minRowHeight,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: space.md,
    justifyContent: 'center',
    gap: space.xs,
  },
  removeButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needRow: {
    minHeight: layout.minRowHeight,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: space.md,
    justifyContent: 'center',
    gap: space.xs,
  },
});
