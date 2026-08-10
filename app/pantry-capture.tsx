import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { extractCapture } from '@/api/capture';
import { Button } from '@/components/Button';
import { Body, Caption, ScreenTitle } from '@/components/Type';
import { useToast } from '@/components/Toast';
import { camera, color, fillParent, layout, opacity, radius, space } from '@/constants/theme';
import { resolveCapturedItems } from '@/logic/captureItems';
import { localDateString } from '@/logic/dates';
import { preparePhoto, type SourceImage } from '@/media/photos';
import { usePantryCaptureStore } from '@/store/pantryCaptureStore';

export default function PantryCaptureScreen() {
  const router = useRouter(); const toast = useToast(); const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null); const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false); const setReview = usePantryCaptureStore((state) => state.set);
  const proceed = async (source: SourceImage) => { setBusy(true); try {
    const photo = await preparePhoto(source, 'pantry-captures'); const capture = await extractCapture(photo.base64);
    if (capture.kind === 'items') { const purchasedAt = localDateString(); setReview(photo.uri, purchasedAt, await resolveCapturedItems(capture.items, purchasedAt)); router.replace('/pantry-capture-review'); return; }
    toast.show({ message: capture.kind === 'nothing' ? 'No usable food or receipt was found.' : capture.kind === 'unclear' ? 'Mise could not tell what this is. Try another photo.' : 'Receipt capture is available from the receipt camera for now.' });
  } catch { toast.show({ message: 'Mise could not read that photo. Add an item by hand or try again.' }); } finally { setBusy(false); } };
  const take = async () => { const image = await cameraRef.current?.takePictureAsync({ quality: 1 }); if (image) await proceed({ uri: image.uri, width: image.width, height: image.height }); };
  const pick = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 }); const image = result.assets?.[0]; if (!result.canceled && image) await proceed({ uri: image.uri, width: image.width, height: image.height }); };
  if (!permission) return <View style={styles.blank} />;
  if (!permission.granted) return <View style={[styles.blank, styles.permission, { paddingTop: insets.top }]}><ScreenTitle style={styles.light}>Add to pantry</ScreenTitle><Body style={styles.light}>Take one photo of groceries, a barcode, or a receipt. Mise chooses the route.</Body><Button label="Allow camera" onPress={() => void requestPermission()} /><Button label="Pick from library" variant="secondary" onPress={() => void pick()} /><Button label="Cancel" variant="ghost" onPress={() => router.back()} /></View>;
  return <View style={styles.root}><CameraView ref={cameraRef} style={StyleSheet.absoluteFill} /><View style={[styles.top, { paddingTop: insets.top + space.sm }]}><Button label="Cancel" variant="ghost" block={false} onPress={() => router.back()} /></View>{busy && <View style={styles.busy}><ActivityIndicator color={color.surface} size="large" /><Caption style={styles.light}>Reading your capture…</Caption></View>}<View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}><Button label="Library" variant="secondary" block={false} onPress={() => void pick()} /><Pressable onPress={() => void take()} disabled={busy} accessibilityRole="button" accessibilityLabel="Take pantry photo" style={({ pressed }) => [styles.shutter, pressed && { opacity: opacity.pressed }]}><View style={styles.inner} /></Pressable><Button label="Manual" variant="secondary" block={false} onPress={() => router.push('/(tabs)/pantry')} /></View></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: camera.backdrop }, blank: { flex: 1, backgroundColor: color.ink }, permission: { justifyContent: 'center', paddingHorizontal: layout.screenGutter, gap: space.md }, light: { color: color.surface, textAlign: 'center' }, top: { position: 'absolute', left: layout.screenGutter }, bottom: { position: 'absolute', bottom: 0, left: layout.screenGutter, right: layout.screenGutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, shutter: { width: 76, height: 76, borderRadius: radius.full, borderWidth: 4, borderColor: color.surface, alignItems: 'center', justifyContent: 'center' }, inner: { width: 60, height: 60, borderRadius: radius.full, backgroundColor: color.surface }, busy: { ...fillParent, alignItems: 'center', justifyContent: 'center', backgroundColor: camera.overlayScrim, gap: space.md } });
