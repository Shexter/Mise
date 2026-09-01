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
 * Bundling now requires a second explicit opt-in, so merely having a personal
 * key in `.env` cannot leak it through `expo config` or a release build.
 */
const devApiKey = process.env.MISE_BUNDLE_DEV_API_KEY === 'true'
  ? process.env.MISE_DEV_API_KEY ?? null
  : null;
const sourceRevision =
  process.env.MISE_SOURCE_REVISION ??
  process.env.EAS_BUILD_GIT_COMMIT_HASH ??
  'development';

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
      NSLocationWhenInUseUsageDescription:
        "Mise uses your location, only while the app is open, to recognise shops you've bought from before and show what you're low on when you check one.",
      NSMicrophoneUsageDescription:
        'Mise uses the microphone only while you are speaking your pantry, so it can write down what you say. The recording is deleted as soon as it has been turned into text.',
      // Required by `SFSpeechRecognizer`. Phone speech may use the platform's
      // normal service; Offline only is a separate, explicitly chosen path.
      NSSpeechRecognitionUsageDescription:
        'Mise asks your phone speech service to turn speech into text while you name pantry items.',
    },
    // The `mise` scheme above becomes this app's CFBundleURLTypes entry at
    // prebuild, so a `mise://` link opens the intake. Appearing in the iOS
    // *share* sheet is a different thing and cannot be declared here: it
    // needs a Share Extension target, which needs a config plugin. Task 1.1's
    // spike decides whether that is worth adding; until it does, iOS users
    // reach the intake by pasting, which the screen is built around anyway.
  },
  android: {
    package: 'com.mise.app',
    icon: './assets/brand/icon-concepts/light-organic/mise-icon-light-organic-sage-orange.png',
    softwareKeyboardLayoutMode: 'resize',
    adaptiveIcon: {
      backgroundColor: '#EDEAE4',
      foregroundImage: './assets/brand/icon-concepts/light-organic/mise-icon-light-organic-sage-orange.png',
    },
    permissions: [
      'android.permission.CAMERA',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.RECORD_AUDIO',
    ],
    /**
     * Share-target registration (`add-recipe-links` task 3.1).
     *
     * Sharing a post to Mise is the whole intake: the app never contacts
     * Instagram, TikTok, or YouTube, so what the share sheet hands over is
     * all it will ever have. Three filters, because a share sheet delivers
     * a recipe in exactly three shapes:
     *
     * - `text/plain` — a URL, a caption, or both glued together. The common
     *   case, and the one `splitSharedPayload` exists to take apart.
     * - `image/*` — a screenshot of an on-screen ingredient list, which
     *   routes into the unified capture image path.
     * - `VIEW` on the `mise` scheme, which Expo generates from `scheme`
     *   above; it is not repeated here.
     *
     * `SEND_MULTIPLE` is deliberately absent. One recipe at a time is the
     * whole model, and accepting a batch would promise an intake that does
     * not exist.
     */
    intentFilters: [
      {
        action: 'SEND',
        category: ['DEFAULT'],
        data: [{ mimeType: 'text/plain' }],
      },
      {
        action: 'SEND',
        category: ['DEFAULT'],
        data: [{ mimeType: 'image/*' }],
      },
    ],
  },
  plugins: [
    'expo-router',
    '@react-native-community/datetimepicker',
    [
      'expo-location',
      {
        // Foreground only. `isAndroidBackgroundLocationEnabled` is deliberately
        // absent: no background location, no geofencing, no background task.
        locationWhenInUsePermission:
          "Mise uses your location, only while the app is open, to recognise shops you've bought from before and show what you're low on when you check one.",
      },
    ],
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
      /**
       * Platform speech recognition — `SFSpeechRecognizer` on iOS, Android's
       * `SpeechRecognizer`.
       *
       * The plugin's job on Android is the package-visibility entry: from
       * Android 11 an app cannot see another app's services unless it declares
       * them, and without `com.google.android.googlequicksearchbox` in
       * `<queries>` the recogniser is invisible and every start fails with no
       * useful error.
       *
       * Mise does not force a service package. Phone speech uses Android's
       * system default; Offline only asks Android for its generic on-device
       * recognizer.
       */
      'expo-speech-recognition',
      {
        microphonePermission:
          'Mise uses the microphone only while you are speaking your pantry, so it can write down what you say. The recording is deleted as soon as it has been turned into text.',
        speechRecognitionPermission:
          'Mise asks your phone speech service to turn speech into text while you name pantry items.',
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
    sourceRevision,
  },
};

export default config;
