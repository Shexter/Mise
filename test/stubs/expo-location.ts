/**
 * Node stand-in for `expo-location`, wired in via `vitest.config.ts`.
 *
 * Presents only the three foreground calls `src/logic/location.ts` uses. The
 * absence of `startLocationUpdatesAsync`, `startGeofencingAsync`,
 * `geocodeAsync`, and `reverseGeocodeAsync` is intentional: if app code ever
 * reaches for one, the test suite fails to run rather than quietly acquiring
 * background tracking or a places lookup.
 */

export const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
} as const;

export interface LocationObject {
  coords: { latitude: number; longitude: number };
}

interface StubState {
  granted: boolean;
  position: { latitude: number; longitude: number } | null;
  /** Set to make a read throw, standing in for a revoked permission. */
  throwOnRead: boolean;
  reads: number;
}

export const stub: StubState = {
  granted: false,
  position: null,
  throwOnRead: false,
  reads: 0,
};

export function resetLocationStub(): void {
  stub.granted = false;
  stub.position = null;
  stub.throwOnRead = false;
  stub.reads = 0;
}

export function getForegroundPermissionsAsync(): Promise<{ granted: boolean }> {
  return Promise.resolve({ granted: stub.granted });
}

export function requestForegroundPermissionsAsync(): Promise<{ granted: boolean }> {
  return Promise.resolve({ granted: stub.granted });
}

export function getCurrentPositionAsync(): Promise<LocationObject> {
  stub.reads += 1;
  if (stub.throwOnRead) return Promise.reject(new Error('Location unavailable.'));
  if (!stub.position) return Promise.reject(new Error('No fix.'));
  return Promise.resolve({ coords: { ...stub.position } });
}
