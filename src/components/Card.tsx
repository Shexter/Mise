import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { SectionLabel } from '@/components/Type';
import { color, elevation, layout, radius, space } from '@/constants/theme';

interface Props {
  children: ReactNode;
  /** Rendered above the card in the section-label role. */
  title?: string;
  /** Rows manage their own padding; lists usually want this off. */
  padded?: boolean;
  style?: ViewStyle;
}

export function Card({ children, title, padded = true, style }: Props) {
  return (
    <View>
      {title ? (
        <SectionLabel muted style={styles.title}>
          {title}
        </SectionLabel>
      ) : null}
      <View style={[styles.card, padded && styles.padded, style]}>
        {children}
      </View>
    </View>
  );
}

/** A 1px hairline between rows inside a card. */
export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  title: { marginBottom: space.sm, marginLeft: space.xs },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...elevation,
  },
  padded: { padding: layout.cardPadding },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.line,
    marginLeft: layout.cardPadding,
  },
});
