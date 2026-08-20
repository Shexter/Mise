import { VisionError } from '@/api/errors';
import {
  buildBodyCompositionPrompt,
  parseBodyCompositionResponse,
} from '@/api/bodyCompositionPrompt';
import { completeVision } from '@/api/transport';
import {
  normalizeBodyComposition,
  type BodyCompositionExtraction,
} from '@/logic/bodyCompositionParser';
import { photoBase64 } from '@/media/photos';

/**
 * Reads one local report image through the selected provider. The result is a
 * transient review draft; this module never persists the image or candidates.
 */
export async function extractBodyComposition(
  photoUri: string,
  signal?: AbortSignal,
): Promise<BodyCompositionExtraction> {
  if (signal?.aborted) throw cancelledError();
  if (photoUri.trim().length === 0) throw malformedMediaError();

  try {
    const base64Jpeg = await photoBase64(photoUri);
    if (signal?.aborted) throw cancelledError();
    if (base64Jpeg.length === 0) throw malformedMediaError();

    const prompt = buildBodyCompositionPrompt();
    const response = await completeVision(
      base64Jpeg,
      prompt.system,
      prompt.user,
      signal,
    );
    if (signal?.aborted) throw cancelledError();

    return normalizeBodyComposition(parseBodyCompositionResponse(response));
  } catch (error) {
    if (error instanceof VisionError) throw error;
    if (signal?.aborted || isAbortError(error)) throw cancelledError();
    throw malformedMediaError();
  }
}

function malformedMediaError(): VisionError {
  return new VisionError('malformed', 'The body composition report could not be read.');
}

function cancelledError(): VisionError {
  return new VisionError('cancelled', 'Report analysis cancelled.');
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
