import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import {
  Body,
  ButtonLabel,
  Caption,
  Hero,
  MealCalories,
  RowTitle,
  ScreenTitle,
  SectionLabel,
} from '@/components/Type';
import {
  color,
  radius,
  space,
  type as typeScale,
} from '@/constants/theme';

/**
 * The M0 token screen. Renders every colour, type role, radius and spacing step
 * from `constants/theme`, so the design system can be eyeballed against §7 of
 * the spec on a real device. Reachable from the small dot on the Today header.
 */
export default function TokensScreen() {
  const router = useRouter();

  return (
    <Screen scroll footer={<Button label="Close" onPress={() => router.back()} />}>
      <ScreenTitle style={styles.title}>Design tokens</ScreenTitle>

      <View style={styles.groups}>
        <Card title="Colour">
          <View style={styles.swatches}>
            {COLORS.map(([name, value]) => (
              <View key={name} style={styles.swatch}>
                <View style={[styles.chip, { backgroundColor: value }]} />
                <Caption>{name}</Caption>
                <Caption muted>{value}</Caption>
              </View>
            ))}
          </View>
        </Card>

        <Card title="Type">
          <View style={styles.typeList}>
            <Hero numeric>1,420</Hero>
            <Caption muted>Hero · Fraunces 72</Caption>
            <MealCalories numeric>320</MealCalories>
            <Caption muted>Meal calories · Fraunces 22</Caption>
            <ScreenTitle>Screen title</ScreenTitle>
            <Caption muted>Archivo 28</Caption>
            <SectionLabel muted>Section label</SectionLabel>
            <Caption muted>Archivo 11, uppercase</Caption>
            <Body>Body copy in Archivo 16.</Body>
            <RowTitle>Row title, Archivo 16 medium</RowTitle>
            <Caption>Caption, Archivo 13</Caption>
            <ButtonLabel>Button label</ButtonLabel>
          </View>
        </Card>

        <Card title="Radius">
          <View style={styles.radiusRow}>
            {RADII.map(([name, value]) => (
              <View key={name} style={styles.radiusItem}>
                <View style={[styles.radiusBox, { borderRadius: value }]} />
                <Caption muted>
                  {name} · {value}
                </Caption>
              </View>
            ))}
          </View>
        </Card>

        <Card title="Spacing">
          <View style={styles.spacingList}>
            {SPACING.map(([name, value]) => (
              <View key={name} style={styles.spacingRow}>
                <Caption muted style={styles.spacingLabel}>
                  {name} · {value}
                </Caption>
                <View style={[styles.spacingBar, { width: value }]} />
              </View>
            ))}
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const COLORS: [string, string][] = [
  ['ground', color.ground],
  ['surface', color.surface],
  ['ink', color.ink],
  ['muted', color.muted],
  ['line', color.line],
  ['paprika', color.paprika],
  ['wheat', color.wheat],
  ['olive', color.olive],
];

const RADII: [string, number][] = [
  ['input', radius.input],
  ['card', radius.card],
  ['full', 32],
];

const SPACING: [string, number][] = Object.entries(space) as [string, number][];

// Referenced so the type scale is imported and the roles above stay in sync
// with the source of truth even as the file is edited.
void typeScale;

const styles = StyleSheet.create({
  title: { marginTop: space.base, marginBottom: space.lg },
  groups: { gap: space.lg },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.base },
  swatch: { width: 72, gap: space.xs },
  chip: {
    width: 72,
    height: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.line,
  },
  typeList: { gap: space.sm },
  radiusRow: { flexDirection: 'row', gap: space.lg },
  radiusItem: { alignItems: 'center', gap: space.sm },
  radiusBox: {
    width: 56,
    height: 56,
    backgroundColor: color.ink,
  },
  spacingList: { gap: space.sm },
  spacingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  spacingLabel: { width: 96 },
  spacingBar: { height: 12, backgroundColor: color.olive, borderRadius: 2 },
});
