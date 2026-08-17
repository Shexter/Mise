import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Caption, RowTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
export { nextExpandedId } from '@/logic/collapsibleEditor';

interface Props {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  initiallyExpanded?: boolean;
}

/** A compact identity row that discloses secondary editing fields on demand. */
export function CollapsibleEditorRow({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: Props) {
  return (
    <View style={styles.root}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${title}`}
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.header, pressed && { opacity: opacity.pressed }]}
      >
        <View style={styles.identity}>
          <RowTitle numberOfLines={2}>{title}</RowTitle>
          {subtitle ? <Caption muted numberOfLines={1}>{subtitle}</Caption> : null}
        </View>
        <Caption muted accessibilityElementsHidden>{expanded ? '⌃' : '⌄'}</Caption>
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    overflow: 'hidden',
  },
  header: {
    minHeight: layout.minRowHeight,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.base,
  },
  identity: { flex: 1, gap: space.xs },
  body: { paddingHorizontal: layout.cardPadding, paddingBottom: layout.cardPadding, gap: space.base },
});
