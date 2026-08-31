import { modelForLanguage, noModelMessage } from '@/media/speech/models';
import type {
  TranscriptionAdapter,
  TranscriptionAvailability,
  UnavailableReason,
} from '@/media/speech/types';
import type { TranscriptionMode } from '@/types';

/**
 * Which transcription path to use, and what to say about the ones that were
 * skipped.
 *
 * Pure: it takes availability answers and returns a decision, so the ladder can
 * be tested without a microphone, a device, or a network. The adapters do the
 * probing; this module does the choosing, and keeping those apart is what makes
 * "what happens when Apple's recogniser is missing on a Samsung with no model
 * downloaded" a test rather than a field report.
 *
 * The order is fixed and not configurable:
 *
 *   1. the platform's own recogniser, on-device;
 *   2. the keyboard's microphone, which is also on-device and always there;
 *   3. a downloadable on-device model;
 *   4. nothing — type instead.
 *
 * Cloud is not in the ladder. It is only ever reached by the user explicitly
 * choosing it after reading the disclosure, which is why it cannot be selected
 * by a fallback rule.
 */

export interface RouteCandidate {
  adapter: TranscriptionAdapter;
  availability: TranscriptionAvailability;
}

export interface TranscriptionRoute {
  /** The adapter to use, or null when only typing is left. */
  chosen: TranscriptionAdapter | null;
  mode: TranscriptionMode | null;
  /** The paths that were tried and why they were passed over. */
  skipped: readonly { label: string; reason: UnavailableReason; detail: string }[];
  /**
   * Set when a download would unblock a better path. The UI offers it; it
   * never starts on its own.
   */
  downloadSuggestion: { modelId: string; modelName: string } | null;
  /** What to tell the user about the choice, in one sentence. */
  explanation: string;
}

export function selectRoute(
  candidates: readonly RouteCandidate[],
  language: string,
  languageName: string,
): TranscriptionRoute {
  const skipped: { label: string; reason: UnavailableReason; detail: string }[] = [];

  for (const candidate of candidates) {
    if (candidate.availability.available) {
      return {
        chosen: candidate.adapter,
        mode: candidate.adapter.mode,
        skipped,
        // Nothing to offer when the downloaded model is the thing being used.
        downloadSuggestion:
          candidate.adapter.mode === 'local_model'
            ? null
            : downloadFor(skipped, language),
        explanation: candidate.adapter.privacyLine,
      };
    }
    skipped.push({
      label: candidate.adapter.label,
      reason: candidate.availability.reason,
      detail: candidate.availability.detail,
    });
  }

  const suggestion = downloadFor(skipped, language);
  return {
    chosen: null,
    mode: null,
    skipped,
    downloadSuggestion: suggestion,
    explanation: suggestion
      ? `This device cannot recognise ${languageName} on its own yet. You can download ${suggestion.modelName}, use your keyboard’s microphone, or type.`
      : noModelMessage(languageName),
  };
}

/**
 * Whether a download is worth offering.
 *
 * Only when something was actually skipped for a model-shaped reason *and* a
 * registered model covers the language. Offering a download to fix a missing
 * native module would be offering the wrong repair, and offering one for a
 * language no model covers would be offering a repair that does not work.
 */
function downloadFor(
  skipped: readonly { reason: UnavailableReason }[],
  language: string,
): { modelId: string; modelName: string } | null {
  const wantsModel = skipped.some((entry) =>
    ['no_offline_model', 'model_not_downloaded', 'module_missing', 'platform_unsupported'].includes(
      entry.reason,
    ),
  );
  if (!wantsModel) return null;
  const model = modelForLanguage(language);
  return model ? { modelId: model.id, modelName: model.name } : null;
}
