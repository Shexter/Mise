import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SavedRecipesSection } from '@/components/recipes/SavedRecipesSection';
import { Screen } from '@/components/Screen';
import { ScreenTitle } from '@/components/Type';
import { space } from '@/constants/theme';
import { listRecipes } from '@/db/queries';
import type { Recipe } from '@/types';

export default function RecipesScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const load = useCallback(() => { void listRecipes().then(setRecipes); }, []);
  useFocusEffect(load);
  return (
    <Screen scroll>
      <View style={styles.sections}>
      <ScreenTitle>Saved recipes</ScreenTitle>
      <SavedRecipesSection recipes={recipes} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { marginTop: space.base, gap: space.lg },
});
