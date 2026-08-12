import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Caption, RowTitle, ScreenTitle } from '@/components/Type';
import { useToast } from '@/components/Toast';
import { color, opacity, space } from '@/constants/theme';
import { clearRecentBarcodeHistory, listRecentScannedProducts } from '@/db/queries';
import type { Product } from '@/types';

/** Read-only local scan history. Opening a row never changes its recency. */
export default function BarcodeHistoryScreen() {
  const router = useRouter();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);

  useFocusEffect(useCallback(() => {
    void listRecentScannedProducts().then(setProducts);
  }, []));

  const clear = async () => {
    await clearRecentBarcodeHistory();
    setProducts([]);
    toast.show({ message: 'Recent barcode history cleared. Product details and pantry items were kept.' });
  };

  return (
    <Screen scroll footer={<Button label="Done" onPress={() => router.back()} />}>
      <View style={styles.header}>
        <ScreenTitle>Recent barcode scans</ScreenTitle>
        <Body muted>Stored only on this device. Reopening a result does not move it to the top.</Body>
      </View>
      {products.length === 0 ? <Card><RowTitle>No recent scans</RowTitle><Caption muted>Successful product scans will appear here.</Caption></Card> : (
        <View style={styles.list}>
          {products.map((product) => (
            <Pressable key={product.id} onPress={() => product.gtin && router.push({ pathname: '/barcode-review', params: { gtin: product.gtin, origin: product.source === 'user' ? 'user' : 'local' } })} accessibilityRole="button" style={({ pressed }) => [pressed && { opacity: opacity.pressed }]}>
              <Card>
                <RowTitle>{product.name}</RowTitle>
                <Caption muted>{product.brand ?? 'Brand not provided'}</Caption>
                <Caption muted>{product.lastScannedAt ? new Date(product.lastScannedAt).toLocaleString() : ''}</Caption>
              </Card>
            </Pressable>
          ))}
          <Button label="Clear recent scans" variant="ghost" onPress={() => void clear()} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, marginBottom: space.lg, gap: space.xs },
  list: { gap: space.base },
});
