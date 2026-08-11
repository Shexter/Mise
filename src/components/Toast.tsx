import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, ButtonLabel } from '@/components/Type';
import {
  color,
  duration,
  elevation,
  layout,
  opacity,
  radius,
  space,
} from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** The intent of transient feedback. The message remains the source of truth. */
export type ToastKind = 'success' | 'pending' | 'recoverable-error';

export interface ToastRequest {
  message: string;
  /** Defaults to success so existing confirmations retain their meaning. */
  kind?: ToastKind;
  /** Optional single action, e.g. "Undo". */
  actionLabel?: string;
  onAction?: () => void;
  /** Called when the toast leaves without the action being taken. */
  onExpire?: () => void;
  durationMs?: number;
}

interface ToastApi {
  show: (request: ToastRequest) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 4_000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastRequest | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const dismiss = useCallback((expired: boolean) => {
    clearTimer();
    setToast((current) => {
      if (current && expired) current.onExpire?.();
      return null;
    });
  }, []);

  const show = useCallback(
    (request: ToastRequest) => {
      // A second toast resolves the first — its action window has passed.
      setToast((current) => {
        current?.onExpire?.();
        return request;
      });
      clearTimer();
      timer.current = setTimeout(
        () => dismiss(true),
        request.durationMs ?? DEFAULT_DURATION,
      );
    },
    [dismiss],
  );

  useEffect(() => clearTimer, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <Animated.View
          entering={Platform.OS === 'web' || reduceMotion ? undefined : FadeInDown.duration(duration.quick)}
          exiting={Platform.OS === 'web' || reduceMotion ? undefined : FadeOut.duration(duration.quick)}
          pointerEvents="box-none"
          style={[styles.host, { bottom: insets.bottom + space.lg }]}
        >
          <View
            style={[styles.toast, styles[toast.kind ?? 'success']]}
            accessibilityLiveRegion="polite"
          >
            <Body
              style={styles.message}
              numberOfLines={2}
              accessibilityRole="alert"
            >
              {toast.message}
            </Body>
            {toast.actionLabel ? (
              <Pressable
                onPress={() => {
                  clearTimer();
                  const action = toast.onAction;
                  setToast(null);
                  action?.();
                }}
                accessibilityRole="button"
                accessibilityLabel={toast.actionLabel}
                style={({ pressed }) => [
                  styles.action,
                  pressed && { opacity: opacity.pressed },
                ]}
              >
                <ButtonLabel style={styles.actionLabel}>
                  {toast.actionLabel}
                </ButtonLabel>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast used outside ToastProvider.');
  return api;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: layout.screenGutter,
    right: layout.screenGutter,
  },
  toast: {
    minHeight: layout.minTouchTarget,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingLeft: layout.cardPadding,
    paddingRight: space.sm,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    ...elevation,
  },
  success: { borderColor: color.olive },
  pending: { borderColor: color.wheat },
  'recoverable-error': { borderColor: color.paprika },
  message: { flex: 1 },
  action: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: space.md,
    justifyContent: 'center',
  },
  actionLabel: { color: color.olive },
});
