import { describe, expect, test } from 'vitest';

import { providerForKey } from '../src/api/keyStore';
import { TRANSPORTS, type ResolvedTransport } from '../src/api/transport';
import { parseVoiceIntakeWithProvider } from '../src/api/voiceIntake';
import { reconcileVoiceParsing } from '../src/api/voiceIntakeSchema';
import { getAllCanonicals, getLocations, loadSeedData } from '../src/db/queries';
import { openReview } from '../src/logic/intakeReview';
import { buildVoiceDraft } from '../src/logic/voiceIntakeService';
import { openTestDatabase } from './stubs/db';

const enabled = process.env['MISE_RUN_LIVE_VOICE_PROVIDER'] === 'true';

describe.skipIf(!enabled)('live voice provider proof', () => {
  test('one transcript-only request reaches validated review candidates', async () => {
    const apiKey = process.env['MISE_DEV_API_KEY'];
    if (!apiKey) throw new Error('MISE_DEV_API_KEY is not configured.');
    const provider = providerForKey(apiKey);
    if (!provider) throw new Error('The configured development key has an unknown provider.');
    const transport = TRANSPORTS[provider];
    const model = await transport.selectedModel();
    const resolved: ResolvedTransport = { apiKey, provider, model, transport };

    openTestDatabase();
    await loadSeedData();
    const [locations, canonicals] = await Promise.all([getLocations(), getAllCanonicals()]);
    const visibleLocations = locations.map(({ id, name }) => ({ id, name }));
    const transcript = 'two eggs, one carton of milk';
    const result = await parseVoiceIntakeWithProvider(
      { transcript, locale: 'en-GB', locations: visibleLocations },
      undefined,
      { resolve: async () => resolved, online: async () => true },
    );
    expect(
      result.validation.accepted.length,
      `content-free rejection codes: ${JSON.stringify(result.validation.rejected)}`,
    ).toBeGreaterThan(0);

    const parsed = reconcileVoiceParsing(
      transcript,
      result.validation,
      canonicals.map((item) => item.displayName.toLowerCase()),
    );
    const draft = await buildVoiceDraft({
      draftId: 'live-provider-proof',
      transcript,
      transcriptionMode: 'keyboard',
      sessionLocationId: locations[0]?.id ?? null,
      parsedTranscript: parsed,
    });
    const review = openReview(draft.id, draft.proposals);
    expect(review.proposals.length).toBeGreaterThan(0);

    // Content-free proof only. Never print the key, transcript, provider body,
    // locations, or candidate names.
    console.info(JSON.stringify({
      proof: 'live-voice-provider',
      provider,
      model,
      validatedCandidates: result.validation.accepted.length,
      reviewCandidates: review.proposals.length,
    }));
  }, 20_000);
});
