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
  elevation,
  layout,
  opacity,
  radius,
  space,
} from '@/constants/theme';

export interface ToastRequest {
  message: string;
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
          entering={Platform.OS === 'web' ? undefined : FadeInDown.duration(180)}
          exiting={Platform.OS === 'web' ? undefined : FadeOut.duration(180)}
          pointerEvents="box-none"
          style={[styles.host, { bottom: insets.bottom + space.lg }]}
        >
          <View style={styles.toast} accessibilityLiveRegion="polite">
            <Body style={styles.message} numberOfLines={2}>
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
    borderRadius: radius.card,
    paddingLeft: layout.cardPadding,
    paddingRight: space.sm,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    ...elevation,
  },
  message: { flex: 1 },
  action: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: space.md,
    justifyContent: 'center',
  },
  actionLabel: { color: color.olive },
});
