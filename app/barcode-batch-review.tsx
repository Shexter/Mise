import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { BarcodeProductEditor } from '@/components/barcode/BarcodeProductEditor';
import { Screen } from '@/components/Screen';
import { Body, Caption, RowTitle, ScreenTitle } from '@/components/Type';
import { useToast } from '@/components/Toast';
import { color, opacity, space } from '@/constants/theme';
import { applyBarcodeSession, getAllCanonicals, getLocations, upsertProduct } from '@/db/queries';
import { barcodePantryItems } from '@/logic/barcode';
import { localDateString } from '@/logic/dates';
import { useBarcodeCaptureStore } from '@/store/barcodeCaptureStore';
import type { CanonicalItem, Location } from '@/types';

/** Deferred review for a rapid barcode session; nothing is pantry stock yet. */
export default function BarcodeBatchReviewScreen() {
  const router = useRouter();
  const toast = useToast();
  const { session, updateSessionProduct, removeSessionProduct, clearSession } = useBarcodeCaptureStore();
  const [canonicals, setCanonicals] = useState<CanonicalItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([getAllCanonicals(), getLocations()]).then(([items, places]) => {
      setCanonicals(items);
      setLocations(places);
    });
  }, []);

  const canonicalById = useMemo(() => new Map(canonicals.map((item) => [item.id, item])), [canonicals]);

  const accept = async () => {
    if (saving || session.length === 0) return;
    const lines = session.map((item) => {
      const canonical = canonicalById.get(item.product.canonicalId);
      const location = canonical ? defaultLocation(canonical, locations) : null;
      return { item, canonical, location };
    });
    if (lines.some((line) => !line.canonical || !line.location)) {
      toast.show({ message: 'One scanned item no longer has a valid pantry location.' });
      return;
    }
    setSaving(true);
    try {
      const products = await Promise.all(lines.map(({ item }) => upsertProduct({
        gtin: item.product.gtin,
        name: item.product.name,
        brand: item.product.brand,
        pkgQty: item.product.pkgQty,
        pkgUnit: item.product.pkgUnit,
        containerCount: item.product.containerCount,
        canonicalId: item.product.canonicalId,
        kcalPer100: item.product.kcalPer100,
        proteinPer100: item.product.proteinPer100,
        carbsPer100: item.product.carbsPer100,
        fatPer100: item.product.fatPer100,
        source: 'barcode',
      })));
      await applyBarcodeSession(lines.flatMap(({ location }, index) =>
        barcodePantryItems(products[index]!, location!.id, localDateString()),
      ));
      const count = products.reduce((total, product) => total + (product.containerCount ?? 1), 0);
      clearSession();
      toast.show({ message: `Added ${count} item${count === 1 ? '' : 's'} to your pantry.` });
      router.dismissAll();
      router.replace('/(tabs)/pantry');
    } catch (error) {
      toast.show({ message: error instanceof Error ? error.message : 'Could not add these scanned items.' });
    } finally {
      setSaving(false);
    }
  };

  if (session.length === 0) {
    return <Screen><View style={styles.empty}><ScreenTitle>No barcode scans yet</ScreenTitle><Body muted>Scan several products, then review them together here.</Body><Button label="Scan products" onPress={() => router.replace({ pathname: '/pantry-capture', params: { barcodeMode: 'batch' } })} /></View></Screen>;
  }

  return (
    <Screen
      scroll
      footer={<View style={styles.footer}><Button label={`Add ${pantryItemCount(session)} item${pantryItemCount(session) === 1 ? '' : 's'}`} onPress={() => void accept()} loading={saving} /><Button label="Keep scanning" variant="secondary" onPress={() => router.replace({ pathname: '/pantry-capture', params: { barcodeMode: 'batch' } })} disabled={saving} /><Button label="Discard scans" variant="ghost" onPress={() => { clearSession(); router.back(); }} disabled={saving} /></View>}
    >
      <View style={styles.header}><ScreenTitle>Review scanned items</ScreenTitle><Caption muted>Nothing is added until you confirm.</Caption></View>
      <View style={styles.list}>
        {session.map((item) => (
          <Card key={item.id}>
            <View style={styles.itemHeader}>
              <RowTitle>{item.product.name}</RowTitle>
              <Pressable onPress={() => removeSessionProduct(item.id)} accessibilityRole="button" accessibilityLabel={`Remove ${item.product.name}`} style={({ pressed }) => [styles.remove, pressed && { opacity: opacity.pressed }]}><Caption style={styles.removeText}>Remove</Caption></Pressable>
            </View>
            <BarcodeProductEditor product={item.product} origin={item.origin} onChange={(correction) => updateSessionProduct(item.id, correction)} />
          </Card>
        ))}
      </View>
    </Screen>
  );
}

function pantryItemCount(session: readonly { product: { containerCount: number | null } }[]): number {
  return session.reduce((total, item) => total + (item.product.containerCount ?? 1), 0);
}

function defaultLocation(canonical: CanonicalItem, locations: readonly Location[]): Location | null {
  return locations.find((location) => location.id === canonical.defaultLocation)
    ?? locations.find((location) => location.kind === (canonical.defaultLocation === 'pantry' ? 'ambient' : canonical.defaultLocation))
    ?? locations[0]
    ?? null;
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, gap: space.xs },
  list: { marginTop: space.lg, gap: space.base },
  footer: { gap: space.sm },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  remove: { minHeight: 36, justifyContent: 'center' },
  removeText: { color: color.paprika },
  empty: { flex: 1, justifyContent: 'center', gap: space.md },
});
