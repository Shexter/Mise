import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Caption } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import type { CuisineFilter } from '@/logic/cuisines';
import { cuisineIllustrationFor } from '@/media/cuisineIllustrations';

interface Props {
  cuisines: readonly CuisineFilter[];
  /** `null` is All. */
  selected: string | null;
  onSelect: (cuisineId: string | null) => void;
}

/** Tile diameter. Large enough for a painted subject to read at arm's length. */
const TILE = 64;

/**
 * The illustrated cuisine filter rail.
 *
 * Four rules the concept art cannot enforce on its own, so they live here:
 *
 * 1. **The label is text, never pixels.** It sits under the tile, scales with
 *    the reading size, and is what a screen reader announces. Artwork that
 *    fails to load costs the picture and nothing else.
 * 2. **All is drawn, not painted.** A functional control stays vector so it is
 *    crisp at every density and re-colours with the theme.
 * 3. **Selection is not colour.** The selected tile gains a ring and a heavier
 *    label as well as the action colour, and announces its selected state.
 * 4. **Overflow is operable, not only swipeable.** A button pages the rail, so
 *    the cuisines past the edge are reachable without a precise gesture.
 */
export function CuisineRail({ cuisines, selected, onSelect }: Props) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const [overflowing, setOverflowing] = useState(false);
  const scroller = useRef<ScrollView | null>(null);
  const offset = useRef(0);
  const viewport = useRef(0);
  const contentWidth = useRef(0);

  const page = () => {
    const next = offset.current + viewport.current * 0.8;
    // Wrapping back to the start keeps one button enough for a short rail; a
    // second, usually-disabled button would be more chrome than help.
    const target = next >= contentWidth.current - viewport.current ? 0 : next;
    scroller.current?.scrollTo({ x: target, animated: true });
  };

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="tablist"
        onScroll={(event) => { offset.current = event.nativeEvent.contentOffset.x; }}
        scrollEventThrottle={32}
        onLayout={(event) => {
          viewport.current = event.nativeEvent.layout.width;
          setOverflowing(contentWidth.current > viewport.current + 1);
        }}
        onContentSizeChange={(width) => {
          contentWidth.current = width;
          setOverflowing(width > viewport.current + 1);
        }}
      >
        <CuisineTile
          label="All"
          selected={selected === null}
          onPress={() => onSelect(null)}
          artwork={null}
        />
        {cuisines.map((cuisine) => (
          <CuisineTile
            key={cuisine.id}
            label={cuisine.label}
            selected={selected === cuisine.id}
            onPress={() => onSelect(selected === cuisine.id ? null : cuisine.id)}
            artwork={failed.has(cuisine.id) ? null : cuisineIllustrationFor(cuisine.id)}
            onArtworkError={() => setFailed((current) => new Set([...current, cuisine.id]))}
          />
        ))}
      </ScrollView>

      {overflowing ? (
        <Pressable
          onPress={page}
          accessibilityRole="button"
          accessibilityLabel="More cuisines"
          hitSlop={space.sm}
          style={({ pressed }) => [styles.more, pressed && { opacity: opacity.pressed }]}
        >
          <Feather name="chevron-right" size={20} color={color.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

function CuisineTile({
  label,
  selected,
  onPress,
  artwork,
  onArtworkError,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  artwork: ReturnType<typeof cuisineIllustrationFor>;
  onArtworkError?: () => void;
}) {
  const isAll = artwork === null && label === 'All';
  const filled = isAll && selected;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, pressed && { opacity: opacity.pressed }]}
    >
      <View
        style={[styles.frame, selected && styles.frameSelected, filled && styles.frameFilled]}
        // Decorative: the label beside it already says which cuisine this is,
        // and a screen reader repeating it would announce the tile twice.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {artwork ? (
          <Image source={artwork} style={styles.artwork} resizeMode="cover" onError={onArtworkError} />
        ) : isAll ? (
          <BowlGlyph tint={filled ? color.onAction : color.ink} />
        ) : (
          // No artwork accepted for this cuisine yet. An initial keeps the tile
          // a tile rather than a hole, and claims nothing about the food.
          <Caption style={selected ? styles.initialSelected : styles.initial}>
            {label.slice(0, 1).toUpperCase()}
          </Caption>
        )}
      </View>
      <Caption muted={!selected} style={selected ? styles.labelSelected : undefined}>
        {label}
      </Caption>
    </Pressable>
  );
}

/**
 * A bowl, for All. Hand-drawn for the same reason the navigation glyphs are:
 * this one sits beside painted food and a stock outline icon would read as
 * borrowed from another app.
 */
function BowlGlyph({ tint }: { tint: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path d="M3.2 10.5h17.6a8.8 8.8 0 0 1-8.8 8.2 8.8 8.8 0 0 1-8.8-8.2Z" fill={tint} />
      <Path
        d="M8.4 7.4c.5-1.1.5-2 0-2.9M12 6.9c.6-1.4.6-2.5 0-3.6M15.6 7.4c.5-1.1.5-2 0-2.9"
        stroke={tint}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center' },
  row: { gap: space.md, paddingVertical: space.sm, paddingRight: space.sm },
  tile: {
    alignItems: 'center',
    gap: space.xs,
    // The label sets the width, above a comfortable minimum. Capping it made
    // `Japanese` break across two lines mid-word at 200% text, which is a
    // worse rail than a wider one.
    minWidth: TILE,
  },
  frame: {
    width: TILE,
    height: TILE,
    borderRadius: TILE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  frameSelected: {
    // A ring, not a wash: the painted tiles keep their ivory paper and the
    // selection reads without touching the artwork.
    borderWidth: 3,
    borderColor: color.action,
  },
  frameFilled: { backgroundColor: color.action },
  artwork: { width: TILE, height: TILE },
  initial: { color: color.muted },
  initialSelected: { color: color.action },
  labelSelected: { color: color.action },
  more: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
