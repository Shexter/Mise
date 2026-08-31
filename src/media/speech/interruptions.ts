import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { VoiceInterruptionKind } from '@/media/speech/session';

/**
 * Turns the things that take a microphone away into one explicit event.
 *
 * The list is short and every entry is something the OS does *to* the app: a
 * call arrives, the user switches away, the headphones are unplugged, another
 * app claims the input. What they have in common is that the app finds out
 * afterwards, and what they must never do is restart capture when they clear.
 *
 * The hook only reports. It has no idea what the session should do about a
 * call, which is the reducer's business — and keeping the two apart is what
 * makes "never auto-resume" one rule in one place instead of a promise repeated
 * at four listener sites.
 */

/** Fires once per interruption while capture is active. */
export function useVoiceInterruptions(
  active: boolean,
  onInterrupt: (kind: VoiceInterruptionKind) => void,
): void {
  useEffect(() => {
    if (!active) return undefined;

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      // `inactive` on iOS is the state during an incoming call or a control
      // centre pull; `background` is a real switch away. Both stop capture,
      // because a microphone left open while the user is elsewhere is exactly
      // the background recording this feature promises not to do.
      if (next === 'background' || next === 'inactive') {
        onInterrupt(next === 'inactive' ? 'call' : 'backgrounded');
      }
    });

    return () => subscription.remove();
  }, [active, onInterrupt]);
}

/**
 * What to say on return, when a draft survived the interruption.
 *
 * Says what is being held and that it is local, because coming back to a
 * half-filled transcript with no explanation reads like the app kept recording
 * while the user was on the phone.
 */
export function interruptedDraftNotice(itemCount: number): string {
  const items = itemCount === 1 ? '1 item' : `${itemCount} items`;
  return `Recording stopped and did not restart. What you had said is still here — ${items} so far, kept on this device only. Carry on, review it, or discard it.`;
}
