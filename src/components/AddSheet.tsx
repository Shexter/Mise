import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CardTint } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, RowTitle } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { useAddSheetStore } from '@/store/addSheetStore';

interface Method {
  label: string;
  detail?: string;
  icon: keyof typeof Feather.glyphMap;
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
    route: '/capture',
    tint: 'tintPaprika',
    accent: color.paprika,
  },
  {
    label: 'Scan a receipt',
    icon: 'file-text',
    route: '/receipt-capture',
    tint: 'tintBlue',
    accent: color.chart5,
  },
  {
    label: 'Photograph pantry items',
    icon: 'package',
    route: '/pantry-capture',
    tint: 'tintOlive',
    accent: color.olive,
  },
  {
    label: 'Speak your pantry',
    detail: 'Describe a whole shelf in one go',
    icon: 'mic',
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
          <View style={styles.glyph}>
            <Feather name={method.icon} size={22} color={method.accent} />
          </View>
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
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
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
