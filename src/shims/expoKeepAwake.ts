import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';
import { useEffect, useId } from 'react';

interface NativeKeepAwake {
  activate?: (tag: string) => Promise<void>;
  deactivate?: (tag: string) => Promise<void>;
  isAvailableAsync?: () => Promise<boolean>;
  addListenerForTag?: (tag: string, listener?: KeepAwakeListener) => EventSubscription;
}

export type KeepAwakeEvent = { state: KeepAwakeEventState };
export type KeepAwakeListener = (event: KeepAwakeEvent) => void;
export interface KeepAwakeOptions {
  suppressDeactivateWarnings?: boolean;
  listener?: KeepAwakeListener;
}

export enum KeepAwakeEventState {
  RELEASE = 'release',
}

export const ExpoKeepAwakeTag = 'ExpoKeepAwakeDefaultTag';

const native = requireOptionalNativeModule<NativeKeepAwake>('ExpoKeepAwake');

export async function isAvailableAsync(): Promise<boolean> {
  if (!native?.isAvailableAsync) return native !== null;
  try {
    return await native.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function activateKeepAwakeAsync(tag = ExpoKeepAwakeTag): Promise<void> {
  await native?.activate?.(tag);
}

/** @deprecated Use activateKeepAwakeAsync. */
export function activateKeepAwake(tag = ExpoKeepAwakeTag): Promise<void> {
  return activateKeepAwakeAsync(tag);
}

export async function deactivateKeepAwake(tag = ExpoKeepAwakeTag): Promise<void> {
  await native?.deactivate?.(tag);
}

/** Expo development helper with Android Activity lifecycle failures contained. */
export function useKeepAwake(tag?: string, options?: KeepAwakeOptions): void {
  const generatedTag = useId();
  const activeTag = tag ?? generatedTag;

  useEffect(() => {
    let mounted = true;
    void activateKeepAwakeAsync(activeTag)
      .then(() => {
        if (mounted && options?.listener && native?.addListenerForTag) {
          native.addListenerForTag(activeTag, options.listener);
        }
      })
      .catch(() => {
        // Expo Go can reject while its Android Activity is inactive. Keeping
        // the screen awake is a development convenience, not an app contract.
      });

    return () => {
      mounted = false;
      void deactivateKeepAwake(activeTag).catch(() => {
        // The Activity may already be gone during Fast Refresh cleanup.
      });
    };
  }, [activeTag, options?.listener]);
}

export function addListener(
  tagOrListener: string | KeepAwakeListener,
  listener?: KeepAwakeListener,
): EventSubscription {
  const tag = typeof tagOrListener === 'string' ? tagOrListener : ExpoKeepAwakeTag;
  const resolvedListener = typeof tagOrListener === 'function' ? tagOrListener : listener;
  return native?.addListenerForTag?.(tag, resolvedListener) ?? { remove() {} };
}
