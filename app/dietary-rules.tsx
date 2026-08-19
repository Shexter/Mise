import { StyleSheet, View } from 'react-native';

import { DietaryRuleList } from '@/components/dietary/DietaryRuleList';
import { Screen } from '@/components/Screen';
import { Caption, ScreenTitle } from '@/components/Type';
import { space } from '@/constants/theme';

/** Settings entry for dietary rules (task 7.2) — the same list onboarding shows. */
export default function DietaryRulesScreen() {
  return (
    <Screen scroll>
      <View style={styles.sections}>
      <ScreenTitle>What you avoid</ScreenTitle>
      <Caption muted>
        Allergies and restrictions are filtered out of suggestions. Dislikes
        rank lower, but can still appear if nothing else fits.
      </Caption>
      <DietaryRuleList />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { marginTop: space.base, gap: space.lg },
});
