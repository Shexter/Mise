import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenTitle } from '@/components/Type';
import { color, fillParent, layout, radius, space } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Rendered pinned below the scroll area. */
  footer?: ReactNode;
}

/** A bottom sheet. Tapping the scrim closes it; the header carries a Close. */
export function Sheet({ visible, onClose, title, children, footer }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + space.base },
            ]}
          >
            <View style={styles.header}>
              <ScreenTitle style={styles.title}>{title}</ScreenTitle>
              <Button
                label="Close"
                variant="ghost"
                block={false}
                onPress={onClose}
              />
            </View>
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...fillParent, backgroundColor: color.ink, opacity: 0.35 },
  sheet: {
    backgroundColor: color.ground,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: layout.screenGutter,
    paddingRight: space.sm,
    paddingTop: space.base,
  },
  title: { flex: 1 },
  body: { paddingHorizontal: layout.screenGutter },
  bodyContent: { paddingTop: space.base, paddingBottom: space.base, gap: space.base },
  footer: { paddingHorizontal: layout.screenGutter, paddingTop: space.sm },
});
