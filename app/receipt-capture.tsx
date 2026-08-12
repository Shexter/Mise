import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ProcessingIndicator } from '@/components/ProcessingIndicator';
import { useToast } from '@/components/Toast';
import { Body, ScreenTitle } from '@/components/Type';
import {
  camera,
  color,
  fillParent,
  layout,
  opacity,
  radius,
  space,
} from '@/constants/theme';
import { localDateString } from '@/logic/dates';
import { deletePhoto, preparePhoto, type SourceImage } from '@/media/photos';
import { addReceiptPhoto, retakeReceiptPhoto } from '@/logic/receiptService';

type FlashMode = 'off' | 'on' | 'auto';

/**
 * Adds or retakes a photo for a receipt that is already in review. First
 * receipt photos always enter through the shared Add to pantry capture; this
 * focused handler exists because multi-frame receipts need a way back from
 * review without starting a new capture classification.
 */
export default function ReceiptCaptureScreen() {
  const router = useRouter();
  const { receiptId, replaceFrameId } = useLocalSearchParams<{ receiptId?: string; replaceFrameId?: string }>();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const toast = useToast();

  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<FlashMode>('off');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!receiptId) router.replace('/pantry-capture');
  }, [receiptId, router]);

  const proceed = async (source: SourceImage) => {
    setBusy(true);
    let prepared: Awaited<ReturnType<typeof preparePhoto>> | null = null;
    try {
      prepared = await preparePhoto(source, 'receipts');
      if (!receiptId) return;
      const receipt = replaceFrameId
        ? await retakeReceiptPhoto(receiptId, replaceFrameId, prepared.base64, prepared.uri, localDateString())
        : await addReceiptPhoto(receiptId, prepared.base64, prepared.uri, localDateString());
      if (!receipt) return;

      router.replace({ pathname: '/receipt-review', params: { receiptId: receipt.id } });
    } catch (error) {
      if (prepared) deletePhoto(prepared.uri);
      toast.show({ message: error instanceof Error ? error.message : 'Could not save this receipt photo.' });
    } finally {
      setBusy(false);
    }
  };

  if (!receiptId) return <View style={styles.blank} />;

  const takePhoto = async () => {
    if (!cameraRef.current || busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
    if (photo) {
      await proceed({ uri: photo.uri, width: photo.width, height: photo.height });
    }
  };

  const pickFromLibrary = async () => {
    if (busy) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset) {
      await proceed({ uri: asset.uri, width: asset.width, height: asset.height });
    }
  };

  if (!permission) {
    return <View style={styles.blank} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.blank, { paddingTop: insets.top }]}>
        <View style={styles.permission}>
          <ScreenTitle style={styles.permissionText}>
            Mise needs the camera
          </ScreenTitle>
          <Body muted style={styles.permissionText}>
            The receipt photo is read once to extract lines, then kept on
            your phone so it can be re-read if extraction ever improves.
          </Body>
          <Button label="Allow camera" onPress={() => void requestPermission()} />
          <Button
            label="Pick from library instead"
            variant="secondary"
            onPress={() => void pickFromLibrary()}
          />
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} flash={flash} />

      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
        <IconButton icon="x" label="Cancel" onPress={() => router.back()} />
        <IconButton
          icon={flash === 'off' ? 'zap-off' : 'zap'}
          label="Toggle flash"
          onPress={() =>
            setFlash((current) => (current === 'off' ? 'auto' : current === 'auto' ? 'on' : 'off'))
          }
        />
      </View>

      {busy ? (
        <View style={styles.busy}>
          <ProcessingIndicator label="Reading your receipt…" onDark />
        </View>
      ) : null}

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + space.lg }]}>
        <IconButton
          icon="image"
          label="Photo library"
          onPress={() => void pickFromLibrary()}
          large
        />
        <Pressable
          onPress={() => void takePhoto()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          style={({ pressed }) => [
            styles.shutter,
            pressed && { opacity: opacity.pressed },
          ]}
        >
          <View style={styles.shutterInner} />
        </Pressable>
        <View style={styles.spacer} />
      </View>
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  large = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  large?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconButton,
        large && styles.iconButtonLarge,
        pressed && { opacity: opacity.pressed },
      ]}
    >
      <Feather name={icon} size={large ? 24 : 20} color={color.surface} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: camera.backdrop },
  blank: { flex: 1, backgroundColor: color.ink },
  permission: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenGutter,
    gap: space.md,
  },
  permissionText: { color: color.surface, textAlign: 'center' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: layout.screenGutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: layout.screenGutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.full,
    backgroundColor: camera.controlScrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonLarge: { width: 56, height: 56 },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    borderWidth: 4,
    borderColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: color.surface,
  },
  spacer: { width: 56 },
  busy: {
    ...fillParent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: camera.overlayScrim,
    gap: space.md,
  },
});
