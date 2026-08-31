import type {
  TranscriptionAdapter,
  TranscriptionAvailability,
} from '@/media/speech/types';

/**
 * The keyboard's own microphone key, wrapped in Mise's session UI.
 *
 * This is the path that works today. Mise renders the session — location,
 * elapsed time, transcript, Finish, Cancel — around a `TextInput` it owns, and
 * the user taps the microphone key on their keyboard to dictate into it. On
 * iOS that is Apple's dictation; on Android it is Gboard or Samsung's keyboard.
 * Both are the platform's own on-device speech recognition, reached the one way
 * that needs no native module, no config plugin, and no development build.
 *
 * Two properties fall out of that and are worth stating plainly:
 *
 *   - **Mise never touches audio.** The keyboard hands over text. There is no
 *     recording to retain, delete, or accidentally upload, which makes this the
 *     strongest privacy position of the four adapters rather than the weakest.
 *   - **Mise cannot start or stop it.** `canStartProgrammatically` is false and
 *     the session chrome adapts: it says "tap the microphone on your keyboard"
 *     instead of rendering a Start button that would do nothing.
 *
 * Always available. That is what makes it the floor of the ladder — the answer
 * when the native recogniser is missing and no model has been downloaded.
 */
export const keyboardDictationAdapter: TranscriptionAdapter = {
  id: 'keyboard',
  mode: 'keyboard',
  label: 'Keyboard microphone',
  privacyLine:
    'Your keyboard turns speech into text on this device. Mise only ever sees the words.',
  canStartProgrammatically: false,
  // The keyboard types straight into the field, so the words appear as they
  // are spoken without Mise doing anything.
  providesLiveTranscript: true,
  sendsAudioOffDevice: false,
  isAvailable: async (): Promise<TranscriptionAvailability> => ({
    available: true,
    onDevice: true,
  }),
};

/** The instruction shown in place of a Start button. */
export const KEYBOARD_START_HINT =
  'Tap the microphone on your keyboard and describe what is in there. Edit anything it gets wrong.';
