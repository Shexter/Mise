import { VisionError, type VisionErrorKind } from '@/api/errors';
import { parseVoiceIntakeWithProvider } from '@/api/voiceIntake';
import { reconcileVoiceParsing } from '@/api/voiceIntakeSchema';
import { getAllCanonicals } from '@/db/queries';
import { buildVoiceDraft, type BuildDraftOptions } from '@/logic/voiceIntakeService';
import { recordSpeechDiagnostic, type ProvenSpeechMode, type TranscriptParserPath } from '@/media/speech/diagnostics';
import type { Location, PantryIntakeDraft, TranscriptionMode } from '@/types';
import type { Provider } from '@/api/keyStore';

export interface BuildParsedVoiceDraftOptions extends BuildDraftOptions {
  locale: string;
  visibleLocations: readonly Pick<Location, 'id' | 'name'>[];
  aiTranscriptParsing: boolean;
}

export interface ParsedVoiceDraftResult {
  draft: PantryIntakeDraft;
  parserPath: TranscriptParserPath;
  provider: Provider | null;
  model: string | null;
  revision: string | null;
  fallbackReason: VisionErrorKind | 'no_valid_candidates' | null;
}

/**
 * One AI attempt at most, followed by the same deterministic planner in every
 * outcome. Provider errors are state, not data loss and not a repair request.
 */
export async function buildVoiceDraftWithTranscriptParsing(
  options: BuildParsedVoiceDraftOptions,
): Promise<ParsedVoiceDraftResult> {
  if (!options.aiTranscriptParsing) return localResult(options, null);

  recordSpeechDiagnostic({
    boundary: 'transcript_parse', outcome: 'started', mode: diagnosticMode(options.transcriptionMode),
    parserPath: 'not_run',
  });
  try {
    const provider = await parseVoiceIntakeWithProvider({
      transcript: options.transcript,
      locale: options.locale,
      locations: options.visibleLocations,
    }, options.signal);
    const canonicals = await getAllCanonicals();
    const parsed = reconcileVoiceParsing(
      options.transcript,
      provider.validation,
      canonicals.map((item) => item.displayName.toLowerCase()),
    );
    const acceptedCount = provider.validation.accepted.length;
    const parserPath: TranscriptParserPath = acceptedCount === 0
      ? 'local'
      : provider.validation.rejected.length > 0 || parsed.items.length > acceptedCount
        ? 'mixed'
        : 'ai';
    const draft = await buildVoiceDraft({ ...options, parsedTranscript: parsed });
    const fallbackReason = acceptedCount === 0 ? 'no_valid_candidates' : null;
    recordSpeechDiagnostic({
      boundary: 'transcript_parse', outcome: 'succeeded', mode: diagnosticMode(options.transcriptionMode),
      parserPath, provider: provider.provider, providerModel: provider.model,
    });
    return {
      draft: withParsing(draft, parserPath, provider.provider, provider.model, fallbackReason),
      parserPath,
      provider: provider.provider,
      model: provider.model,
      revision: provider.revision,
      fallbackReason,
    };
  } catch (error) {
    if (error instanceof VisionError && error.kind === 'cancelled') {
      recordSpeechDiagnostic({
        boundary: 'transcript_parse', outcome: 'cancelled', mode: diagnosticMode(options.transcriptionMode),
        parserPath: 'not_run', provider: error.provider ?? null,
      });
      throw error;
    }
    const reason = error instanceof VisionError ? error.kind : 'malformed';
    recordSpeechDiagnostic({
      boundary: 'transcript_parse', outcome: 'failed', mode: diagnosticMode(options.transcriptionMode),
      parserPath: 'local', provider: error instanceof VisionError ? error.provider ?? null : null,
    });
    return localResult(options, reason);
  }
}

async function localResult(
  options: BuildParsedVoiceDraftOptions,
  fallbackReason: ParsedVoiceDraftResult['fallbackReason'],
): Promise<ParsedVoiceDraftResult> {
  const draft = await buildVoiceDraft(options);
  return {
    draft: withParsing(draft, 'local', null, null, fallbackReason),
    parserPath: 'local',
    provider: null,
    model: null,
    revision: null,
    fallbackReason,
  };
}

function withParsing(
  draft: PantryIntakeDraft,
  path: TranscriptParserPath,
  provider: Provider | null,
  model: string | null,
  fallbackReason: ParsedVoiceDraftResult['fallbackReason'],
): PantryIntakeDraft {
  return {
    ...draft,
    transcriptParsing: {
      path: path === 'not_run' ? 'local' : path,
      provider,
      model,
      fallbackReason,
    },
  };
}

function diagnosticMode(mode: TranscriptionMode): ProvenSpeechMode {
  switch (mode) {
    case 'phone': return 'phone';
    case 'android_offline':
    case 'on_device': return 'android_offline';
    case 'local_model': return 'parakeet';
    case 'keyboard': return 'keyboard';
    case 'cloud': return 'phone';
  }
}
