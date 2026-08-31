import { readFileSync, readdirSync } from 'node:fs';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getMatchQueue, loadSeedData } from '../src/db/queries';
import { buildVoiceDraft, locationIdForKind } from '../src/logic/voiceIntakeService';
import { SPEECH_MODELS } from '../src/media/speech/models';
import { openTestDatabase } from './stubs/db';
import type { Location } from '../src/types';

const read = (path: string) => readFileSync(path, 'utf8');
const voiceScreen = read('app/pantry-voice.tsx');
const reviewScreen = read('app/pantry-voice-review.tsx');
const audio = read('src/media/speech/audio.ts');
const store = read('src/store/voiceIntakeStore.ts');
const schema = read('src/db/schema.ts');

/* -------------------------------------------------------------------------- */
/* 7.3 nothing leaves the device                                               */
/* -------------------------------------------------------------------------- */

describe('local-only intake makes no provider call', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  test('a whole sweep resolves with fetch stubbed to throw', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => {
        throw new Error('A local-only voice sweep must not reach the network.');
      });

    try {
      const draft = await buildVoiceDraft({
        draftId: 'draft-local',
        transcript:
          'six chicken breasts, half a carton of milk, three carrots, some butter',
        transcriptionMode: 'keyboard',
        sessionLocationId: 'fridge',
      });
      expect(draft.proposals.length).toBeGreaterThan(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test('unresolved names stay unresolved rather than reaching for a provider', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('No provider call is permitted here.');
    });
    try {
      const draft = await buildVoiceDraft({
        draftId: 'draft-unknown',
        transcript: 'two zzzqx and one wibblefruit',
        transcriptionMode: 'keyboard',
        sessionLocationId: 'fridge',
      });
      // They come back needing a look, which is the honest outcome.
      expect(draft.proposals.every((proposal) => proposal.canonicalId === null)).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test('a local sweep does not write speculative rows into the match queue', async () => {
    await buildVoiceDraft({
      draftId: 'draft-queue',
      transcript: 'two zzzqx',
      transcriptionMode: 'keyboard',
      sessionLocationId: 'fridge',
    });
    // Preselection is a read. Nothing is committed until the user confirms.
    expect(await getMatchQueue()).toEqual([]);
  });

  test('provider resolution is opt-in at the call site, never inferred from a key', () => {
    const service = read('src/logic/voiceIntakeService.ts');
    expect(service).toContain('allowProviderResolution');
    // Never *calls* it: the decision is the caller's, not a key check here.
    expect(service).not.toMatch(/hasApiKey\(\)(?!` itself)/);
    expect(service).not.toMatch(/await hasApiKey/);
    // The recording screen builds drafts locally and says why.
    expect(voiceScreen).toContain('allowProviderResolution: false');
  });
});

/* -------------------------------------------------------------------------- */
/* 5.5 audio has nowhere to persist                                            */
/* -------------------------------------------------------------------------- */

describe('raw audio cannot outlive the session', () => {
  test('audio lives in the cache directory, never in documents', () => {
    expect(audio).toContain('Paths.cache');
    expect(audio).not.toContain('Paths.document');
  });

  test('audio never enters the pending-capture queue', () => {
    // Prose in `audio.ts` explains the rule, so only executable lines count.
    const code = [audio, voiceScreen, reviewScreen, store]
      .join('\n')
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join('\n');
    expect(code).not.toMatch(/pending_captures|PendingCapture/);
  });

  test('the recording screen deletes audio on success, failure, and cancel', () => {
    expect(voiceScreen).toContain("['ready', 'failed', 'cancelled'].includes(session.status)");
    expect(voiceScreen).toContain('deleteAudio(session.audioUri)');
    // And on the way out, whichever way that is.
    expect(voiceScreen).toContain('purgeAllAudio()');
  });

  test('a session that died mid-recording is cleaned up on the next open', () => {
    const openEffect = voiceScreen.slice(voiceScreen.indexOf('/* -- setup'));
    expect(openEffect).toContain('purgeAllAudio();');
  });

  test('no schema table can hold audio or a transcript', () => {
    expect(schema).not.toMatch(/audio_uri|transcript|recording_uri/i);
  });

  test('the draft store persists nothing', () => {
    expect(store).not.toContain('persist(');
    expect(store).toContain('in memory only');
  });
});

/* -------------------------------------------------------------------------- */
/* 7.1 what assistive technology is given                                      */
/* -------------------------------------------------------------------------- */

describe('the interface speaks in text, not in decoration', () => {
  test('state transitions are announced', () => {
    expect(voiceScreen).toContain('AccessibilityInfo.announceForAccessibility(message)');
    expect(voiceScreen).toContain('announcementFor(previous.current, session)');
  });

  test('the live transcript is not announced on every syllable', () => {
    // `announcementFor` returns null when the status has not changed, so a
    // TRANSCRIPT event produces no announcement at all.
    expect(voiceScreen).not.toContain('announceForAccessibility(session.transcript)');
  });

  test('the status dot is decoration; the status is a text role', () => {
    expect(voiceScreen).toContain('<RowTitle accessibilityLiveRegion="polite">{statusLabel(session)}</RowTitle>');
    expect(voiceScreen).toContain('styles.dot');
    expect(voiceScreen).not.toMatch(/dot[\s\S]{0,120}accessibilityLabel/);
  });

  test('the review announces how many items and how many need a look', () => {
    expect(reviewScreen).toContain('reviewOpeningSummary(review.proposals)');
    expect(reviewScreen).toContain('AccessibilityInfo.announceForAccessibility(summary)');
  });

  test('the elapsed time and language are shown as text', () => {
    expect(voiceScreen).toContain('elapsedLabel(session.elapsedMs)');
    expect(voiceScreen).toContain('languageName(language)');
  });
});

/* -------------------------------------------------------------------------- */
/* 7.2 targets and reachability                                                */
/* -------------------------------------------------------------------------- */

describe('every control is reachable and big enough', () => {
  test('rows and options meet the minimum touch target', () => {
    for (const source of [voiceScreen, reviewScreen]) {
      const targets = source.match(/minHeight: layout\.minTouchTarget/g) ?? [];
      expect(targets.length).toBeGreaterThan(0);
    }
  });

  test('small icon actions extend their target with hit slop', () => {
    expect(reviewScreen).toContain('hitSlop={space.xs}');
  });

  test('both screens scroll, so large text cannot strand the footer', () => {
    expect(voiceScreen).toContain('<Screen\n      scroll');
    expect(reviewScreen).toContain('<Screen\n      scroll');
  });

  test('every proposal row is a labelled checkbox, not a bare tap area', () => {
    expect(reviewScreen).toContain('accessibilityRole="checkbox"');
    expect(reviewScreen).toContain('accessibilityState={{ checked: chosen }}');
  });

  test('the item actions wrap rather than truncating at large text', () => {
    expect(reviewScreen).toContain("itemActions: { flexDirection: 'row', gap: space.base, flexWrap: 'wrap' }");
  });

  test('a non-voice path is offered on both screens', () => {
    expect(voiceScreen).toMatch(/Would rather type/);
    expect(reviewScreen).toContain('Discard this draft');
  });
});

/* -------------------------------------------------------------------------- */
/* the mutation boundary is singular                                           */
/* -------------------------------------------------------------------------- */

describe('only one place writes stock', () => {
  test('the recording screen writes nothing', () => {
    expect(voiceScreen).not.toMatch(/insertPantryItem|applyPantryIntakeBatch/);
  });

  test('the review writes exactly once, through the batch writer', () => {
    // Once as an import, once as the single call site.
    expect(reviewScreen.match(/applyPantryIntakeBatch\(/g)).toHaveLength(1);
    expect(reviewScreen).not.toContain('insertPantryItem');
  });

  test('confirmed stock is recorded with an unknown acquisition date', () => {
    expect(reviewScreen).toContain('acquiredAtKnown: false');
  });

  test('success offers Undo and re-invalidates downstream once', () => {
    expect(reviewScreen).toContain("actionLabel: 'Undo'");
    expect(reviewScreen).toContain('undoPantryIntakeBatch(result.batchId)');
    expect(reviewScreen.match(/invalidatePantryDependentSuggestions/g)?.length).toBe(3);
  });
});

/* -------------------------------------------------------------------------- */
/* location mapping                                                            */
/* -------------------------------------------------------------------------- */

describe('spoken locations map by kind, never by name', () => {
  const locations: Location[] = [
    { id: 'chest', name: 'Chest freezer', kind: 'freezer', sortOrder: 0 },
    { id: 'kuhlschrank', name: 'Kühlschrank', kind: 'fridge', sortOrder: 1 },
    { id: 'cupboard', name: 'Cupboard', kind: 'ambient', sortOrder: 2 },
  ];

  test('a renamed fridge still answers to “fridge”', () => {
    expect(locationIdForKind('fridge', locations)).toBe('kuhlschrank');
  });

  test('“pantry” means the ambient shelf whatever it is called', () => {
    expect(locationIdForKind('pantry', locations)).toBe('cupboard');
  });

  test('a kind with no location returns null rather than a wrong shelf', () => {
    expect(locationIdForKind('counter', locations)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Speech models are an external download, never part of the app               */
/* -------------------------------------------------------------------------- */

describe('no speech model ships inside Mise', () => {
  const models = read('src/media/speech/models.ts');
  const modelStore = read('src/media/speech/modelStore.ts');

  test('every model is fetched from a remote release, never bundled', () => {
    for (const model of SPEECH_MODELS) {
      expect(model.url).toMatch(/^https:\/\//);
    }
    // A bundled model would have to be `require`d or sit in `assets/`.
    expect(models).not.toMatch(/require\(.*\.(onnx|tar|bz2|zip)/i);
    expect(models).not.toMatch(/['"`]\.\.?\/.*assets/);
  });

  test('nothing model-shaped is committed to the assets directory', () => {
    const assets = readdirSync('assets');
    for (const entry of assets) {
      expect(entry).not.toMatch(/\.(onnx|tar\.bz2|tflite)$/i);
    }
    expect(assets).not.toContain('models');
    expect(assets).not.toContain('speech-models');
  });

  test('the download only happens when something calls it', () => {
    // No module-scope call: importing the store must not start 487 MB moving.
    // Indented occurrences are the interface declaration and the call inside
    // `downloadSpeechModel`; a call at column zero would run on import.
    const topLevelCalls = modelStore
      .split('\n')
      .filter((line) => /^(await\s+)?(void\s+)?(downloadSpeechModel|ensureModelByCategory)\(/.test(line));
    expect(topLevelCalls).toEqual([]);
    expect(modelStore).toContain('export async function downloadSpeechModel');
  });

  test('the screen states that the download is separate from installing Mise', () => {
    expect(voiceScreen).toContain('not part of installing Mise');
    // And the size is on the button, so it cannot be missed.
    expect(voiceScreen).toContain('label={`Download ${download.size}`}');
  });

  test('a download can be stopped, and is resumable rather than restarted', () => {
    expect(voiceScreen).toContain('Stop the download');
    expect(voiceScreen).toContain('AbortController');
    expect(modelStore).toContain('ensureModelByCategory');
    expect(modelStore).toMatch(/resumable/i);
  });

  test('the archive is deleted once it has been unpacked', () => {
    expect(modelStore).toContain('deleteArchiveAfterExtract: true');
  });
});

describe('a downloaded model is the user’s to reclaim', () => {
  const settings = read('app/(tabs)/settings.tsx');

  test('Delete all data removes downloaded speech models too', () => {
    expect(settings).toContain('removeAllSpeechModels()');
    expect(settings).toContain('purgeAllAudio()');
  });

  test('removal goes through the library that owns the storage layout', () => {
    const modelStore = read('src/media/speech/modelStore.ts');
    expect(modelStore).toContain('deleteModelByCategory');
    expect(modelStore).toContain('export async function removeAllSpeechModels');
  });
});
