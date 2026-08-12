import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { extractBarcodeEvidence, type BarcodeEvidenceKind } from '@/api/barcodeRecovery';
import { BarcodeProductEditor } from '@/components/barcode/BarcodeProductEditor';
import { Button } from '@/components/Button';
import { CanonicalPickerSheet } from '@/components/match/CanonicalPickerSheet';
import { Screen } from '@/components/Screen';
import { Body, Caption, RowTitle, ScreenTitle, SectionLabel } from '@/components/Type';
import { useToast } from '@/components/Toast';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { confirmRecoveredBarcode } from '@/logic/barcode';
import { deletePhoto, preparePhoto } from '@/media/photos';
import { useBarcodeCaptureStore } from '@/store/barcodeCaptureStore';
import type { CanonicalItem, Product } from '@/types';

/** Guided evidence recovery keeps the GTIN only in memory until confirmation. */
export default function BarcodeRecoveryScreen() {
  const router = useRouter();
  const toast = useToast();
  const { gtin, barcodeMode } = useLocalSearchParams<{ gtin: string; barcodeMode?: string }>();
  const { recoveryDraft, startRecovery, updateRecovery, clearRecovery, addSessionProduct } = useBarcodeCaptureStore();
  const [canonical, setCanonical] = useState<CanonicalItem | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (gtin && recoveryDraft?.gtin !== gtin) startRecovery(gtin, barcodeMode === 'batch');
  }, [barcodeMode, gtin, recoveryDraft?.gtin, startRecovery]);

  if (!recoveryDraft) return <Screen><Body muted>Preparing recovery…</Body></Screen>;
  const draftProduct: Product = { id: 'recovery-draft', gtin: recoveryDraft.gtin, name: recoveryDraft.name ?? '', brand: recoveryDraft.brand, pkgQty: recoveryDraft.pkgQty, pkgUnit: recoveryDraft.pkgUnit, containerCount: recoveryDraft.containerCount, canonicalId: canonical?.id ?? '', kcalPer100: recoveryDraft.kcalPer100, proteinPer100: recoveryDraft.proteinPer100, carbsPer100: recoveryDraft.carbsPer100, fatPer100: recoveryDraft.fatPer100, source: 'user', fetchedAt: null, lastScannedAt: null };

  const photograph = async (kind: BarcodeEvidenceKind) => {
    const result = await ImagePicker.launchCameraAsync({ quality: 1, base64: false });
    const image = result.assets?.[0];
    if (result.canceled || !image) return;
    setBusy(true);
    let photo: Awaited<ReturnType<typeof preparePhoto>> | null = null;
    try {
      photo = await preparePhoto({ uri: image.uri, width: image.width, height: image.height }, 'pantry-captures');
      const evidence = await extractBarcodeEvidence(photo.base64, kind);
      updateRecovery(Object.fromEntries(Object.entries(evidence).filter(([, value]) => value !== null)));
      toast.show({ message: 'Visible package facts added to the draft. Review them before saving.' });
    } catch (error) {
      toast.show({ kind: 'recoverable-error', message: 'Package analysis is unavailable. You can still identify it manually below.' });
    } finally {
      if (photo) deletePhoto(photo.uri);
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!canonical || !draftProduct.name.trim() || busy) return;
    setBusy(true);
    try {
      const product = await confirmRecoveredBarcode({
        gtin: recoveryDraft.gtin, name: draftProduct.name.trim(), brand: draftProduct.brand,
        pkgQty: draftProduct.pkgQty, pkgUnit: draftProduct.pkgUnit,
        containerCount: draftProduct.containerCount, canonicalId: canonical.id,
        kcalPer100: draftProduct.kcalPer100, proteinPer100: draftProduct.proteinPer100,
        carbsPer100: draftProduct.carbsPer100, fatPer100: draftProduct.fatPer100,
      });
      const returnToBatch = recoveryDraft.returnToBatch;
      clearRecovery();
      if (returnToBatch) {
        addSessionProduct(product, 'user');
        router.replace({ pathname: '/pantry-capture', params: { barcodeMode: 'batch' } });
      } else {
        router.replace({ pathname: '/barcode-review', params: { gtin: product.gtin!, origin: 'user' } });
      }
    } catch (error) {
      toast.show({ message: error instanceof Error ? error.message : 'Could not save this identification.' });
    } finally { setBusy(false); }
  };

  return (
    <Screen scroll footer={<View style={styles.footer}><Button label="Review this product" onPress={() => void confirm()} disabled={!canonical || !draftProduct.name.trim()} loading={busy} /><Button label="Cancel" variant="ghost" onPress={() => { clearRecovery(); router.back(); }} disabled={busy} /></View>}>
      <View style={styles.header}><ScreenTitle>Identify this barcode</ScreenTitle><Body muted>The barcode stays in this draft while you collect evidence. It is saved only after you confirm the product.</Body></View>
      <Caption muted>Package photos are sent to your configured AI provider for analysis, then deleted from the recovery workspace. Manual entry remains available.</Caption>
      <View style={styles.photoButtons}><Button label="Photograph front" variant="secondary" onPress={() => void photograph('package-front')} disabled={busy} /><Button label="Photograph quantity" variant="secondary" onPress={() => void photograph('declared-quantity')} disabled={busy} /><Button label="Photograph nutrition" variant="secondary" onPress={() => void photograph('nutrition-label')} disabled={busy} /></View>
      <BarcodeProductEditor product={draftProduct} origin="user" onChange={updateRecovery} />
      <View style={styles.section}><SectionLabel muted>Ingredient</SectionLabel><Pressable onPress={() => setPicking(true)} accessibilityRole="button" style={({ pressed }) => [styles.picker, pressed && { opacity: opacity.pressed }]}>{canonical ? <RowTitle>{canonical.displayName}</RowTitle> : <Body muted>Confirm which pantry ingredient this is</Body>}</Pressable></View>
      <CanonicalPickerSheet visible={picking} title="What ingredient is this?" onPick={(item) => { setCanonical(item); setPicking(false); }} onClose={() => setPicking(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({ header: { marginTop: space.base, gap: space.xs }, photoButtons: { marginVertical: space.lg, gap: space.sm }, section: { marginTop: space.lg, gap: space.sm }, picker: { minHeight: layout.minTouchTarget, borderRadius: radius.input, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, paddingHorizontal: space.base, justifyContent: 'center' }, footer: { gap: space.sm } });
