import * as Location from 'expo-location';

import { coarsen, type Coordinates } from '@/logic/shops';

/**
 * The device's position, read one shot at a time, in the foreground only.
 *
 * What this module deliberately does not have: no `startLocationUpdatesAsync`,
 * no `startGeofencingAsync`, no `TaskManager` registration, no background
 * permission request. Reliable arrival/departure detection would need "Always"
 * authorization on both platforms, which is a materially bigger ask than this
 * feature is worth — so automatic detection was dropped and every read here
 * happens because the user tapped something or imported a receipt.
 *
 * It also never calls `geocodeAsync` or `reverseGeocodeAsync`. Those are
 * network lookups against a places database; the shop list is learned from the
 * user's own receipts instead, so it works offline and carries no licence.
 *
 * Every function degrades to a falsy answer rather than throwing. A denied,
 * revoked, or unavailable permission is an ordinary outcome here, not an error
 * the caller has to handle.
 */

/** Whether the foreground permission is already granted. Never prompts. */
export async function hasLocationPermission(): Promise<boolean> {
  try {
    const { granted } = await Location.getForegroundPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

/**
 * Asks for the foreground permission, once.
 *
 * The caller is responsible for having explained what it is for *before*
 * getting here — the spec requires the sentence, and the OS dialog is not it.
 * A declined request is remembered by the OS and never re-prompts, which is
 * what "not asked again unprompted" rests on.
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

/**
 * One coarse foreground position, or null.
 *
 * Null covers every way this can fail to produce an answer — no permission,
 * revoked mid-use, location services off, no fix — because the caller treats
 * them identically: it surfaces nothing and says nothing. `Accuracy.Low` is
 * requested rather than the default: the answer is rounded to building-level
 * precision anyway, so asking the device for better is asking for data that
 * is then thrown away.
 */
export async function readCoarsePosition(): Promise<Coordinates | null> {
  if (!(await hasLocationPermission())) return null;
  try {
    const reading = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });
    return coarsen({
      latitude: reading.coords.latitude,
      longitude: reading.coords.longitude,
    });
  } catch {
    return null;
  }
}
