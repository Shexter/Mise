import { PixelRatio, StyleSheet, View } from 'react-native';

import { Caption, RowTitle } from '@/components/Type';
import { color, radius, space } from '@/constants/theme';

export interface MeterProps {
  /** The nutrient's name. */
  label: string;
  /** The known value, e.g. `18`. Rendered in the metric's own colour. */
  value: string;
  /** The target it is measured against, e.g. `30g`. Muted. */
  target: string;
  /** Already clamped to 0…1 by the caller. */
  ratio: number;
  /** e.g. `60%`. Withheld when coverage is incomplete — see below. */
  percent?: string;
  /** The metric's colour, from `metricColor`. */
  fill: string;
  /**
   * Some logged value is unknown, so the total is a floor rather than a
   * measurement. The track goes dashed and the percentage is withheld: a
   * number computed from partial data would read as certain when it is not.
   */
  incomplete?: boolean;
}

/**
 * Above this text scale the single-line layout stops fitting, and its fixed
 * leading columns would start truncating nutrient names and values — which is
 * the one thing a nutrient row may never do. Past it the row stacks instead:
 * label and figures on one line, the track full-width beneath.
 */
const STACK_ABOVE_FONT_SCALE = 1.3;

/**
 * One ruled nutrient row: name, value against target, track, percentage.
 *
 * Presentational only. The caller owns the pressable, the accessibility label,
 * and any action attached to the row, because those differ per surface.
 */
export function Meter({
  label,
  value,
  target,
  ratio,
  percent,
  fill,
  incomplete = false,
}: MeterProps) {
  const stacked = PixelRatio.getFontScale() > STACK_ABOVE_FONT_SCALE;

  const figures = (
    <View style={[styles.figures, stacked && styles.figuresStacked]}>
      <RowTitle numeric style={{ color: incomplete ? color.muted : fill }}>
        {value}
      </RowTitle>
      <Caption muted numeric>
        {' / '}
        {target}
      </Caption>
    </View>
  );

  const track = incomplete ? (
    <View style={[styles.track, styles.trackIncomplete]} />
  ) : (
    <View style={styles.track}>
      <View
        style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: fill }]}
      />
    </View>
  );

  const readout = (
    <Caption
      muted={incomplete}
      numeric
      style={[!stacked && styles.percent, !incomplete && { color: fill }]}
    >
      {incomplete ? '—' : percent ?? ''}
    </Caption>
  );

  return (
    <View>
      {stacked ? (
        <View style={styles.stack}>
          <View style={styles.stackHeader}>
            <RowTitle style={styles.labelFlexible}>{label}</RowTitle>
            {figures}
            {readout}
          </View>
          {track}
        </View>
      ) : (
        <View style={styles.row}>
          <RowTitle style={styles.label} numberOfLines={1}>
            {label}
          </RowTitle>
          {figures}
          {track}
          {readout}
        </View>
      )}

      {/* The dashed track and the withheld percentage both say "incomplete"
          without words. This says it in words, so the state does not depend on
          noticing a border style. */}
      {incomplete ? (
        <Caption muted style={styles.incompleteNote}>
          Incomplete · some logged values are unknown
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  // The label and figures hold a stable leading column so the tracks align
  // down the list rather than starting at a different x on every row.
  label: { width: 64, flexShrink: 0 },
  figures: {
    width: 78,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  track: {
    flex: 1,
    height: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.line,
    overflow: 'hidden',
  },
  trackIncomplete: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.line,
  },
  fill: { height: '100%', borderRadius: radius.pill },
  percent: { width: 40, flexShrink: 0, textAlign: 'right' },
  incompleteNote: { paddingBottom: space.md },

  // Large text: nothing is width-constrained, the header wraps freely, and the
  // track gets the full row rather than whatever the columns left behind.
  stack: { paddingVertical: space.md, gap: space.sm },
  stackHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: space.sm,
    rowGap: space.xs,
  },
  labelFlexible: { flexShrink: 1 },
  figuresStacked: {
    width: undefined,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
});
