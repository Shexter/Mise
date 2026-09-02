import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import type { CardTint } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, RowTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import {
  ACTION_ILLUSTRATIONS,
  type ActionIllustrationId,
} from '@/media/actionIllustrations';
import { useAddSheetStore } from '@/store/addSheetStore';

interface Method {
  label: string;
  detail?: string;
  /** Fallback when this method has no promoted artwork. */
  icon: keyof typeof Feather.glyphMap;
  /** Promoted artwork for this way in, when one exists. */
  illustration?: ActionIllustrationId;
  /**
   * Draws viewfinder corners around the artwork. Only the meal row: it is the
   * one method that is literally a camera pointed at a plate, and the concept
   * frames it the same way the starter-pantry scan area is framed.
   */
  framed?: boolean;
  route: string;
  tint: CardTint;
  /** The accent this method is grouped by — its icon, and its border if led. */
  accent: string;
  /**
   * The one method the sheet leads with. Speaking a shelf is the fastest way
   * to catalogue a kitchen and the least discoverable, which is exactly the
   * combination that earns emphasis.
   */
  led?: boolean;
}

const METHODS: readonly Method[] = [
  {
    label: 'Log a meal',
    icon: 'camera',
    illustration: 'log-meal',
    framed: true,
    route: '/capture',
    tint: 'tintPaprika',
    accent: color.paprika,
  },
  {
    label: 'Scan a receipt',
    icon: 'file-text',
    illustration: 'scan-receipt',
    route: '/receipt-capture',
    tint: 'tintBlue',
    accent: color.chart5,
  },
  {
    label: 'Photograph pantry items',
    icon: 'package',
    illustration: 'photograph-pantry',
    route: '/pantry-capture',
    tint: 'tintOlive',
    accent: color.olive,
  },
  {
    label: 'Speak your pantry',
    detail: 'Describe a whole shelf in one go',
    icon: 'mic',
    illustration: 'speak-pantry',
    route: '/pantry-voice',
    tint: 'tintPaprika',
    accent: color.action,
    led: true,
  },
  // The only route here that needs no nutrition entered at all: cooking a dish
  // Mise proposed fills its own calories from the recipe's ingredients. Without
  // this row the sheet's only keyless path was the by-hand form, which asks for
  // figures the app already knows.
  {
    label: 'Cook something',
    detail: "Tonight's ideas & recipes",
    icon: 'book-open',
    route: '/dinner',
    tint: 'tintWheat',
    accent: color.wheat,
  },
];

/**
 * The centre add surface: every way into Mise, in one place, reached from one
 * control. The user never classifies their own input before the app will help
 * — routing behind each camera path is the app's job, not theirs.
 */
export function AddSheet() {
  const router = useRouter();
  const open = useAddSheetStore((state) => state.open);
  const hide = useAddSheetStore((state) => state.hide);

  const go = (route: string) => {
    hide();
    router.push(route as never);
  };

  return (
    <Sheet visible={open} onClose={hide} title="Add to Mise">
      {METHODS.map((method) => (
        <Pressable
          key={method.route}
          onPress={() => go(method.route)}
          accessibilityRole="button"
          accessibilityLabel={method.label}
          accessibilityHint={method.detail}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: color[method.tint] },
            method.led && { borderColor: method.accent },
            pressed && { opacity: opacity.pressed },
          ]}
        >
          <MethodArt method={method} />
          <View style={styles.text}>
            <RowTitle style={method.led ? { color: method.accent } : undefined}>
              {method.label}
            </RowTitle>
            {method.detail ? <Caption muted>{method.detail}</Caption> : null}
          </View>
          <Feather
            name="chevron-right"
            size={20}
            color={method.led ? method.accent : color.muted}
          />
        </Pressable>
      ))}

      {/* The path that needs no key, no connection, and no camera. It is quiet
          because it is rarely the fastest, and present because it is the only
          one that always works. */}
      <Pressable
        onPress={() => go('/manual')}
        accessibilityRole="button"
        accessibilityLabel="Enter a meal by hand"
        accessibilityHint="Works with no API key, no connection, and no camera"
        style={({ pressed }) => [
          styles.manual,
          pressed && { opacity: opacity.pressed },
        ]}
      >
        <Feather name="edit-3" size={18} color={color.muted} />
        <Body muted>Enter by hand</Body>
      </Pressable>
    </Sheet>
  );
}

/**
 * A method's artwork, or its glyph when no artwork has been promoted for it.
 *
 * The framing corners are vector on purpose. They are viewfinder chrome, so
 * they have to stay crisp at any size and retint with the theme — and the
 * locked illustration style ends in `no border`, so painting them into the
 * artwork would be prompting against the recipe rather than following it.
 */
function MethodArt({ method }: { method: Method }) {
  const source = method.illustration
    ? ACTION_ILLUSTRATIONS[method.illustration]
    : undefined;

  if (source === undefined) {
    return (
      <View style={styles.glyph}>
        <Feather name={method.icon} size={22} color={method.accent} />
      </View>
    );
  }

  const art = (
    <Image
      source={source}
      style={styles.art}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );

  if (!method.framed) return <View style={styles.glyph}>{art}</View>;

  return (
    <View style={styles.glyph}>
      {art}
      <View style={[styles.corner, styles.cornerTopLeft, { borderColor: method.accent }]} />
      <View style={[styles.corner, styles.cornerTopRight, { borderColor: method.accent }]} />
      <View style={[styles.corner, styles.cornerBottomLeft, { borderColor: method.accent }]} />
      <View style={[styles.corner, styles.cornerBottomRight, { borderColor: method.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.base,
    paddingHorizontal: space.base,
    paddingVertical: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  glyph: {
    // Wider than the minimum touch target: the row is 72 tall and the artwork
    // is the thing being recognised, so a 44px thumbnail wastes the space and
    // loses the detail the illustration was drawn for.
    width: space.xxl + space.sm,
    height: space.xxl + space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: {
    width: space.xxl + space.sm,
    height: space.xxl + space.sm,
    borderRadius: radius.input,
  },
  /**
   * Four brackets rather than a box: a viewfinder marks where the frame is
   * without enclosing the picture in a second panel.
   */
  corner: {
    position: 'absolute',
    width: space.md,
    height: space.md,
    borderWidth: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopLeftRadius: radius.input / 2,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderTopRightRadius: radius.input / 2,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomLeftRadius: radius.input / 2,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomRightRadius: radius.input / 2,
  },
  text: { flex: 1, gap: space.xs },
  manual: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});
