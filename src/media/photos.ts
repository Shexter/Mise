import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Meal photos live in the app's document directory, one JPEG per meal, named by
 * UUID. They are resized and compressed before anything else touches them —
 * a full-resolution camera frame is several megabytes of base64 nobody needs.
 */

const MEALS_DIRECTORY = 'meals';
const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.7;

export interface SourceImage {
  uri: string;
  width: number;
  height: number;
}

export interface PreparedPhoto {
  /** Permanent `file://` URI inside the document directory. */
  uri: string;
  /** Raw base64 JPEG, ready for the vision request. Not persisted. */
  base64: string;
}

function mealsDirectory(): Directory {
  const directory = new Directory(Paths.document, MEALS_DIRECTORY);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

/** Longest edge capped at 1024px, preserving aspect ratio. */
function resizeTarget({ width, height }: SourceImage): {
  width?: number;
  height?: number;
} {
  if (width <= MAX_EDGE && height <= MAX_EDGE) return {};
  return width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE };
}

/**
 * Resizes, compresses and stores a captured image, and returns its base64 for
 * the estimate request.
 */
export async function preparePhoto(
  source: SourceImage,
): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(source.uri);
  const target = resizeTarget(source);
  if (target.width !== undefined || target.height !== undefined) {
    context.resize(target);
  }

  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
    base64: true,
  });

  const destination = new File(mealsDirectory(), `${randomUUID()}.jpg`);
  await new File(result.uri).move(destination);

  return { uri: destination.uri, base64: result.base64 ?? '' };
}

/** Removes a stored photo. Missing files are not an error. */
export function deletePhoto(uri: string | null): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A photo we cannot delete is not worth interrupting the user for.
  }
}

/** Deletes every stored meal photo. Used by "Delete all data". */
export function deleteAllPhotos(): void {
  try {
    const directory = new Directory(Paths.document, MEALS_DIRECTORY);
    if (directory.exists) directory.delete();
  } catch {
    // Same reasoning as deletePhoto.
  }
}
