import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { SectionLabel } from '@/components/Type';
import { color, elevation, layout, radius, space } from '@/constants/theme';

/**
 * `surface` is the original raised card and stays the default, so screens that
 * have not been through the rebrand do not shift underneath it.
 *
 * `outline` is the landed direction's dominant container: a hairline on the
 * ground, no fill and no shadow, letting a list read as a ruled structure
 * rather than a stack of floating objects.
 *
 * `tint` fills with one of the semantic washes. It carries meaning — which
 * intake method, which storage location — and is never chosen for variety.
 */
export type CardVariant = 'surface' | 'outline' | 'tint';

/** The tint roles a card may fill with. Deliberately not every colour token. */
export type CardTint = 'tintPaprika' | 'tintBlue' | 'tintOlive' | 'tintWheat';

interface Props {
  children: ReactNode;
  /** Rendered above the card in the section-label role. */
  title?: string;
  /** Rows manage their own padding; lists usually want this off. */
  padded?: boolean;
  variant?: CardVariant;
  /** Required by `tint`, ignored otherwise. */
  tint?: CardTint;
  /** Draws the border in an accent rather than the hairline. */
  borderColor?: string;
  style?: ViewStyle;
}

export function Card({
  children,
  title,
  padded = true,
  variant = 'surface',
  tint,
  borderColor,
  style,
}: Props) {
  return (
    <View>
      {title ? (
        <SectionLabel muted style={styles.title}>
          {title}
        </SectionLabel>
      ) : null}
      <View
        style={[
          styles.card,
          variant === 'surface' && styles.surface,
          variant === 'outline' && styles.outline,
          variant === 'tint' && [
            styles.outline,
            { backgroundColor: color[tint ?? 'tintPaprika'] },
          ],
          borderColor ? { borderColor } : null,
          padded && styles.padded,
          style,
        ]}
      >
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
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  surface: {
    backgroundColor: color.surface,
    ...elevation,
  },
  // No shadow. A bordered container that also carries elevation reads as two
  // competing edges, which is what makes a stack of them feel generic.
  outline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  padded: { padding: layout.cardPadding },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.line,
    marginLeft: layout.cardPadding,
  },
});
