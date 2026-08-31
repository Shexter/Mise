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
      NSLocationWhenInUseUsageDescription:
        "Mise uses your location, only while the app is open, to recognise shops you've bought from before and show what you're low on when you check one.",
      NSMicrophoneUsageDescription:
        'Mise uses the microphone only while you are speaking your pantry, so it can write down what you say. The recording is deleted as soon as it has been turned into text.',
      // Required by `SFSpeechRecognizer` even though Mise always asks for
      // on-device recognition. A device that cannot honour that is reported
      // unavailable rather than quietly transcribing over the network.
      NSSpeechRecognitionUsageDescription:
        'Mise turns your speech into text on this device so you can name several pantry items at once. Nothing is sent anywhere.',
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
       * `com.google.android.as` is the on-device Android System Intelligence
       * service — the one that does offline recognition and language
       * identification. Declaring it is what lets `requiresOnDeviceRecognition`
       * actually find a local model instead of silently needing the network.
       */
      'expo-speech-recognition',
      {
        microphonePermission:
          'Mise uses the microphone only while you are speaking your pantry, so it can write down what you say. The recording is deleted as soon as it has been turned into text.',
        speechRecognitionPermission:
          'Mise turns your speech into text on this device so you can name several pantry items at once. Nothing is sent anywhere.',
        androidSpeechServicePackages: ['com.google.android.as'],
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
