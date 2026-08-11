import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { CanonicalPickerSheet } from '@/components/match/CanonicalPickerSheet';
import { Screen } from '@/components/Screen';
import { Body, Caption, RowTitle, SectionLabel, ScreenTitle } from '@/components/Type';
import { useToast } from '@/components/Toast';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { identifyBarcode } from '@/logic/barcode';
import { useBarcodeCaptureStore } from '@/store/barcodeCaptureStore';
import type { CanonicalItem } from '@/types';

/** Recovery for missing, store-local, and offline barcode scans. */
export default function BarcodeFallbackScreen() {
  const router = useRouter();
  const toast = useToast();
  const { gtin, barcodeMode, name: suppliedName, reason } = useLocalSearchParams<{
    gtin: string;
    barcodeMode?: string;
    name?: string;
    reason?: string;
  }>();
  const [name, setName] = useState(suppliedName ?? '');
  const [brand, setBrand] = useState('');
  const [canonical, setCanonical] = useState<CanonicalItem | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const addSessionProduct = useBarcodeCaptureStore((state) => state.addSessionProduct);
  const isBatch = barcodeMode === 'batch';

  const save = async () => {
    if (!gtin || !canonical || !name.trim() || saving) return;
    setSaving(true);
    try {
      const product = await identifyBarcode(gtin, name.trim(), canonical.id, brand.trim() || null);
      if (isBatch) {
        addSessionProduct(product);
        router.replace({ pathname: '/pantry-capture', params: { barcodeMode: 'batch' } });
      } else {
        router.replace({ pathname: '/barcode-review', params: { gtin: product.gtin ?? gtin } });
      }
    } catch (error) {
      toast.show({ message: error instanceof Error ? error.message : 'Could not save this barcode identification.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      scroll
      footer={<View style={styles.footer}><Button label="Use this identification" onPress={() => void save()} disabled={!canonical || !name.trim()} loading={saving} /><Button label="Photograph it instead" variant="secondary" onPress={() => router.replace('/pantry-capture')} disabled={saving} /><Button label="Cancel" variant="ghost" onPress={() => router.back()} disabled={saving} /></View>}
    >
      <View style={styles.header}>
        <ScreenTitle>{titleFor(reason)}</ScreenTitle>
        <Body muted>{detailFor(reason)}</Body>
      </View>
      <Card>
        <Caption muted>Barcode</Caption>
        <RowTitle>{gtin || 'Not available'}</RowTitle>
        <Caption muted>Your identification stays on this device and makes the next scan work without a lookup.</Caption>
      </Card>
      <View style={styles.form}>
        <Field label="Product name" value={name} onChangeText={setName} placeholder="e.g. Coconut milk" autoFocus />
        <Field label="Brand (optional)" value={brand} onChangeText={setBrand} placeholder="e.g. Aroy-D" />
        <View style={styles.section}>
          <SectionLabel muted>Ingredient</SectionLabel>
          <Pressable onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel={canonical ? canonical.displayName : 'Pick an ingredient'} style={({ pressed }) => [styles.picker, pressed && { opacity: opacity.pressed }]}>
            {canonical ? <RowTitle>{canonical.displayName}</RowTitle> : <Body muted>Pick the ingredient this product contains</Body>}
          </Pressable>
        </View>
      </View>
      <CanonicalPickerSheet visible={picking} title="What ingredient is this?" onPick={(item) => { setCanonical(item); setPicking(false); }} onClose={() => setPicking(false)} />
    </Screen>
  );
}

function titleFor(reason: string | undefined): string {
  if (reason === 'offline') return 'Add it without a connection';
  if (reason === 'store_local') return 'Store barcode';
  return 'Barcode not found';
}

function detailFor(reason: string | undefined): string {
  if (reason === 'offline') return 'The product is not cached yet. Identify it yourself or photograph it instead.';
  if (reason === 'store_local') return 'This label is specific to one shop, so Mise will not look it up online.';
  return 'Identify the product yourself or photograph it instead.';
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, marginBottom: space.lg, gap: space.xs },
  form: { marginTop: space.lg, gap: space.base },
  section: { gap: space.sm },
  picker: { minHeight: layout.minTouchTarget, borderRadius: radius.input, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, paddingHorizontal: space.base, justifyContent: 'center' },
  footer: { gap: space.sm },
});
