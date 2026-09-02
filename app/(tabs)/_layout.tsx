import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddSheet } from '@/components/AddSheet';
import {
  PantryIcon,
  PlusIcon,
  SettingsIcon,
  ShopIcon,
  TodayIcon,
  type NavIconProps,
} from '@/components/icons/NavIcons';
import { RecentMealsSheet } from '@/components/meals/RecentMealsSheet';
import { Caption } from '@/components/Type';
import { cardShadowStyle, color, layout, opacity, radius, space } from '@/constants/theme';
import { localDateString } from '@/logic/dates';
import { cloneMealForLogging, type QuickRelogVenue } from '@/logic/mealCloning';
import { useAddSheetStore } from '@/store/addSheetStore';
import { useCaptureStore } from '@/store/captureStore';
import type { MealWithItems } from '@/types';
import { useRouter } from 'expo-router';

/** Route name → glyph. The centre `+` is not a route and is not in here. */
const ICONS: Record<string, (props: NavIconProps) => React.ReactElement> = {
  index: TodayIcon,
  pantry: PantryIcon,
  shop: ShopIcon,
  settings: SettingsIcon,
};

/** The ring around the add button, in the bar's own ground colour. */
const RING = layout.navAddSize + layout.navAddRing * 2;

export default function TabsLayout() {
  return (
    <>
      <Tabs
        tabBar={(props) => <MiseTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: 'Today' }} />
        <Tabs.Screen name="pantry" options={{ title: 'Pantry' }} />
        <Tabs.Screen name="shop" options={{ title: 'Shop' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      </Tabs>

      {/* Mounted above the navigator so the add surface survives a tab change
          and is reachable from every destination, not just the one that
          happened to open it. */}
      <AddSheet />
      <QuickRelog />
    </>
  );
}

/**
 * Five positions, four of them destinations.
 *
 * The centre `+` is an action, not a tab: it opens the shared add surface. It
 * cannot be a `Tabs.Screen`, because a route would put an empty screen in the
 * back stack and make Back return to a page that never existed.
 */
function MiseTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const show = useAddSheetStore((s) => s.show);
  const showRecentMeals = useAddSheetStore((s) => s.showRecentMeals);

  const tab = (index: number) => {
    const route = state.routes[index];
    if (!route) return null;

    const { options } = descriptors[route.key]!;
    const focused = state.index === index;
    const Icon = ICONS[route.name] ?? TodayIcon;
    const tint = focused ? color.action : color.ink;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={options.title ?? route.name}
        style={({ pressed }) => [
          styles.tab,
          pressed && { opacity: opacity.pressed },
        ]}
      >
        <Icon tint={tint} filled={focused} />
        <Caption style={[styles.label, { color: tint }]} numberOfLines={1}>
          {options.title ?? route.name}
        </Caption>
      </Pressable>
    );
  };

  return (
    // `box-none` so the transparent strip the button rises into does not
    // swallow taps meant for the content behind it.
    <View
      style={[styles.container, { paddingBottom: insets.bottom }]}
      pointerEvents="box-none"
    >
      <View
        style={[styles.surface, { bottom: 0, top: layout.navAddLift }]}
        pointerEvents="none"
      />

      <View style={styles.row} pointerEvents="box-none">
        {tab(0)}
        {tab(1)}

        <View style={styles.centre} pointerEvents="box-none">
          <View style={[styles.addWrap, cardShadowStyle(2)]}>
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                show();
              }}
              onLongPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                showRecentMeals();
              }}
              accessibilityRole="button"
              accessibilityLabel="Add to Mise"
              accessibilityHint="Log a meal, scan a receipt, photograph or speak pantry items. Long press to repeat a recent meal."
              style={({ pressed }) => [
                styles.add,
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <PlusIcon tint={color.onAction} />
            </Pressable>
          </View>
        </View>

        {tab(2)}
        {tab(3)}
      </View>
    </View>
  );
}

/**
 * The long-press destination, kept beside the bar that triggers it. It logs
 * against today regardless of which day Today is showing, because repeating a
 * meal is a "I am eating this now" action.
 */
function QuickRelog() {
  const router = useRouter();
  const open = useAddSheetStore((s) => s.recentMealsOpen);
  const hide = useAddSheetStore((s) => s.hideRecentMeals);
  const setMealDraft = useCaptureStore((s) => s.setMealDraft);

  const onSelect = (meal: MealWithItems, venue: QuickRelogVenue) => {
    setMealDraft(cloneMealForLogging(meal, localDateString(), venue));
    hide();
    router.push('/review');
  };

  return <RecentMealsSheet visible={open} onClose={hide} onSelect={onSelect} />;
}

const styles = StyleSheet.create({
  container: {
    // Transparent headroom for the button to rise into. The bar's own surface
    // starts below it.
    paddingTop: layout.navAddLift,
  },
  surface: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: color.raised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.raisedLine,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.navBarHeight,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: layout.minTouchTarget,
  },
  centre: { flex: 1, alignItems: 'center' },
  addWrap: {
    position: 'absolute',
    // Lifts the ring so it clears the bar's top edge by exactly `navAddLift`.
    bottom: layout.navBarHeight + layout.navAddLift - RING,
    width: RING,
    height: RING,
    borderRadius: radius.full,
    backgroundColor: color.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    width: layout.navAddSize,
    height: layout.navAddSize,
    borderRadius: radius.full,
    backgroundColor: color.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, lineHeight: 14 },
});
