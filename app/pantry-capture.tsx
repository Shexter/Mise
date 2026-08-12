import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Network from 'expo-network';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { extractCapture } from '@/api/capture';
import { VisionError } from '@/api/errors';
import { Button } from '@/components/Button';
import { ProcessingIndicator } from '@/components/ProcessingIndicator';
import { Body, Caption, ScreenTitle } from '@/components/Type';
import { useToast } from '@/components/Toast';
import { camera, color, fillParent, layout, opacity, radius, space } from '@/constants/theme';
import { insertPendingCapture, PendingCaptureLimitError } from '@/db/queries';
import { resolveCapturedItems } from '@/logic/captureItems';
import { isBarcodeScanDebounced, resolveBarcode } from '@/logic/barcode';
import { localDateString } from '@/logic/dates';
import { captureExtractedReceipt, captureReceipt, needsExtraction } from '@/logic/receiptService';
import { deletePhoto, preparePhoto, type SourceImage } from '@/media/photos';
import { useBarcodeCaptureStore } from '@/store/barcodeCaptureStore';
import { usePantryCaptureStore } from '@/store/pantryCaptureStore';

/** One shared capture surface; batch mode only changes what happens after a barcode resolves. */
export default function PantryCaptureScreen() {
  const router = useRouter();
  const { barcodeMode } = useLocalSearchParams<{ barcodeMode?: string }>();
  const isBatch = barcodeMode === 'batch';
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const recentScans = useRef(new Map<string, number>());
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [lastRead, setLastRead] = useState<string | null>(null);
  const setReview = usePantryCaptureStore((state) => state.set);
  const { session, addSessionProduct, clearSession, setPendingMatch } = useBarcodeCaptureStore();

  const showManualOrRetry = (title: string, detail: string) => {
    Alert.alert(title, detail, [
      { text: 'Add item by hand', onPress: () => router.replace('/(tabs)/pantry') },
      { text: 'Try another photo', style: 'cancel' },
    ]);
  };

  const reviewUnclearAsReceipt = async (
    photo: Awaited<ReturnType<typeof preparePhoto>>,
  ) => {
    setBusy(true);
    try {
      const receipt = await captureReceipt(
        photo.base64,
        photo.uri,
        localDateString(),
      );
      if (needsExtraction(receipt)) {
        toast.show({
          kind: ('pending' as const),
          message: "Receipt saved. It'll finish importing once you're online with a key set.",
        });
        router.back();
        return;
      }
      router.replace({ pathname: '/receipt-review', params: { receiptId: receipt.id } });
    } catch (error) {
      deletePhoto(photo.uri);
      toast.show({
        kind: 'recoverable-error',
        message: error instanceof Error ? error.message : 'Could not save this receipt photo.',
      });
    } finally {
      setBusy(false);
    }
  };

  const proceed = async (source: SourceImage) => {
    setBusy(true);
    let photo: Awaited<ReturnType<typeof preparePhoto>> | null = null;
    try {
      photo = await preparePhoto(source, 'pantry-captures');
      const capture = await extractCapture(photo.base64);
      if (capture.kind === 'items') {
        const purchasedAt = localDateString();
        setReview(photo.uri, purchasedAt, await resolveCapturedItems(capture.items, purchasedAt));
        router.replace('/pantry-capture-review');
        return;
      }
      if (capture.kind === 'receipt') {
        const receipt = await captureExtractedReceipt(capture.receipt, photo.uri, localDateString());
        router.replace({ pathname: '/receipt-review', params: { receiptId: receipt.id } });
        return;
      }
      if (capture.kind === 'nothing') {
        deletePhoto(photo.uri);
        showManualOrRetry(
          'No usable food or receipt',
          'Try another photo, or add the item by hand.',
        );
        return;
      }
      Alert.alert('What did you photograph?', 'Mise could not tell from this photo.', [
        {
          text: 'Groceries',
          onPress: () => {
            deletePhoto(photo!.uri);
            router.replace('/(tabs)/pantry');
          },
        },
        { text: 'Receipt', onPress: () => void reviewUnclearAsReceipt(photo!) },
        { text: 'Try another photo', style: 'cancel', onPress: () => deletePhoto(photo!.uri) },
      ]);
    } catch (error) {
      if (photo && error instanceof VisionError && ['no_key', 'network', 'timeout', 'server'].includes(error.kind)) {
        try {
          await insertPendingCapture(photo.uri);
          toast.show({
            kind: 'pending',
            message: error.kind === 'no_key'
              ? 'This capture needs an API key. It was saved for later.'
              : 'This capture was saved and will be retried when you are online.',
          });
        } catch (queueError) {
          showManualOrRetry(
            queueError instanceof PendingCaptureLimitError ? 'Saved captures are full' : 'Photo not saved',
            queueError instanceof PendingCaptureLimitError
              ? 'Add this item by hand or discard a saved photo before trying again.'
              : 'Mise could not save that photo. Add an item by hand or try again.',
          );
        }
      } else {
        if (photo) deletePhoto(photo.uri);
        showManualOrRetry(
          'Photo not read',
          'Mise could not read that photo. Add an item by hand or try again.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const scanBarcode = async ({ data }: BarcodeScanningResult) => {
    const gtin = data.replace(/\s/g, '');
    const now = Date.now();
    if (busy || !gtin || isBarcodeScanDebounced(recentScans.current.get(gtin), now)) return;
    recentScans.current.set(gtin, now);
    setBusy(true);
    try {
      const result = await resolveBarcode(gtin, undefined, async () => {
        const network = await Network.getNetworkStateAsync();
        return network.isConnected !== false && network.isInternetReachable !== false;
      });
      if (result.kind === 'product' && result.product.gtin) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (isBatch) {
          addSessionProduct(result.product, result.cached ? 'local' : 'open-food-facts');
          setLastRead(result.product.name);
        } else {
          router.replace({ pathname: '/barcode-review', params: { gtin: result.product.gtin, origin: result.cached ? 'local' : 'open-food-facts' } });
        }
      } else if (result.kind === 'needs_confirmation' && result.match.status === 'needs_confirmation') {
        setPendingMatch({
          product: result.product,
          canonicalId: result.match.canonicalId,
          confidence: result.match.confidence,
          returnToBatch: isBatch,
        });
        router.replace('/barcode-match');
      } else if (result.kind === 'missing' || result.kind === 'store_local') {
        router.replace({ pathname: '/barcode-fallback', params: { gtin, barcodeMode: isBatch ? 'batch' : '', reason: result.kind } });
      } else if (result.kind === 'unresolved') {
        router.replace({ pathname: '/barcode-fallback', params: { gtin, barcodeMode: isBatch ? 'batch' : '', name: result.product.name, reason: 'unresolved' } });
      } else if (result.kind === 'unread') {
        toast.show({ kind: 'recoverable-error', message: 'That barcode did not read clearly. Try again.' });
      }
    } catch {
      router.replace({ pathname: '/barcode-fallback', params: { gtin, barcodeMode: isBatch ? 'batch' : '', reason: 'offline' } });
    } finally {
      setBusy(false);
    }
  };

  const take = async () => {
    const image = await cameraRef.current?.takePictureAsync({ quality: 1 });
    if (image) await proceed({ uri: image.uri, width: image.width, height: image.height });
  };

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const image = result.assets?.[0];
    if (!result.canceled && image) await proceed({ uri: image.uri, width: image.width, height: image.height });
  };

  const leaveBatch = () => {
    clearSession();
    router.back();
  };

  if (!permission) return <View style={styles.blank} />;
  if (!permission.granted) {
    return <View style={[styles.blank, styles.permission, { paddingTop: insets.top }]}><ScreenTitle style={styles.light}>Add to pantry</ScreenTitle><Body style={styles.light}>Take one photo of groceries, a barcode, or a receipt. Mise chooses the route.</Body><Button label="Allow camera" onPress={() => void requestPermission()} /><Button label="Pick from library" variant="secondary" onPress={() => void pick()} /><Button label="Cancel" variant="ghost" onPress={() => router.back()} /></View>;
  }

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }} onBarcodeScanned={scanBarcode} />
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        {isBatch ? <View style={styles.batchHeader}><Caption style={styles.light}>{session.length} scanned{lastRead ? ` · ${lastRead}` : ''}</Caption><Button label={`Review ${session.length}`} variant="secondary" block={false} disabled={busy || session.length === 0} onPress={() => router.replace('/barcode-batch-review')} /></View> : <View style={styles.captureLinks}><Button label="Recent" variant="secondary" block={false} disabled={busy} onPress={() => router.push('/barcode-history')} /><Button label="Scan several" variant="secondary" block={false} disabled={busy} onPress={() => { clearSession(); router.replace({ pathname: '/pantry-capture', params: { barcodeMode: 'batch' } }); }} /></View>}
        <Button label="Cancel" variant="ghost" block={false} disabled={busy} onPress={isBatch ? leaveBatch : () => router.back()} />
      </View>
      {busy ? <View style={styles.busy}><ProcessingIndicator label="Reading your capture…" onDark /></View> : null}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
        <Button label="Library" variant="secondary" block={false} onPress={() => void pick()} disabled={busy} />
        <Pressable onPress={() => void take()} disabled={busy} accessibilityRole="button" accessibilityLabel="Take pantry photo" style={({ pressed }) => [styles.shutter, pressed && { opacity: opacity.pressed }]}><View style={styles.inner} /></Pressable>
        <Button label="Manual" variant="secondary" block={false} onPress={() => router.push('/(tabs)/pantry')} disabled={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: camera.backdrop },
  blank: { flex: 1, backgroundColor: color.ink },
  permission: { justifyContent: 'center', paddingHorizontal: layout.screenGutter, gap: space.md },
  light: { color: color.surface, textAlign: 'center' },
  top: { position: 'absolute', left: layout.screenGutter, right: layout.screenGutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  batchHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  captureLinks: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bottom: { position: 'absolute', bottom: 0, left: layout.screenGutter, right: layout.screenGutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shutter: { width: 76, height: 76, borderRadius: radius.full, borderWidth: 4, borderColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  inner: { width: 60, height: 60, borderRadius: radius.full, backgroundColor: color.surface },
  busy: { ...fillParent, alignItems: 'center', justifyContent: 'center', backgroundColor: camera.overlayScrim, gap: space.md },
});
