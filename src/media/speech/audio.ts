import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Raw audio's whole life, which is short by design.
 *
 * Two rules, both from the spec, both enforced here rather than remembered at
 * every call site:
 *
 *   1. **Audio lives in the cache directory, never the document directory.**
 *      `src/media/photos.ts` puts photos in documents because a meal photo is
 *      something the user keeps. A pantry recording is not: it is an
 *      intermediate that stops being useful the moment there is a transcript.
 *      Putting it in the cache means the OS may reclaim it, it is excluded from
 *      device backups, and it can never be confused for pantry data.
 *
 *   2. **It never enters `pending_captures`.** That queue is for photographs
 *      waiting on a network call; anything in it survives process death by
 *      design. Audio surviving process death is exactly what must not happen,
 *      and the way to guarantee that is for this module to be the only thing
 *      that knows where audio lives.
 *
 * A kitchen microphone records the kitchen — other people, other conversations,
 * whatever is on the television. None of that is pantry data and none of it has
 * any business outliving the transcription attempt.
 */

const AUDIO_DIRECTORY = 'voice-intake';

function directory(): Directory {
  const dir = new Directory(Paths.cache, AUDIO_DIRECTORY);
  if (!dir.exists) dir.create();
  return dir;
}

/** A path for one recording. Creating the path does not create a file. */
export function newAudioPath(extension = 'm4a'): string {
  return new File(directory(), `${randomUUID()}.${extension}`).uri;
}

/**
 * Deletes one recording. Safe to call with null, twice, or on a file that was
 * never written — every caller reaches this on paths where it may already be
 * gone, and making them each guard would be four chances to forget.
 */
export function deleteAudio(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A recording that cannot be deleted is not worth crashing a review over.
    // The directory sweep below is the backstop.
  }
}

/**
 * Removes every recording left behind.
 *
 * Called when the voice surface opens, not only when it closes: a process
 * killed mid-session cannot run its own cleanup, and the next open is the first
 * moment anything can. Together with per-attempt deletion this bounds audio
 * retention to one session even after a crash.
 */
export function purgeAllAudio(): void {
  try {
    const dir = new Directory(Paths.cache, AUDIO_DIRECTORY);
    if (dir.exists) dir.delete();
  } catch {
    // Nothing to do — the cache directory is the OS's to reclaim anyway.
  }
}
