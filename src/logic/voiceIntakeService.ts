import { getAllCanonicals, getLocations, listPantryItems } from '@/db/queries';
import { planIntakeProposals, type IntakeCandidate } from '@/logic/intakeProposals';
import { resolveIngredientReferences, resolveIngredientReferencesLocally } from '@/logic/resolution';
import {
  parseVoiceTranscript,
  type ParsedTranscript,
  type ParsedVoiceItem,
} from '@/logic/voicePantryParser';
import type {
  CanonicalItem,
  Location,
  LocationKind,
  PantryIntakeDraft,
  StorageLocation,
  TranscriptionMode,
} from '@/types';

/**
 * Turns a finished transcript into a reviewable draft.
 *
 * The one place the pure pieces meet the database. Everything it does is a
 * read: canonicals, locations, and what is already in stock. Nothing here
 * writes, and the only thing that ever does is
 * `applyPantryIntakeBatch` after the user taps the final action.
 *
 * The order matters. Parsing first, entirely locally; then the *local*
 * resolution cascade; and only if the caller explicitly permits it does an
 * unresolved name reach a provider. That is why `buildVoiceDraft` takes
 * `allowProviderResolution` rather than reading `hasApiKey()` itself — a key
 * configured for photographs is not permission to send spoken words anywhere,
 * and the decision belongs to the screen that showed the disclosure.
 */

export interface BuildDraftOptions {
  draftId: string;
  transcript: string;
  transcriptionMode: TranscriptionMode;
  /** The shelf the sweep is happening on. Every item inherits it. */
  sessionLocationId: string | null;
  /**
   * When true, unresolved names may reach the configured provider. Defaults to
   * false: the local cascade only. The caller sets it after showing the
   * text-resolution disclosure and getting a yes.
   */
  allowProviderResolution?: boolean;
  /** Evidence-validated segmentation; every fact has already been re-parsed locally. */
  parsedTranscript?: ParsedTranscript;
  signal?: AbortSignal;
}

export async function buildVoiceDraft(
  options: BuildDraftOptions,
): Promise<PantryIntakeDraft> {
  const [canonicals, locations, stock] = await Promise.all([
    getAllCanonicals(),
    getLocations(),
    listPantryItems(),
  ]);

  const parsed = options.parsedTranscript ?? parseVoiceTranscript(options.transcript, {
    knownNames: foodLexicon(canonicals),
  });

  const candidates: IntakeCandidate[] = parsed.items.map((item, index) =>
    toCandidate(item, index, options.draftId, locations),
  );

  const references = candidates.map((candidate) => ({ raw: candidate.statedName }));
  const outcomes =
    candidates.length === 0
      ? []
      : options.allowProviderResolution
        ? await resolveIngredientReferences(references, 'voice', options.signal)
        : await resolveIngredientReferencesLocally(references, 'voice');

  const proposals = planIntakeProposals(candidates, outcomes, {
    draftId: options.draftId,
    source: 'voice',
    transcriptionMode: options.transcriptionMode,
    canonicals,
    locations,
    sessionLocationId: options.sessionLocationId,
    existingCanonicalIds: new Set(stock.map((item) => item.canonicalId)),
  });

  return {
    id: options.draftId,
    source: 'voice',
    transcriptionMode: options.transcriptionMode,
    transcript: options.transcript,
    sessionLocationId: options.sessionLocationId,
    proposals,
    unusedPhrases: parsed.unused,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Names the parser may use to split run-on speech.
 *
 * The catalogue's display names, lowercased. Local data, so this costs no
 * request and works offline; it is an assist for segmentation only and never
 * decides what anything *is* — that stays with the resolver.
 */
function foodLexicon(canonicals: readonly CanonicalItem[]): string[] {
  return canonicals.map((canonical) => canonical.displayName.toLowerCase());
}

function toCandidate(
  item: ParsedVoiceItem,
  index: number,
  draftId: string,
  locations: readonly Location[],
): IntakeCandidate {
  return {
    id: `${draftId}-${index}`,
    statedName: item.name,
    sourceSpan: item.span,
    quantity: item.quantity,
    locationId: item.locationId ?? (item.location ? locationIdForKind(item.location, locations) : null),
    fullness: item.fullness,
    opened: item.opened,
    // First inventory says nothing about when anything was bought, and the
    // capture date must not stand in for it (`src/logic/acquisition.ts`).
    acquisition: null,
  };
}

/**
 * Maps a spoken storage word onto one of the user's own locations.
 *
 * By `kind`, never by name. Someone who renamed "Fridge" to "Kühlschrank" still
 * says "in the fridge", and someone with two freezers should not have the word
 * resolve to whichever one happens to be called Freezer. When several match,
 * the first in the user's own order wins — and when none does, the answer is
 * null, so the item falls back to the session location rather than to a shelf
 * nobody named.
 */
export function locationIdForKind(
  spoken: StorageLocation,
  locations: readonly Location[],
): string | null {
  const kind: LocationKind = spoken === 'pantry' ? 'ambient' : spoken;
  return locations.find((location) => location.kind === kind)?.id ?? null;
}
