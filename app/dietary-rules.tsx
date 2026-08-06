import { StyleSheet } from 'react-native';

import { DietaryRuleList } from '@/components/dietary/DietaryRuleList';
import { Screen } from '@/components/Screen';
import { Caption, ScreenTitle } from '@/components/Type';
import { space } from '@/constants/theme';

/** Settings entry for dietary rules (task 7.2) — the same list onboarding shows. */
export default function DietaryRulesScreen() {
  return (
    <Screen scroll>
      <ScreenTitle style={styles.title}>What you avoid</ScreenTitle>
      <Caption muted style={styles.subtitle}>
        Allergies and restrictions are filtered out of suggestions. Dislikes
        rank lower, but can still appear if nothing else fits.
      </Caption>
      <DietaryRuleList />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.base },
  subtitle: { marginTop: space.sm, marginBottom: space.lg },
});
