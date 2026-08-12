import type { ExpoConfig } from 'expo/config';

/**
 * A build-time vision API key, read from `.env` (see `.env.example`).
 *
 * This exists so a developer running the project locally does not have to retype
 * their key on every fresh install. It is a convenience, not the storage mechanism:
 * anything in `extra` is compiled into the JS bundle and is readable by anyone who
 * has the build. The app treats it as a one-time seed — on first launch it is copied
 * into the device Keychain (`expo-secure-store`) and read from there afterwards.
 *
 * Leave it unset when you publish. Users add their own key in Settings.
 */
const devApiKey = process.env.MISE_DEV_API_KEY ?? null;

const config: ExpoConfig = {
  name: 'Mise',
  slug: 'mise',
  scheme: 'mise',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/brand/icon-concepts/dark-glass/mise-icon-dark-glass-navy-sage.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.mise.app',
    icon: {
      light: './assets/brand/icon-concepts/dark-glass/mise-icon-dark-glass-navy-sage.png',
      dark: './assets/brand/icon-concepts/dark-glass/mise-icon-dark-glass-monochrome.png',
    },
    infoPlist: {
      NSCameraUsageDescription:
        'Mise uses the camera to photograph your meals so it can estimate their calories.',
      NSPhotoLibraryUsageDescription:
        'Mise reads photos you pick so it can estimate the calories of a meal.',
    },
  },
  android: {
    package: 'com.mise.app',
    icon: './assets/brand/icon-concepts/light-organic/mise-icon-light-organic-sage-orange.png',
    softwareKeyboardLayoutMode: 'resize',
    adaptiveIcon: {
      backgroundColor: '#EDEAE4',
      foregroundImage: './assets/brand/icon-concepts/light-organic/mise-icon-light-organic-sage-orange.png',
    },
    permissions: ['android.permission.CAMERA'],
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-secure-store',
    'expo-font',
    [
      'expo-splash-screen',
      {
        image: './assets/brand/icon-concepts/dark-glass/mise-icon-dark-glass-navy-sage.png',
        resizeMode: 'contain',
        backgroundColor: '#EDEAE4',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Mise uses the camera to photograph your meals so it can estimate their calories.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Mise reads photos you pick so it can estimate the calories of a meal.',
      },
    ],
  ],
  extra: {
    devApiKey,
  },
};

export default config;
