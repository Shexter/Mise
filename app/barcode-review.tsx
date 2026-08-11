import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Caption, RowTitle, ScreenTitle } from '@/components/Type';
import { space } from '@/constants/theme';
import { applyBarcodeSession, getCanonicalById, getLocations, getProductByBarcode } from '@/db/queries';
import { barcodePantryItems } from '@/logic/barcode';
import { localDateString } from '@/logic/dates';
import { predictExpiry } from '@/logic/expiry';
import type { CanonicalItem, Location, Product } from '@/types';

/** Confirms a resolved barcode before it can create a pantry row. */
export default function BarcodeReviewScreen() {
  const router = useRouter();
  const { gtin } = useLocalSearchParams<{ gtin: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [canonical, setCanonical] = useState<CanonicalItem | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!gtin) return;
    void (async () => {
      const found = await getProductByBarcode(gtin);
      if (!found) return;
      const [ingredient, locations] = await Promise.all([
        getCanonicalById(found.canonicalId),
        getLocations(),
      ]);
      if (!ingredient) return;
      setProduct(found);
      setCanonical(ingredient);
      setLocation(
        locations.find((candidate) => candidate.id === ingredient.defaultLocation) ??
          locations.find((candidate) => candidate.kind === (ingredient.defaultLocation === 'pantry' ? 'ambient' : ingredient.defaultLocation)) ??
          locations[0] ??
          null,
      );
    })();
  }, [gtin]);

  const accept = async () => {
    if (!product || !canonical || !location || saving) return;
    setSaving(true);
    try {
      await applyBarcodeSession(barcodePantryItems(product, location.id, localDateString()));
      router.dismissAll();
      router.replace('/(tabs)/pantry');
    } finally { setSaving(false); }
  };

  if (!product || !canonical || !location) {
    return <Screen><View style={styles.loading}><Caption muted>Loading barcode…</Caption></View></Screen>;
  }

  const expiry = predictExpiry(canonical, location.kind, localDateString(), null);
  const itemCount = product.containerCount ?? 1;
  return <Screen scroll footer={<Button label={`Add ${itemCount} to pantry`} onPress={() => void accept()} loading={saving} />}>
    <View style={styles.header}>
      <ScreenTitle>Review barcode item</ScreenTitle>
      <Caption muted>Nothing is added until you confirm.</Caption>
    </View>
    <Card>
      <RowTitle>{product.name}</RowTitle>
      {product.brand ? <Caption muted>{product.brand}</Caption> : null}
      <Caption muted>{itemCount === 1 ? 'One pantry item' : `${itemCount} individual pantry items`}</Caption>
      <Caption muted>{location.name}</Caption>
      <Caption muted>{expiry ? `Expected quality through ${expiry} (estimate).` : 'No expiry estimate is available.'}</Caption>
    </Card>
    <Body muted>Wrong item? Discard this review and add it by hand.</Body>
    <Button label="Discard" variant="ghost" onPress={() => router.back()} disabled={saving} />
  </Screen>;
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, marginBottom: space.lg, gap: space.xs },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
