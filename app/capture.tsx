import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApiKey } from '@/api/keyStore';
import { Button } from '@/components/Button';
import { Body, Caption, ScreenTitle } from '@/components/Type';
import {
  camera,
  color,
  fillParent,
  layout,
  opacity,
  radius,
  space,
} from '@/constants/theme';
import { preparePhoto, type SourceImage } from '@/media/photos';
import { useCaptureStore } from '@/store/captureStore';

type FlashMode = 'off' | 'on' | 'auto';

export default function CaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<FlashMode>('off');
  const [busy, setBusy] = useState(false);
  const [preparationError, setPreparationError] = useState<string | null>(null);

  const setCapture = useCaptureStore((state) => state.set);

  const proceed = async (source: SourceImage) => {
    setBusy(true);
    setPreparationError(null);
    try {
      const prepared = await preparePhoto(source);
      const hasKey = (await getApiKey()) !== null;
      setCapture({
        photoUri: prepared.uri,
        base64: prepared.base64,
        estimate: null,
      });
      // No key means straight to manual entry with the photo attached; the review
      // screen has nothing to estimate.
      router.replace(hasKey ? '/review' : '/manual');
    } catch {
      setPreparationError('Mise could not prepare that photo. Try another photo or enter the meal by hand.');
    } finally {
      setBusy(false);
    }
  };

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
            Photographs of meals never leave your phone except in the estimate
            request you make with your own key.
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
        <IconButton icon="x" label="Cancel" onPress={() => router.back()} disabled={busy} />
        <IconButton
          icon={flash === 'off' ? 'zap-off' : 'zap'}
          label="Toggle flash"
          onPress={() =>
            setFlash((current) => (current === 'off' ? 'auto' : current === 'auto' ? 'on' : 'off'))
          }
          disabled={busy}
        />
      </View>

      {busy ? (
        <View style={styles.busy} accessibilityLiveRegion="polite">
          <ActivityIndicator color={color.surface} size="large" />
          <Caption style={styles.busyText} accessibilityRole="alert">Preparing your photo…</Caption>
        </View>
      ) : null}

      {preparationError ? (
        <View style={styles.recovery}>
          <ScreenTitle style={styles.permissionText}>Photo not ready</ScreenTitle>
          <Body muted style={styles.permissionText} accessibilityRole="alert">
            {preparationError}
          </Body>
          <Button label="Try another photo" onPress={() => setPreparationError(null)} />
          <Button label="Enter by hand" variant="secondary" onPress={() => router.replace('/manual')} />
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
      ) : null}

      {!preparationError ? <View style={[styles.bottomBar, { paddingBottom: insets.bottom + space.lg }]}>
        <IconButton
          icon="image"
          label="Photo library"
          onPress={() => void pickFromLibrary()}
          large
          disabled={busy}
        />
        <Pressable
          onPress={() => void takePhoto()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          accessibilityState={{ disabled: busy, busy }}
          style={({ pressed }) => [
            styles.shutter,
            pressed && { opacity: opacity.pressed },
          ]}
        >
          <View style={styles.shutterInner} />
        </Pressable>
        {/* Spacer keeps the shutter centred against the library button. */}
        <View style={styles.spacer} />
      </View> : null}
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  large = false,
  disabled,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  large?: boolean;
  disabled?: boolean;
}) {
  const inactive = disabled ?? false;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      style={({ pressed }) => [
        styles.iconButton,
        large && styles.iconButtonLarge,
        pressed && !inactive && { opacity: opacity.pressed },
        inactive && { opacity: opacity.disabled },
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
  busyText: { color: color.surface },
  recovery: {
    ...fillParent,
    justifyContent: 'center',
    paddingHorizontal: layout.screenGutter,
    backgroundColor: camera.overlayScrim,
    gap: space.md,
  },
});
