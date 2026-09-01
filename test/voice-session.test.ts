import { describe, expect, test } from 'vitest';

import {
  announcementFor,
  elapsedLabel,
  failureLabel,
  hasSalvageableTranscript,
  initialVoiceSession,
  isCapturing,
  owesAudioDeletion,
  recoveryActions,
  statusLabel,
  voiceSessionReducer,
  type VoiceFailureKind,
  type VoiceSessionEvent,
  type VoiceSessionState,
} from '../src/media/speech/session';
import { keyboardDictationAdapter } from '../src/media/speech/adapters/keyboard';
import { createLocalModelAdapter } from '../src/media/speech/adapters/localModel';
import { createCloudAdapter } from '../src/media/speech/adapters/cloud';
import { nativeRecognitionAdapter } from '../src/media/speech/adapters/native';
import { selectRoute } from '../src/media/speech/routing';
import {
  SPEECH_MODELS,
  describeDownload,
  modelForLanguage,
  noModelMessage,
} from '../src/media/speech/models';
import { NO_VOICE_CONSENT, grantConsent } from '../src/logic/voiceConsent';

const start = () => initialVoiceSession('on_device', 'en-GB');

function run(state: VoiceSessionState, ...events: VoiceSessionEvent[]): VoiceSessionState {
  return events.reduce(voiceSessionReducer, state);
}

const listening = () =>
  run(start(), { type: 'START' }, { type: 'PERMISSION_GRANTED' });

/* -------------------------------------------------------------------------- */
/* 5.1 the state machine                                                       */
/* -------------------------------------------------------------------------- */

describe('nothing listens until the user starts', () => {
  test('a fresh session is idle with an empty transcript', () => {
    const state = start();
    expect(state.status).toBe('idle');
    expect(isCapturing(state)).toBe(false);
    expect(state.transcript).toBe('');
  });

  test('starting asks for permission before it listens', () => {
    expect(run(start(), { type: 'START' }).status).toBe('requesting_permission');
  });

  test('a denied permission is a failure with its own recovery', () => {
    const state = run(start(), { type: 'START' }, { type: 'PERMISSION_DENIED' });
    expect(state.status).toBe('failed');
    expect(state.failure).toBe('permission_denied');
    expect(recoveryActions(state.failure)).toContain('Type instead');
  });
});

describe('a typed recovery after a failure can still finish', () => {
  const failed = (transcript: string) => ({
    ...run(start(), { type: 'START' }, { type: 'PERMISSION_DENIED' }),
    transcript,
  });

  test('Finish is reachable from failed once something has been typed', () => {
    const state = run(failed('six eggs'), { type: 'FINISH' });
    expect(state.status).toBe('finishing');
    expect(hasSalvageableTranscript(failed('six eggs'))).toBe(true);
  });

  test('Finish from failed with nothing typed is a no-op — there is nothing to finish', () => {
    const state = run(failed(''), { type: 'FINISH' });
    expect(state.status).toBe('failed');
  });

  test('Finish from failed with only whitespace is also a no-op', () => {
    const state = run(failed('   '), { type: 'FINISH' });
    expect(state.status).toBe('failed');
  });
});

describe('an interruption never resumes on its own', () => {
  test('a call stops capture and keeps what was heard', () => {
    const state = run(
      listening(),
      { type: 'TRANSCRIPT', text: 'six eggs' },
      { type: 'INTERRUPT', kind: 'call' },
    );
    expect(state.status).toBe('interrupted');
    expect(state.transcript).toBe('six eggs');
    expect(isCapturing(state)).toBe(false);
  });

  test('RESUME does nothing after an interruption', () => {
    // The one property this whole reducer exists for: only the user's own
    // Start gets back to listening.
    const interrupted = run(listening(), { type: 'INTERRUPT', kind: 'call' });
    expect(voiceSessionReducer(interrupted, { type: 'RESUME' })).toBe(interrupted);
  });

  test('an explicit Start does resume, because the user asked', () => {
    const state = run(
      listening(),
      { type: 'INTERRUPT', kind: 'call' },
      { type: 'START' },
      { type: 'PERMISSION_GRANTED' },
    );
    expect(state.status).toBe('listening');
    expect(state.interruption).toBeNull();
  });

  test('the partial transcript can be finished instead of discarded', () => {
    const state = run(
      listening(),
      { type: 'TRANSCRIPT', text: 'six eggs' },
      { type: 'INTERRUPT', kind: 'backgrounded' },
    );
    expect(hasSalvageableTranscript(state)).toBe(true);
    expect(run(state, { type: 'FINISH' }).status).toBe('finishing');
  });

  test('every interruption kind names itself', () => {
    for (const kind of ['call', 'audio_route_changed', 'backgrounded', 'microphone_taken', 'permission_revoked'] as const) {
      const state = run(listening(), { type: 'INTERRUPT', kind });
      expect(statusLabel(state).length).toBeGreaterThan(0);
      expect(statusLabel(state)).not.toBe('Stopped');
    }
  });

  test('a revoked permission mid-session is an interruption, not a crash', () => {
    expect(run(listening(), { type: 'INTERRUPT', kind: 'permission_revoked' }).status).toBe(
      'interrupted',
    );
  });
});

describe('pause and resume are the user’s', () => {
  test('pausing stops capture and resuming restarts it', () => {
    const paused = run(listening(), { type: 'PAUSE' });
    expect(paused.status).toBe('paused');
    expect(run(paused, { type: 'RESUME' }).status).toBe('listening');
  });

  test('elapsed time does not run while paused', () => {
    const state = run(
      listening(),
      { type: 'TICK', ms: 3000 },
      { type: 'PAUSE' },
      { type: 'TICK', ms: 9000 },
    );
    expect(state.elapsedMs).toBe(3000);
    expect(elapsedLabel(state.elapsedMs)).toBe('0:03');
  });

  test('the transcript is editable while paused but not mid-sentence', () => {
    const paused = run(listening(), { type: 'PAUSE' });
    expect(run(paused, { type: 'EDIT_TRANSCRIPT', text: 'seven eggs' }).transcript).toBe(
      'seven eggs',
    );
    const stillListening = run(listening(), { type: 'EDIT_TRANSCRIPT', text: 'nope' });
    expect(stillListening.transcript).toBe('');
  });

  test('MERGE_TRANSCRIPT lands what Pause captured while stopping the adapter', () => {
    // The local-model path has no live partials, so what it heard between
    // Resume and Pause is only known once `stop()` finishes transcribing it —
    // arriving after the reducer has already moved to 'paused', which is why
    // this is a distinct event from TRANSCRIPT rather than reusing it.
    const paused = run(listening(), { type: 'PAUSE' });
    expect(run(paused, { type: 'MERGE_TRANSCRIPT', text: 'six eggs' }).transcript).toBe(
      'six eggs',
    );
  });

  test('MERGE_TRANSCRIPT is a no-op outside paused', () => {
    expect(run(listening(), { type: 'MERGE_TRANSCRIPT', text: 'six eggs' }).transcript).toBe('');
  });
});

describe('cancelling leaves nothing behind', () => {
  test('cancel clears the transcript and the clock', () => {
    const state = run(
      listening(),
      { type: 'TRANSCRIPT', text: 'six eggs' },
      { type: 'TICK', ms: 5000 },
      { type: 'CANCEL' },
    );
    expect(state).toMatchObject({ status: 'cancelled', transcript: '', elapsedMs: 0 });
  });

  test('cancel still owes an audio deletion until it happens', () => {
    const state = run(
      listening(),
      { type: 'AUDIO_STARTED', audioUri: 'file:///cache/voice-intake/a.m4a' },
      { type: 'CANCEL' },
    );
    expect(owesAudioDeletion(state)).toBe(true);
    expect(owesAudioDeletion(run(state, { type: 'AUDIO_DELETED' }))).toBe(false);
  });

  test('a successful transcription also owes the deletion', () => {
    const state = run(
      listening(),
      { type: 'AUDIO_STARTED', audioUri: 'file:///cache/voice-intake/a.m4a' },
      { type: 'FINISH' },
      { type: 'TRANSCRIBING' },
      { type: 'TRANSCRIBED', text: 'six eggs' },
    );
    expect(state.status).toBe('ready');
    expect(owesAudioDeletion(state)).toBe(true);
  });

  test('a terminal failure owes it too', () => {
    const state = run(
      listening(),
      { type: 'AUDIO_STARTED', audioUri: 'file:///cache/voice-intake/a.m4a' },
      { type: 'FAIL', kind: 'transcription_failed' },
    );
    expect(owesAudioDeletion(state)).toBe(true);
  });

  test('the keyboard path never has audio to owe', () => {
    const state = run(
      initialVoiceSession('keyboard', 'en-GB'),
      { type: 'START' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'AUDIO_STARTED', audioUri: null },
    );
    expect(owesAudioDeletion(state)).toBe(false);
  });
});

describe('language and mode never change silently', () => {
  test('the language can be changed while stopped', () => {
    expect(run(start(), { type: 'SET_LANGUAGE', language: 'yue-HK' }).language).toBe('yue-HK');
  });

  test('the language cannot change mid-recording', () => {
    const state = listening();
    expect(voiceSessionReducer(state, { type: 'SET_LANGUAGE', language: 'ja-JP' })).toBe(state);
  });
});

describe('each failure has its own words and its own way out', () => {
  const kinds: VoiceFailureKind[] = [
    'permission_denied', 'microphone_unavailable', 'no_speech', 'too_noisy',
    'service_unavailable', 'offline_model_missing', 'provider_rejected',
    'provider_timeout', 'transcription_failed', 'resolution_failed',
  ];

  test('no two failures share a message', () => {
    const messages = kinds.map(failureLabel);
    expect(new Set(messages).size).toBe(kinds.length);
  });

  test('every failure offers at least one action', () => {
    for (const kind of kinds) expect(recoveryActions(kind).length).toBeGreaterThan(0);
  });

  test('a missing offline model offers the download', () => {
    expect(recoveryActions('offline_model_missing')).toContain('Download a speech model');
  });

  test('an unavailable service points at the keyboard first', () => {
    expect(recoveryActions('service_unavailable')[0]).toBe('Use the keyboard microphone');
  });
});

describe('what assistive technology hears', () => {
  test('listening is announced when it starts', () => {
    const idle = start();
    const going = run(idle, { type: 'START' }, { type: 'PERMISSION_GRANTED' });
    expect(announcementFor(idle, going)).toBe('Listening started');
  });

  test('the live transcript is not announced', () => {
    const before = listening();
    const after = voiceSessionReducer(before, { type: 'TRANSCRIPT', text: 'six eggs' });
    // Same status, so nothing is announced — otherwise every syllable would
    // interrupt the screen reader.
    expect(announcementFor(before, after)).toBeNull();
  });

  test('an interruption says it did not restart', () => {
    const before = listening();
    const after = voiceSessionReducer(before, { type: 'INTERRUPT', kind: 'call' });
    expect(announcementFor(before, after)).toMatch(/did not restart/i);
  });

  test('cancelling says nothing was added', () => {
    const before = listening();
    const after = voiceSessionReducer(before, { type: 'CANCEL' });
    expect(announcementFor(before, after)).toMatch(/Nothing was added/i);
  });
});

/* -------------------------------------------------------------------------- */
/* 5.2 / 5.3 adapters and routing                                              */
/* -------------------------------------------------------------------------- */

describe('the keyboard microphone is the floor', () => {
  test('it is always available and never touches audio', async () => {
    expect(await keyboardDictationAdapter.isAvailable('yue-HK')).toEqual({
      available: true,
      onDevice: true,
    });
    expect(keyboardDictationAdapter.sendsAudioOffDevice).toBe(false);
  });

  test('it says honestly that Mise cannot start it', () => {
    expect(keyboardDictationAdapter.canStartProgrammatically).toBe(false);
  });
});

describe('the native recogniser reports why it cannot help', () => {
  test('a missing native side is module_missing, not a crash', async () => {
    const availability = await nativeRecognitionAdapter.isAvailable('en-GB');
    // `expo-speech-recognition` is a dependency now, but its native module
    // does not exist under Node — nor in Expo Go, nor before a development
    // build. All three must degrade to the keyboard rather than throw.
    expect(availability).toMatchObject({ available: false, reason: 'module_missing' });
  });

  test('it never sends audio off the device', () => {
    expect(nativeRecognitionAdapter.sendsAudioOffDevice).toBe(false);
  });
});

describe('the downloadable model registry', () => {
  test('Parakeet v3 is offered for European speech', () => {
    const model = modelForLanguage('de-DE');
    expect(model?.id).toBe('parakeet-tdt-0.6b-v3');
  });

  test('Parakeet v3 is not offered for Cantonese, because it cannot serve it', () => {
    // The finding that turned one model into a registry: v3 covers 25
    // European languages and no Asian one.
    const parakeet = SPEECH_MODELS.find((m) => m.id === 'parakeet-tdt-0.6b-v3')!;
    expect(parakeet.languages).not.toContain('yue');
    expect(parakeet.languages).not.toContain('zh');
    expect(modelForLanguage('yue-HK')?.id).toBe('sense-voice-small');
  });

  test('Chinese variants all reach the same model', () => {
    for (const tag of ['zh-Hans', 'zh-Hant', 'zh-HK', 'yue-HK']) {
      expect(modelForLanguage(tag)?.id).toBe('sense-voice-small');
    }
  });

  test('a language nothing covers gets null, not the nearest model', () => {
    expect(modelForLanguage('th-TH')).toBeNull();
    expect(noModelMessage('ไทย')).toMatch(/keyboard/i);
  });

  test('the offer names the model, publisher, and licence before downloading', () => {
    const offer = describeDownload('de-DE', 'Deutsch')!;
    expect(offer.title).toContain('Parakeet TDT 0.6b v3');
    expect(offer.detail).toContain('NVIDIA');
    expect(offer.detail).toContain('CC-BY-4.0');
    expect(offer.reason).toMatch(/nothing is sent anywhere/i);
  });

  test('the size is the real asset size, stated before the download starts', () => {
    // Read from the GitHub release asset, not from a README: 487 MB is enough
    // to matter to someone on mobile data.
    expect(describeDownload('de-DE', 'Deutsch')!.size).toBe('487 MB');
    expect(describeDownload('yue-HK', '廣東話')!.size).toBe('166 MB');
  });

  test('a large download says so rather than burying it', () => {
    expect(describeDownload('de-DE', 'Deutsch')!.caution).toMatch(/large download/i);
    expect(describeDownload('de-DE', 'Deutsch')!.caution).toMatch(/Wi-Fi/);
  });

  test('every model has a real release URL and an unpack directory', () => {
    for (const model of SPEECH_MODELS) {
      expect(model.url).toMatch(
        /^https:\/\/github\.com\/k2-fsa\/sherpa-onnx\/releases\/download\/asr-models\/.+\.tar\.bz2$/,
      );
      expect(model.url).toContain(model.directoryName);
      expect(model.sizeMb).toBeGreaterThan(0);
    }
  });

  test('a build with no inference runtime says so, rather than offering a download', async () => {
    // Under Node — and in Expo Go, and before a prebuild — sherpa-onnx has no
    // native side. "Download a 487 MB model" would be the wrong repair for
    // that, so the runtime is checked before the download state.
    const adapter = createLocalModelAdapter({ has: () => true });
    expect(await adapter.isAvailable('de-DE')).toMatchObject({
      available: false,
      reason: 'module_missing',
    });
  });

  test('a language no model covers reports that first of all', async () => {
    const adapter = createLocalModelAdapter({ has: () => true });
    expect(await adapter.isAvailable('th-TH')).toMatchObject({
      available: false,
      reason: 'language_unsupported',
    });
  });

  test('the adapter does not claim a live transcript it cannot produce', () => {
    // Both registered models are offline recognisers, not streaming ones.
    expect(createLocalModelAdapter().providesLiveTranscript).toBe(false);
    expect(keyboardDictationAdapter.providesLiveTranscript).toBe(true);
  });
});

describe('the routing ladder', () => {
  const route = (language: string, name: string, installed = { has: () => false }) =>
    Promise.all(
      [nativeRecognitionAdapter, createLocalModelAdapter(installed), keyboardDictationAdapter].map(
        async (adapter) => ({ adapter, availability: await adapter.isAvailable(language) }),
      ),
    ).then((candidates) => selectRoute(candidates, language, name));

  test('with no native module it falls to the keyboard, not to nothing', async () => {
    const chosen = await route('en-GB', 'English (UK)');
    expect(chosen.chosen?.id).toBe('keyboard');
    expect(chosen.mode).toBe('keyboard');
  });

  test('it records why each better path was skipped', async () => {
    const chosen = await route('en-GB', 'English (UK)');
    // Native has no native side under Node; the model has no runtime to run in.
    expect(chosen.skipped.map((entry) => entry.reason)).toEqual([
      'module_missing',
      'module_missing',
    ]);
    expect(chosen.skipped.map((entry) => entry.label)).toEqual([
      'This device’s speech recognition',
      'Downloaded speech model',
    ]);
  });

  test('it suggests the download that would fix the skipped path', async () => {
    const chosen = await route('de-DE', 'Deutsch');
    expect(chosen.downloadSuggestion).toEqual({
      modelId: 'parakeet-tdt-0.6b-v3',
      modelName: 'Parakeet TDT 0.6b v3',
    });
  });

  test('it suggests SenseVoice, not Parakeet, for Cantonese', async () => {
    const chosen = await route('yue-HK', '廣東話');
    expect(chosen.downloadSuggestion?.modelId).toBe('sense-voice-small');
  });

  test('it suggests nothing for a language no model covers', async () => {
    const chosen = await route('th-TH', 'ไทย');
    expect(chosen.chosen?.id).toBe('keyboard');
    expect(chosen.downloadSuggestion).toBeNull();
  });

  test('cloud is never reachable by falling back', async () => {
    const consented = grantConsent(NO_VOICE_CONSENT, 'audio_transcription');
    const cloud = createCloudAdapter(consented, true);
    // Even fully consented and keyed, it is not in the ladder at all.
    const chosen = await route('en-GB', 'English (UK)');
    expect(chosen.chosen?.id).not.toBe(cloud.id);
    expect(chosen.skipped.map((entry) => entry.label)).not.toContain(cloud.label);
  });

  test('an unconsented cloud adapter refuses on consent, not on the key', async () => {
    const cloud = createCloudAdapter(NO_VOICE_CONSENT, true);
    expect(await cloud.isAvailable('en-GB')).toMatchObject({
      available: false,
      reason: 'not_consented',
    });
  });

  test('a downloaded model outranks the keyboard, which is why it was worth downloading', () => {
    // The keyboard reports itself available unconditionally — Mise cannot see
    // which languages someone's keyboard handles. If it sat above the model,
    // a 487 MB download the user waited for could never be selected.
    const chosen = selectRoute(
      [
        { adapter: nativeRecognitionAdapter, availability: { available: false, reason: 'module_missing', detail: '' } },
        { adapter: createLocalModelAdapter({ has: () => true }), availability: { available: true, onDevice: true } },
        { adapter: keyboardDictationAdapter, availability: { available: true, onDevice: true } },
      ],
      'de-DE',
      'Deutsch',
    );
    expect(chosen.chosen?.id).toBe('local-model');
    expect(chosen.mode).toBe('local_model');
  });

  test('nothing is offered for download while that model is the one in use', () => {
    const chosen = selectRoute(
      [
        { adapter: nativeRecognitionAdapter, availability: { available: false, reason: 'module_missing', detail: '' } },
        { adapter: createLocalModelAdapter({ has: () => true }), availability: { available: true, onDevice: true } },
      ],
      'de-DE',
      'Deutsch',
    );
    expect(chosen.downloadSuggestion).toBeNull();
  });

  test('the keyboard is still the floor when the model is not downloaded', () => {
    const chosen = selectRoute(
      [
        { adapter: nativeRecognitionAdapter, availability: { available: false, reason: 'module_missing', detail: '' } },
        { adapter: createLocalModelAdapter(), availability: { available: false, reason: 'model_not_downloaded', detail: '' } },
        { adapter: keyboardDictationAdapter, availability: { available: true, onDevice: true } },
      ],
      'de-DE',
      'Deutsch',
    );
    expect(chosen.chosen?.id).toBe('keyboard');
    // And the download is still offered, even though something was chosen.
    expect(chosen.downloadSuggestion?.modelId).toBe('parakeet-tdt-0.6b-v3');
  });

  test('the chosen path explains where the speech is processed', async () => {
    const chosen = await route('en-GB', 'English (UK)');
    expect(chosen.explanation).toMatch(/on this device/i);
  });
});
